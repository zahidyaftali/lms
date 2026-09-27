/**
 * The portal's API. Each route is a Vercel Function in /api (see api/*.js); in
 * development the same handler is mounted by the Vite plugin in vite.config.js.
 *
 *   GET  /api/health         which database is connected (none = browser-only mode)
 *   GET  /api/public         branding the sign-in page shows
 *   GET  /api/public-course  a course with public sharing on (?id=)
 *   POST /api/login          { email, password } -> session cookie
 *   POST /api/logout
 *   GET  /api/data           everything the signed-in user may see
 *   POST /api/sync           record changes from the browser, checked per role
 *   POST /api/password       { current, next } for the signed-in user
 */
import { getStore, storeKind } from './store.js'
import { COLLECTIONS, assemble, authorize, publicSettings, viewFor, withoutPassword } from './access.js'
import {
  clearedCookie,
  createToken,
  hashPassword,
  newSecret,
  passwordProblem,
  readCookie,
  readToken,
  sessionCookie,
  tokenMatchesHash,
  verifyPassword,
} from './auth.js'

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function send(res, status, body, headers = {}) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v)
  res.end(JSON.stringify(body))
}

async function readJson(req) {
  if (req.body !== undefined && req.body !== null && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {}
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 8 * 1024 * 1024) throw new HttpError(413, 'That upload is too large.')
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  return text ? JSON.parse(text) : {}
}

/* -------------------------------------------------------------- first start */

let ready = null
async function openStore() {
  const store = await getStore()
  if (!store) throw new HttpError(503, 'No database is connected.')
  ready ||= (async () => {
    await store.ensureSchema()
    if ((await store.countUsers()) === 0) await seed(store)
    let secret = await store.get('_system', 'secret')
    if (!secret) {
      secret = { value: newSecret() }
      await store.upsert([{ collection: '_system', id: 'secret', data: secret }])
    }
    return secret.value
  })().catch((err) => {
    ready = null
    throw err
  })
  const secret = await ready
  return { store, secret }
}

/** A new, empty database starts from the portal's sample data and copied courses. */
async function seed(store) {
  const { default: data } = await import('./seed-data.js')
  const rows = [{ collection: 'settings', id: 'portal', data: data.settings }]
  rows.push({ collection: 'meta', id: 'courseImports', data: { value: data.courseImports || [] } })
  for (const coll of COLLECTIONS) {
    for (const record of data[coll] || []) {
      rows.push({ collection: coll, id: record.id, data: coll === 'users' ? withoutPassword(record) : record })
    }
  }
  await store.upsert(rows)
  const hashes = []
  for (const user of data.users || []) {
    if (user.password) hashes.push({ userId: user.id, hash: await hashPassword(user.password) })
  }
  await store.setHashes(hashes)
}

async function loadDb(store) {
  return assemble(await store.all())
}

/** The signed-in user, or a 401. Deactivated accounts and changed passwords end the session. */
async function currentUser(req, store, secret) {
  const token = readToken(secret, readCookie(req))
  if (!token) throw new HttpError(401, 'Please sign in.')
  const user = await store.get('users', token.u)
  const hash = user && (await store.getHash(user.id))
  if (!user || !user.active || !hash || !tokenMatchesHash(secret, token, hash)) throw new HttpError(401, 'Please sign in again.')
  return user
}

/* ------------------------------------------------------------------- routes */

