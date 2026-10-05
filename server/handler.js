/**
 * The portal's API. Each route is a Vercel Function in /api (see api/*.js); in
 * development the same handler is mounted by the Vite plugin in vite.config.js.
 *
 *   GET  /api/health         which database is connected (none = browser-only mode)
 *   GET  /api/public         branding, sign-up options and the external catalog
 *   GET  /api/public-course  a course with public sharing on (?id=)
 *   POST /api/login          { email, password } or { ticket, code } -> session cookie
 *   POST /api/logout
 *   GET  /api/data           everything the signed-in user may see
 *   POST /api/sync           record changes from the browser, checked per role
 *   POST /api/password       { current, next } for the signed-in user
 *   *    /api/rpc            single actions: sign-up, two-factor, checkout, uploads … (server/rpc.js)
 *   GET  /api/oauth          sign in with Google, Facebook, LinkedIn or the organization's own provider
 *   GET  /api/cron           the daily timer (see vercel.json)
 *   *    /api/v1             REST API for other systems, with an API key (server/apiv1.js)
 */
import { storeKind } from './store.js'
import { authorize, gateFor, isAdmin, publicCatalog, publicSettings, viewFor, withoutPassword } from './access.js'
import { withSettingDefaults } from '../src/lib/settingsDefaults.js'
import { ipAllowed, twoFactorRequired } from '../src/lib/rules.js'
import { loadSecrets, emailReady, signInProviders } from './services.js'
import {
  HttpError,
  commit,
  loadDb,
  openStore,
  queryOf,
  readJson,
  recordHistory,
  runTick,
  send,
  session,
  startSession,
} from './core.js'
import {
  backupHash,
  clearedCookie,
  clientIp,
  createToken,
  hashPassword,
  passwordProblem,
  readTicket,
  sessionCookie,
  signTicket,
  verifyPassword,
  verifyTotp,
} from './auth.js'
import { oauth, rpc } from './rpc.js'
import { apiV1 } from './apiv1.js'

const minutes = (ms) => Math.max(1, Math.ceil(ms / 60000))

/** What the browser shows while a gate (two-factor set-up, new password, terms) is still open. */
function gatedView(db, user) {
  const settings = withSettingDefaults(db.settings)
  return {
    settings: {
      ...publicSettings(db.settings),
      users: { ...publicSettings(db.settings).users, terms: settings.users.terms, termsOn: settings.users.termsOn },
      security: { strongPasswords: settings.security.strongPasswords, twoFactor: settings.security.twoFactor },
    },
    users: [withoutPassword(user)],
  }
}