const routes = {
  async health(req, res) {
    send(res, 200, { ok: true, database: storeKind() })
  },

  async public(req, res) {
    const { store } = await openStore()
    send(res, 200, { settings: publicSettings((await store.get('settings', 'portal')) || {}) })
  },

  async 'public-course'(req, res) {
    const { store } = await openStore()
    const id = new URL(req.url, 'http://x').searchParams.get('id') || ''
    const course = await store.get('courses', id)
    if (!course || course.status !== 'active' || !course.publicSharing) throw new HttpError(404, 'This course is not shared.')
    send(res, 200, { course })
  },

  async login(req, res) {
    if (req.method !== 'POST') throw new HttpError(405, 'Use POST.')
    const { store, secret } = await openStore()
    const { email = '', password = '' } = await readJson(req)
    const user = await store.findUserByEmail(String(email).trim())
    if (!user) throw new HttpError(401, 'No account found for that email address.')
    const hash = await store.getHash(user.id)
    const given = String(password)
    const ok = (await verifyPassword(given, hash)) || (given !== given.trim() && (await verifyPassword(given.trim(), hash)))
    if (!ok) throw new HttpError(401, 'Incorrect password. Please try again.')
    if (!user.active) throw new HttpError(403, 'This account is inactive. Contact your administrator.')

    const signedIn = { ...user, lastLogin: new Date().toISOString() }
    await store.upsert([
      { collection: 'users', id: user.id, data: signedIn },
      {
        collection: 'events',
        id: `ev_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
        data: { type: 'login', text: 'signed in', actorId: user.id, targetId: null, at: signedIn.lastLogin },
      },
    ])
    send(res, 200, { user: signedIn }, { 'Set-Cookie': sessionCookie(req, createToken(secret, user.id, hash)) })
  },

  async logout(req, res) {
    send(res, 200, { ok: true }, { 'Set-Cookie': clearedCookie(req) })
  },

  async data(req, res) {
    const { store, secret } = await openStore()
    const me = await currentUser(req, store, secret)
    send(res, 200, { me: me.id, data: viewFor(await loadDb(store), me) })
  },

  async sync(req, res) {
    if (req.method !== 'POST') throw new HttpError(405, 'Use POST.')
    const { store, secret } = await openStore()
    const me = await currentUser(req, store, secret)
    const payload = await readJson(req)
    const db = await loadDb(store)
    const plan = authorize(db, me, payload)

    const minLength = Number(db.settings?.users?.passwordMinLength) || 8
    const hashes = []
    for (const { userId, password } of plan.passwords) {
      const problem = passwordProblem(password, minLength)
      if (problem) plan.rejected.push({ collection: 'users', id: userId, why: problem })
      else hashes.push({ userId, hash: await hashPassword(password) })
    }

    await store.upsert(plan.upserts)
    await store.remove(plan.deletes)
    await store.removeHashes(plan.deletes.filter((d) => d.collection === 'users').map((d) => d.id))
    await store.setHashes(hashes)

    // An admin who changes their own password stays signed in on this device.
    const headers = {}
    const mine = hashes.find((h) => h.userId === me.id)
    if (mine) headers['Set-Cookie'] = sessionCookie(req, createToken(secret, me.id, mine.hash))
    send(res, 200, { ok: true, rejected: plan.rejected }, headers)
  },

  async password(req, res) {
    if (req.method !== 'POST') throw new HttpError(405, 'Use POST.')
    const { store, secret } = await openStore()
    const me = await currentUser(req, store, secret)
    const { current = '', next = '' } = await readJson(req)
    if (!(await verifyPassword(String(current), await store.getHash(me.id))))
      throw new HttpError(400, 'Your current password is not correct.')
    const settings = (await store.get('settings', 'portal')) || {}
    const problem = passwordProblem(next, Number(settings.users?.passwordMinLength) || 8)
    if (problem) throw new HttpError(400, problem)
    const hash = await hashPassword(next)
    await store.setHashes([{ userId: me.id, hash }])
    send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, createToken(secret, me.id, hash)) })
  },
}

export async function handle(req, res, route) {
  try {
    const fn = routes[route]
    if (!fn) throw new HttpError(404, 'Unknown API route.')
    await fn(req, res)
  } catch (err) {
    const status = err instanceof HttpError ? err.status : err instanceof SyntaxError ? 400 : 500
    if (status === 500) console.error(err)
    send(res, status, { error: status === 500 ? 'Something went wrong on the server.' : err.message })
  }
}

export const ROUTES = Object.keys(routes)