const routes = {
  async health(req, res) {
    send(res, 200, { ok: true, database: storeKind() })
  },

  async public(req, res) {
    const { store } = await openStore()
    const raw = (await store.get('settings', 'portal')) || {}
    const settings = withSettingDefaults(raw)
    const { values: secrets } = await loadSecrets(store)
    const body = { settings: publicSettings(raw, { social: signInProviders(settings, secrets) }) }
    if (settings.courses.externalCatalog) body.catalog = publicCatalog(await loadDb(store))
    send(res, 200, body)
  },

  async 'public-course'(req, res) {
    const { store } = await openStore()
    const id = queryOf(req).get('id') || ''
    const course = await store.get('courses', id)
    if (!course || course.status !== 'active' || !course.publicSharing) throw new HttpError(404, 'This course is not shared.')
    send(res, 200, { course })
  },

  async login(req, res) {
    if (req.method !== 'POST') throw new HttpError(405, 'Use POST.')
    const { store, secret } = await openStore()
    const body = await readJson(req)
    const settings = withSettingDefaults(await store.get('settings', 'portal'))
    const sec = settings.security
    if (!ipAllowed(clientIp(req), sec.allowedIps)) throw new HttpError(403, 'Signing in is not allowed from this network.')

    const now = Date.now()
    const limit = Number(sec.loginAttempts) || 0
    const lockFor = Math.max(1, Number(sec.lockoutMinutes) || 15)
    const saveAuth = (userId, auth) => store.upsert([{ collection: '_auth', id: userId, data: { ...auth, userId } }])
    /** Counts a wrong password or code, and locks the account when the limit is reached. */
    const failed = async (user, auth, message) => {
      const fails = (Number(auth.fails) || 0) + 1
      if (limit > 0 && fails >= limit) {
        await saveAuth(user.id, { ...auth, fails: 0, lockedUntil: now + lockFor * 60000 })
        throw new HttpError(429, `Too many failed attempts. This account is locked for ${lockFor} minutes.`)
      }
      await saveAuth(user.id, { ...auth, fails })
      const left = limit > 0 ? ` ${limit - fails} attempt${limit - fails === 1 ? '' : 's'} left.` : ''
      throw new HttpError(401, `${message}${left}`)
    }
    const locked = (auth) => {
      if (auth.lockedUntil && auth.lockedUntil > now)
        throw new HttpError(429, `This account is locked after too many failed attempts. Try again in ${minutes(auth.lockedUntil - now)} minutes, or ask an administrator to unlock it.`)
    }

    // Second step: the code from the authenticator app.
    if (body.ticket) {
      const ticket = readTicket(secret, body.ticket)
      if (!ticket || ticket.k !== '2fa') throw new HttpError(401, 'That sign-in attempt has expired. Enter your password again.')
      const [user, hash, saved] = await Promise.all([store.get('users', ticket.u), store.getHash(ticket.u), store.get('_auth', ticket.u)])
      const auth = saved || {}
      if (!user?.active || !hash || !auth.totp?.enabled) throw new HttpError(401, 'Please sign in again.')
      locked(auth)
      const code = String(body.code || '').trim()
      let nextAuth = auth
      if (!verifyTotp(auth.totp.secret, code)) {
        const used = backupHash(code)
        if (!(auth.totp.backup || []).includes(used)) await failed(user, auth, 'That code is not correct.')
        nextAuth = { ...auth, totp: { ...auth.totp, backup: auth.totp.backup.filter((h) => h !== used) } }
      }
      const started = await startSession(req, store, secret, { user, hash, auth: nextAuth, settings })
      return send(res, 200, { user: started.user }, { 'Set-Cookie': started.cookie })
    }

    const user = await store.findUserByEmail(String(body.email || '').trim())
    if (!user) throw new HttpError(401, 'No account found for that email address.')
    const auth = (await store.get('_auth', user.id)) || {}
    locked(auth)
    const hash = await store.getHash(user.id)
    const given = String(body.password || '')
    const ok = (await verifyPassword(given, hash)) || (given !== given.trim() && (await verifyPassword(given.trim(), hash)))
    if (!ok) await failed(user, auth, 'Incorrect password. Please try again.')
    if (!user.active) {
      throw new HttpError(
        403,
        user.pending === 'email'
          ? 'Confirm your email address first: open the link we sent you.'
          : user.pending === 'approval'
            ? 'Your account is waiting for an administrator to activate it.'
            : 'This account is inactive. Contact your administrator.',
      )
    }

    if (twoFactorRequired(user, settings) && auth.totp?.enabled) {
      if (auth.fails) await saveAuth(user.id, { ...auth, fails: 0 })
      return send(res, 200, { twoFactor: true, ticket: signTicket(secret, { k: '2fa', u: user.id }, 5 * 60000) })
    }

    const started = await startSession(req, store, secret, { user, hash, auth, settings })
    send(res, 200, { user: started.user }, { 'Set-Cookie': started.cookie })
  },

  async logout(req, res) {
    send(res, 200, { ok: true }, { 'Set-Cookie': clearedCookie(req) })
  },

  async data(req, res) {
    const { store, secret } = await openStore()
    const s = await session(req, store, secret, { background: queryOf(req).has('bg') })
    let db = await loadDb(store)
    const headers = { 'Set-Cookie': s.renew }
    const gate = gateFor(s.user, s.auth, s.settings, { twoFactor: twoFactorRequired(s.user, s.settings) })
    if (gate) return send(res, 200, { me: s.user.id, gate, data: gatedView(db, s.user) }, headers)

    if (await runTick(store, db, req)) db = await loadDb(store)
    const me = db.collections.users.find((u) => u.id === s.user.id) || s.user
    const { values: secrets } = await loadSecrets(store)
    send(
      res,
      200,
      {
        me: me.id,
        gate: null,
        data: viewFor(db, me),
        // What the server is able to do right now, so pages can say so instead of failing later.
        server: {
          stripe: !!secrets.stripeSecretKey,
          email: emailReady(s.settings, secrets),
          twoFactor: !!s.auth.totp?.enabled,
        },
      },
      headers,
    )
  },

  async sync(req, res) {
    if (req.method !== 'POST') throw new HttpError(405, 'Use POST.')
    const { store, secret } = await openStore()
    const s = await session(req, store, secret)
    if (gateFor(s.user, s.auth, s.settings, { twoFactor: twoFactorRequired(s.user, s.settings) }))
      throw new HttpError(403, 'Finish signing in first.')
    const payload = await readJson(req)
    const db = await loadDb(store)
    const plan = authorize(db, s.user, payload, { ip: clientIp(req) })

    // New passwords are checked, hashed and stamped on the account they belong to.
    const now = new Date().toISOString()
    const hashes = []
    const plain = {}
    for (const { userId, password } of plan.passwords) {
      const problem = passwordProblem(password, s.settings)
      if (problem) {
        plan.rejected.push({ collection: 'users', id: userId, why: `Password not saved: ${problem}`, show: true })
        continue
      }
      hashes.push({ userId, hash: await hashPassword(password) })
      plain[userId] = password
      const row = plan.upserts.find((u) => u.collection === 'users' && u.id === userId)
      const record = row?.data || db.collections.users.find((u) => u.id === userId)
      if (!record) continue
      const stamped = {
        ...record,
        passwordChangedAt: now,
        // "New password at first sign-in": anyone given a password by somebody else picks their own.
        mustChangePassword: !!s.settings.users.forcePasswordReset && userId !== s.user.id,
      }
      if (row) row.data = stamped
      else plan.upserts.push({ collection: 'users', id: userId, data: stamped })
    }

    await store.setHashes(hashes)
    const { changed } = await commit(store, db, plan, { req, quiet: isAdmin(s.user) && payload.quiet === true, passwords: plain })
    const gone = plan.deletes.filter((d) => d.collection === 'users').map((d) => d.id)
    await store.removeHashes(gone)
    await store.remove(gone.map((id) => ({ collection: '_auth', id })))
    await recordHistory(store, db, s.user, plan, hashes.map((h) => h.userId))

    // An admin who changes their own password stays signed in on this device.
    const mine = hashes.find((h) => h.userId === s.user.id)
    const cookie = mine ? sessionCookie(req, createToken(secret, s.user.id, mine.hash, { sid: s.token.s || '' })) : s.renew
    send(res, 200, { ok: true, rejected: plan.rejected, changed }, { 'Set-Cookie': cookie })
  },

  async password(req, res) {
    if (req.method !== 'POST') throw new HttpError(405, 'Use POST.')
    const { store, secret } = await openStore()
    const s = await session(req, store, secret)
    const gate = gateFor(s.user, s.auth, s.settings, { twoFactor: false })
    // Passwords are managed by administrators; everyone else chooses one only when the portal asks them to.
    if (!isAdmin(s.user) && !gate?.password) throw new HttpError(403, 'Only an administrator can change passwords.')
    const { current = '', next = '' } = await readJson(req)
    if (!(await verifyPassword(String(current), s.hash))) throw new HttpError(400, 'Your current password is not correct.')
    const problem = passwordProblem(next, s.settings)
    if (problem) throw new HttpError(400, problem)
    if (gate?.password && next === current) throw new HttpError(400, 'Choose a password that is different from the current one.')
    const hash = await hashPassword(next)
    await store.setHashes([{ userId: s.user.id, hash }])
    await store.upsert([
      { collection: 'users', id: s.user.id, data: { ...s.user, mustChangePassword: false, passwordChangedAt: new Date().toISOString() } },
    ])
    const db = await loadDb(store)
    await recordHistory(store, db, s.user, { upserts: [], deletes: [] }, [s.user.id])
    send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, createToken(secret, s.user.id, hash, { sid: s.token.s || '' })) })
  },

  rpc,
  oauth,

  /** The daily timer. Safe to call by hand: it only runs what is already due. */
  async cron(req, res) {
    const { store } = await openStore()
    const wanted = process.env.CRON_SECRET
    if (wanted && req.headers.authorization !== `Bearer ${wanted}`) throw new HttpError(401, 'Not allowed.')
    const changed = await runTick(store, await loadDb(store), req, { force: true })
    send(res, 200, { ok: true, changed })
  },

  v1: apiV1,
}

export async function handle(req, res, route) {
  try {
    const fn = routes[route]
    if (!fn) throw new HttpError(404, 'Unknown API route.')
    await fn(req, res)
  } catch (err) {
    const status = err instanceof HttpError ? err.status : err instanceof SyntaxError ? 400 : 500
    if (status === 500) console.error(err)
    send(res, status, { error: status === 500 ? 'Something went wrong on the server.' : err.message, ...(err.extra || {}) })
  }
}

export const ROUTES = Object.keys(routes)
