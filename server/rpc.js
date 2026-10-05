/**
 * Single actions the browser asks the server to carry out, at /api/rpc?do=<name>.
 * Everything here either needs a secret the browser must never hold (payments,
 * email, two-factor) or must be decided by the server (prices, who may join).
 */
import { gateFor, isAdmin, stateOf } from './access.js'
import { withSettingDefaults } from '../src/lib/settingsDefaults.js'
import { currencyCode, paymentMethods, quote, settleOrder } from '../src/lib/commerce.js'
import { allStats, rewardDiscount, scoreOf } from '../src/lib/gamification.js'
import { mailRecord } from '../src/lib/engine.js'
import {
  certificateExpired,
  certificateExpiry,
  displayName,
  emailDomainAllowed,
  ipAllowed,
  newEnrollment,
  pathProgress,
  termsVersion,
  twoFactorRequired,
} from '../src/lib/rules.js'
import {
  SECRET_NAMES,
  bambooEmployees,
  bbbJoin,
  emailReady,
  loadSecrets,
  oauthProfile,
  oauthStartUrl,
  paypalUrl,
  secretStatus,
  sendEmail,
  signInProviders,
  stripeCheckout,
  stripeSessionPaid,
  zoomMeeting,
} from './services.js'
import {
  HttpError,
  commit,
  deliver,
  loadDb,
  newUserRows,
  openStore,
  queryOf,
  readJson,
  recordHistory,
  redirect,
  runTick,
  send,
  session,
  startSession,
} from './core.js'
import {
  backupHash,
  clientIp,
  hashPassword,
  newBackupCodes,
  newId,
  newSecret,
  newTotpSecret,
  originOf,
  passwordProblem,
  readTicket,
  sha256,
  signTicket,
  totpUri,
  verifyPassword,
  verifyTotp,
} from './auth.js'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_FILE = 4 * 1024 * 1024
const isStaff = (u) => isAdmin(u) || u?.role === 'instructor'
const iso = () => new Date().toISOString()
const row = (collection, data) => ({ collection, id: data.id, data })

/** A note in every administrator's portal inbox. */
function tellAdmins(db, subject, body) {
  return db.collections.users
    .filter((u) => u.active && isAdmin(u))
    .map((u) => row('messages', { id: newId('m'), fromId: null, system: true, toId: u.id, subject, body, sentAt: iso(), read: false }))
}

async function saveAuth(store, userId, auth) {
  await store.upsert([{ collection: '_auth', id: userId, data: { ...auth, userId } }])
}

/* ----------------------------------------------------------------- payments */

/** Marks an order paid and carries out what was bought, then emails the invoice when invoices are on. */
async function settle(c, db, order) {
  const settings = withSettingDefaults(db.settings)
  const state = stateOf(db)
  const out = settleOrder(state, order, { now: Date.now(), makeId: newId })
  const plan = { upserts: [row('orders', out.order)], deletes: [] }
  if (out.user) plan.upserts.push(row('users', out.user))
  if (out.enrollment) plan.upserts.push(row('enrollments', out.enrollment))
  if (out.settings) plan.upserts.push({ collection: 'settings', id: 'portal', data: out.settings })
  await commit(c.store, db, plan, { req: c.req })

  const buyer = db.collections.users.find((u) => u.id === order.userId)
  if (settings.ecommerce.invoices?.enabled && buyer?.email && Number(out.order.amount) > 0) {
    const mail = mailRecord(newId, Date.now(), {
      to: buyer.email,
      toUserId: buyer.id,
      kind: 'invoice',
      subject: `Invoice ${out.order.invoiceNo} from ${settings.siteName}`,
      body: [
        `Invoice ${out.order.invoiceNo}`,
        `Date: ${new Date(out.order.paidAt).toLocaleDateString('en-US')}`,
        '',
        `Billed to: ${displayName(buyer)} <${buyer.email}>`,
        `For: ${out.order.name}`,
        `Amount paid: ${Number(out.order.amount).toFixed(2)} ${out.order.currency}`,
        '',
        settings.ecommerce.invoices.details || settings.siteName,
        settings.ecommerce.invoices.note || '',
      ].join('\n'),
    })
    await c.store.upsert([row('outbox', mail)])
    await deliver(c.store, settings, { mails: [mail] })
  }
  return out.order
}

/* ------------------------------------------------------------------ actions */

const actions = {
  /* ---- sign-up ---- */

  'signup.challenge': {
    public: true,
    async run({ secret }) {
      const a = 2 + Math.floor(Math.random() * 8)
      const b = 1 + Math.floor(Math.random() * 9)
      return { question: `What is ${a} + ${b}?`, ticket: signTicket(secret, { k: 'cap', sum: a + b }, 15 * 60000) }
    },
  },

  signup: {
    public: true,
    async run(c) {
      const { store, secret, body, req } = c
      const db = await loadDb(store)
      const settings = withSettingDefaults(db.settings)
      const u = settings.users
      if (!u.selfRegistration) throw new HttpError(403, 'This portal does not accept sign-ups. Ask the program office for an account.')
      if (!ipAllowed(clientIp(req), settings.security.allowedIps)) throw new HttpError(403, 'Signing up is not allowed from this network.')

      const firstName = String(body.firstName || '').trim()
      const lastName = String(body.lastName || '').trim()
      const email = String(body.email || '').trim().toLowerCase()
      if (!firstName || !lastName) throw new HttpError(400, 'Enter your first and last name.')
      if (!EMAIL.test(email)) throw new HttpError(400, 'Enter a valid email address.')
      if (!emailDomainAllowed(email, u.allowedDomains)) throw new HttpError(400, 'Sign-up is limited to approved email addresses. Use the address your organization gave you.')
      const problem = passwordProblem(body.password, settings)
      if (problem) throw new HttpError(400, problem)
      if (u.termsOn && String(u.terms || '').trim() && !body.acceptTerms) throw new HttpError(400, 'Accept the terms of service to continue.')
      const custom = {}
      for (const field of u.customFields || []) {
        const value = body.custom?.[field.id]
        if (field.required && (value == null || value === '' || value === false)) throw new HttpError(400, `${field.name} is required.`)
        if (value != null && value !== '') custom[field.id] = field.type === 'Checkbox' ? !!value : String(value).slice(0, 300)
      }
      if (u.verification === 'CAPTCHA') {
        const ticket = readTicket(secret, body.challenge)
        if (!ticket || ticket.k !== 'cap' || Number(body.answer) !== ticket.sum) throw new HttpError(400, 'That answer is not right. Try the question again.')
      }
      if (await store.findUserByEmail(email)) throw new HttpError(409, 'An account with this email address already exists. Sign in instead.')
      const limit = Number(settings.subscription?.userLimit) || 0
      if (limit > 0 && db.collections.users.filter((x) => x.active).length >= limit)
        throw new HttpError(403, 'The portal is not taking new accounts right now. Contact the program office.')

      const { values: secrets } = await loadSecrets(store)
      // Email verification needs a working email service; without one an administrator activates the account instead.
      const pending =
        u.verification === 'Email verification' ? (emailReady(settings, secrets) ? 'email' : 'approval') : u.verification === 'Administrator activation' ? 'approval' : null
      const { user, rows } = newUserRows(db, settings, {
        firstName,
        lastName,
        email,
        active: !pending,
        pending,
        selfRegistered: true,
        custom,
        ...(body.acceptTerms && u.termsOn ? { termsAccepted: termsVersion(u.terms), termsAcceptedAt: iso() } : {}),
      })
      await store.setHashes([{ userId: user.id, hash: await hashPassword(body.password) }])
      const plan = { upserts: pending ? [rows[0]] : rows, deletes: [] }
      if (pending === 'approval')
        plan.upserts.push(...tellAdmins(db, `New sign-up: ${firstName} ${lastName}`, `${firstName} ${lastName} (${email}) signed up and is waiting to be activated on the Users page.`))
      await commit(store, db, plan, { req })

      if (pending === 'email') {
        const link = `${originOf(req)}/verify-email?token=${encodeURIComponent(signTicket(secret, { k: 'verify', u: user.id }, 3 * 86400000))}`
        const mail = mailRecord(newId, Date.now(), {
          to: email,
          toUserId: user.id,
          kind: 'verification',
          subject: `Confirm your email address for ${settings.siteName}`,
          body: `Hello ${firstName},\n\nOpen this link to confirm your email address and activate your account:\n\n${link}\n\nThe link works for three days.\n\n${settings.siteName}`,
        })
        await store.upsert([row('outbox', mail)])
        await deliver(store, settings, { mails: [mail] })
      }
      return { ok: true, status: pending || 'active' }
    },
  },

  verifyEmail: {
    public: true,
    async run({ store, secret, body, req }) {
      const ticket = readTicket(secret, body.token)
      if (!ticket || ticket.k !== 'verify') throw new HttpError(400, 'This link has expired or was already used. Sign up again or contact the program office.')
      const db = await loadDb(store)
      const user = db.collections.users.find((u) => u.id === ticket.u)
      if (!user) throw new HttpError(404, 'This account no longer exists.')
      if (user.pending === 'email') {
        const settings = withSettingDefaults(db.settings)
        const group = db.collections.groups.find((g) => g.id === settings.users.defaultGroupId)
        const upserts = [row('users', { ...user, active: true, pending: null, emailVerified: true })]
        for (const courseId of group?.courseIds || []) upserts.push(row('enrollments', newEnrollment(newId('en'), user.id, courseId, iso())))
        await commit(store, db, { upserts, deletes: [] }, { req })
      }
      return { ok: true }
    },
  },

  'certificate.verify': {
    public: true,
    async run({ store, body }) {
      const code = String(body.code || '').trim().toUpperCase()
      if (!code) throw new HttpError(400, 'Enter a certificate number.')
      const db = await loadDb(store)
      const settings = withSettingDefaults(db.settings)
      const cert = db.collections.certificates.find((x) => String(x.code).toUpperCase() === code)
      if (!cert) return { found: false }
      const holder = db.collections.users.find((u) => u.id === cert.userId)
      const subject = cert.pathId ? db.collections.learningPaths.find((p) => p.id === cert.pathId) : db.collections.courses.find((x) => x.id === cert.courseId)
      return {
        found: true,
        code: cert.code,
        name: holder ? `${holder.firstName} ${holder.lastName}`.trim() : 'Former learner',
        course: subject?.name || 'A course that is no longer offered',
        issuedAt: cert.issuedAt,
        expiresAt: certificateExpiry(cert, settings),
        expired: certificateExpired(cert, settings),
      }
    },
  },

  /* ---- finishing sign-in ---- */

  'terms.accept': {
    gated: true,
    async run({ store, s }) {
      if (!s.settings.users.termsOn) return { ok: true }
      await store.upsert([row('users', { ...s.user, termsAccepted: termsVersion(s.settings.users.terms), termsAcceptedAt: iso() })])
      return { ok: true }
    },
  },

  'twofactor.setup': {
    gated: true,
    async run({ store, s }) {
      if (s.auth.totp?.enabled) throw new HttpError(400, 'Two-factor authentication is already on for this account.')
      const secret = newTotpSecret()
      await saveAuth(store, s.user.id, { ...s.auth, totp: { secret, enabled: false } })
      return { secret, uri: totpUri(secret, s.user.email, s.settings.siteName) }
    },
  },

  'twofactor.enable': {
    gated: true,
    async run({ store, s, body }) {
      const pending = s.auth.totp
      if (!pending?.secret) throw new HttpError(400, 'Start the set-up again.')
      if (!verifyTotp(pending.secret, body.code)) throw new HttpError(400, 'That code is not correct. Check the time on your phone and try the newest code.')
      const codes = newBackupCodes()
      await saveAuth(store, s.user.id, { ...s.auth, totp: { secret: pending.secret, enabled: true, since: iso(), backup: codes.map(backupHash) } })
      return { ok: true, backupCodes: codes }
    },
  },

  'twofactor.disable': {
    async run({ store, s, body }) {
      if (twoFactorRequired(s.user, s.settings)) throw new HttpError(403, 'Two-factor authentication is required for your account.')
      if (!(await verifyPassword(String(body.password || ''), s.hash))) throw new HttpError(400, 'Your password is not correct.')
      const { totp, ...rest } = s.auth
      await saveAuth(store, s.user.id, rest)
      return { ok: true }
    },
  },

  /* ---- account security, for administrators ---- */

  'accounts.security': {
    admin: true,
    async run({ store }) {
      const now = Date.now()
      const out = {}
      for (const a of await store.allIn('_auth')) {
        if (!a.userId) continue
        out[a.userId] = { twoFactor: !!a.totp?.enabled, locked: !!(a.lockedUntil && a.lockedUntil > now) }
      }
      return { accounts: out }
    },
  },

  'account.unlock': {
    admin: true,
    async run({ store, body }) {
      const auth = (await store.get('_auth', body.userId)) || {}
      await saveAuth(store, body.userId, { ...auth, fails: 0, lockedUntil: null })
      return { ok: true }
    },
  },

  'twofactor.reset': {
    admin: true,
    async run({ store, body }) {
      const { totp, ...rest } = (await store.get('_auth', body.userId)) || {}
      await saveAuth(store, body.userId, rest)
      return { ok: true }
    },
  },

  /* ---- buying a course ---- */

  'checkout.quote': {
    async run(c) {
      const db = await loadDb(c.store)
      return priced(c, db, { ...(await loadSecrets(c.store)) })
    },
  },

  checkout: {
    async run(c) {
      const { store, body, req } = c
      const db = await loadDb(store)
      const { values: secrets } = await loadSecrets(store)
      const p = await priced(c, db, { values: secrets })
      if (p.quote.error) throw new HttpError(400, p.quote.error)
      const { settings, user, course, kind } = p
      const total = p.quote.total
      const method = total === 0 ? (p.trial ? 'trial' : p.quote.covered ? 'subscription' : 'free') : String(body.method || '')
      if (total > 0 && !p.methods.some((m) => m.id === method)) throw new HttpError(400, 'Choose how you would like to pay.')

      const order = {
        id: newId('or'),
        userId: user.id,
        kind,
        courseId: course?.id || null,
        name: kind === 'subscription' ? `${settings.siteName} subscription` : course.name,
        list: p.quote.list,
        amount: total,
        lines: p.quote.lines,
        currency: currencyCode(settings),
        coupon: p.quote.coupon?.code || '',
        trial: !!p.trial,
        method,
        status: 'pending',
        at: iso(),
      }

      if (total === 0) return { order: await settle(c, db, order) }

      if (method === 'credits') {
        const credits = Number(user.credits) || 0
        if (credits < total) throw new HttpError(400, `You have ${credits} credits; this costs ${total}.`)
        return { order: await settle(c, db, order) }
      }

      const origin = originOf(req)
      if (method === 'stripe') {
        const started = await stripeCheckout(secrets.stripeSecretKey, { order, name: order.name, email: user.email, currency: order.currency, origin })
        if (!started.ok) throw new HttpError(502, started.error)
        await store.upsert([row('orders', { ...order, ref: started.sessionId })])
        return { redirect: started.url }
      }

      const waiting = { ...order, status: 'pending' }
      await commit(
        store,
        db,
        {
          upserts: [
            row('orders', waiting),
            ...tellAdmins(db, `Payment to confirm: ${order.name}`, `${displayName(user)} (${user.email}) chose to pay ${total.toFixed(2)} ${order.currency} ${method === 'paypal' ? 'with PayPal' : 'at the program office'} for ${order.name}. Mark the order as paid under Reports → Sales once the money has arrived.`),
          ],
          deletes: [],
        },
        { req },
      )
      if (method === 'paypal') return { order: waiting, redirect: paypalUrl(settings.ecommerce.paypalEmail, { order, name: order.name, currency: order.currency, origin }) }
      return { order: waiting, instructions: settings.ecommerce.offline?.instructions || '' }
    },
  },

  'checkout.confirm': {
    async run(c) {
      const { store, body, s } = c
      const db = await loadDb(store)
      const order = db.collections.orders.find((o) => o.id === body.orderId && o.userId === s.user.id)
      if (!order) throw new HttpError(404, 'That order was not found.')
      if (order.status === 'paid') return { order }
      if (order.method !== 'stripe') return { order }
      const { values: secrets } = await loadSecrets(store)
      const check = await stripeSessionPaid(secrets.stripeSecretKey, order.ref || body.sessionId, order.id)
      if (!check.ok) throw new HttpError(502, check.error)
      if (!check.paid) return { order }
      return { order: await settle(c, db, { ...order, paymentRef: check.ref }) }
    },
  },

  'order.settle': {
    admin: true,
    async run(c) {
      const db = await loadDb(c.store)
      const order = db.collections.orders.find((o) => o.id === c.body.orderId)
      if (!order) throw new HttpError(404, 'That order was not found.')
      if (order.status === 'paid') return { order }
      return { order: await settle(c, db, { ...order, confirmedBy: c.s.user.id }) }
    },
  },

  'order.cancel': {
    async run({ store, body, s }) {
      const order = await store.get('orders', body.orderId)
      if (!order || (!isAdmin(s.user) && order.userId !== s.user.id)) throw new HttpError(404, 'That order was not found.')
      if (order.status !== 'pending') throw new HttpError(400, 'Only an order that is still waiting for payment can be cancelled.')
      const next = { ...order, status: 'cancelled', cancelledAt: iso() }
      await store.upsert([row('orders', next)])
      return { order: next }
    },
  },

  /* ---- learning paths ---- */

  'path.join': {
    async run({ store, body, s, req }) {
      const db = await loadDb(store)
      const path = db.collections.learningPaths.find((p) => p.id === body.pathId)
      if (!path || path.status !== 'active' || !path.selfEnroll) throw new HttpError(404, 'That learning path is not open to join.')
      if ((path.userIds || []).includes(s.user.id)) return { ok: true }
      const joined = { ...path, userIds: [...(path.userIds || []), s.user.id], joined: { ...(path.joined || {}), [s.user.id]: iso() } }
      const state = { ...stateOf(db), learningPaths: db.collections.learningPaths.map((p) => (p.id === path.id ? joined : p)) }
      const progress = pathProgress(joined, s.user.id, state)
      const open = path.ordered ? (progress.next ? [progress.next] : []) : progress.steps
      const upserts = [row('learningPaths', joined)]
      for (const step of open) if (!step.enrollment) upserts.push(row('enrollments', newEnrollment(newId('en'), s.user.id, step.courseId, iso(), { pathId: path.id })))
      await commit(store, db, { upserts, deletes: [] }, { req })
      return { ok: true }
    },
  },

  /* ---- files ---- */

  'file.put': {
    async run({ store, body, s }) {
      const data = String(body.data || '')
      const size = Math.floor((data.length * 3) / 4)
      if (!data || !body.name) throw new HttpError(400, 'No file was sent.')
      if (size > MAX_FILE) throw new HttpError(413, 'Files larger than 4 MB cannot be stored in the shared database. Use a YouTube or Vimeo link for video.')
      const file = {
        id: newId('srv'),
        name: String(body.name).slice(0, 200),
        type: String(body.type || 'application/octet-stream').slice(0, 120),
        size,
        owner: s.user.id,
        kind: body.kind === 'submission' ? 'submission' : 'course',
        data,
      }
      await store.putFile({ ...file, owner: `${file.kind}:${file.owner}` })
      return { id: file.id, name: file.name, type: file.type, size }
    },
  },

  'file.get': {
    async run({ store, query, s, res }) {
      const file = await store.getFile(String(query.get('id') || ''))
      if (!file) throw new HttpError(404, 'That file no longer exists.')
      // A learner's assignment upload is for them and the people who grade it.
      const [kind, owner] = String(file.owner || '').split(':')
      if (kind === 'submission' && owner !== s.user.id && !isStaff(s.user)) throw new HttpError(403, 'That file is not yours.')
      const bytes = Buffer.from(file.data, 'base64')
      res.statusCode = 200
      res.setHeader('Content-Type', file.type || 'application/octet-stream')
      res.setHeader('Content-Length', String(bytes.length))
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.name)}"`)
      res.setHeader('Cache-Control', 'private, max-age=3600')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.end(bytes)
    },
  },

  /* ---- connections ---- */

  'secrets.status': {
    admin: true,
    async run({ store, s }) {
      const loaded = await loadSecrets(store)
      return { secrets: secretStatus(loaded), email: emailReady(s.settings, loaded.values), signIn: signInProviders(s.settings, loaded.values) }
    },
  },

  'secrets.set': {
    admin: true,
    async run({ store, body }) {
      if (!SECRET_NAMES[body.name]) throw new HttpError(400, 'Unknown secret.')
      const saved = (await store.get('_secrets', 'values')) || {}
      const value = String(body.value || '').trim()
      if (value) saved[body.name] = value
      else delete saved[body.name]
      await store.upsert([{ collection: '_secrets', id: 'values', data: saved }])
      return { secrets: secretStatus(await loadSecrets(store)) }
    },
  },

  'apikeys.list': {
    admin: true,
    async run({ store }) {
      const keys = await store.allIn('_apikeys')
      return { keys: keys.map(({ hash, ...rest }) => rest).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) }
    },
  },

  'apikeys.create': {
    admin: true,
    async run({ store, body, s }) {
      const key = `ga_${newSecret()}`
      const record = { id: newId('key'), name: String(body.name || 'API key').slice(0, 80), prefix: key.slice(0, 9), hash: sha256(key), createdAt: iso(), createdBy: s.user.id, lastUsedAt: null }
      await store.upsert([{ collection: '_apikeys', id: record.id, data: record }])
      const { hash, ...shown } = record
      return { key, record: shown }
    },
  },

  'apikeys.revoke': {
    admin: true,
    async run({ store, body }) {
      await store.remove([{ collection: '_apikeys', id: String(body.id || '') }])
      return { ok: true }
    },
  },

  'email.test': {
    admin: true,
    async run({ store, s, body }) {
      const { values: secrets } = await loadSecrets(store)
      const to = EMAIL.test(body.to || '') ? body.to : s.user.email
      const mail = mailRecord(newId, Date.now(), {
        to,
        toUserId: s.user.id,
        kind: 'test',
        subject: `Test message from ${s.settings.siteName}`,
        body: `This is a test message from ${s.settings.siteName}. If you are reading it, email delivery is working.`,
      })
      const result = await sendEmail(s.settings, secrets, mail)
      await store.upsert([row('outbox', { ...mail, status: result.ok ? 'sent' : result.skipped ? 'skipped' : 'failed', error: result.ok ? '' : result.error, sentAt: result.ok ? iso() : null })])
      if (!result.ok) throw new HttpError(400, result.error)
      return { ok: true, to }
    },
  },

  'outbox.retry': {
    admin: true,
    async run({ store, s, body }) {
      const mail = await store.get('outbox', String(body.id || ''))
      if (!mail) throw new HttpError(404, 'That message was not found.')
      await deliver(store, s.settings, { mails: [mail] })
      return { mail: await store.get('outbox', mail.id) }
    },
  },

  'meeting.create': {
    async run({ store, s, body }) {
      if (!isStaff(s.user)) throw new HttpError(403, 'Instructors and administrators only.')
      const full = withSettingDefaults(await store.get('settings', 'portal'))
      const { values: secrets } = await loadSecrets(store)
      const config = full.integrations?.[body.provider]
      if (!config?.enabled) throw new HttpError(400, 'That video-conference service is not switched on in Account & Settings → Integrations.')
      if (body.provider === 'zoom') {
        const made = await zoomMeeting(config, secrets.zoomClientSecret, { topic: body.topic || 'Session', start: body.start, durationMin: Number(body.durationMin) || 60 })
        if (!made.ok) throw new HttpError(502, made.error)
        return { url: made.url, meetingId: made.id }
      }
      if (body.provider === 'bbb') {
        if (!config.serverUrl || !secrets.bbbSecret) throw new HttpError(400, 'BigBlueButton needs a server address and its shared secret.')
        // The room is opened when the first person joins; each person gets their own link then.
        return { url: '', meetingId: newId('bbb') }
      }
      throw new HttpError(400, 'Paste the meeting link for this service.')
    },
  },

  'meeting.join': {
    async run({ store, s, body }) {
      const course = await store.get('courses', String(body.courseId || ''))
      const unit = course?.units?.find((u) => u.id === body.unitId)
      const meeting = (unit?.data?.sessions || []).find((x) => x.id === body.sessionId)
      if (!meeting) throw new HttpError(404, 'That session was not found.')
      const teaches = isAdmin(s.user) || (course.instructorIds || []).includes(s.user.id)
      if (!teaches) {
        const db = await loadDb(store)
        if (!db.collections.enrollments.some((e) => e.userId === s.user.id && e.courseId === course.id)) throw new HttpError(403, 'You are not enrolled in this course.')
      }
      if (meeting.meetingProvider === 'bbb' && meeting.meetingId) {
        const full = withSettingDefaults(await store.get('settings', 'portal'))
        const { values: secrets } = await loadSecrets(store)
        const joined = await bbbJoin(full.integrations?.bbb, secrets.bbbSecret, { meetingId: meeting.meetingId, name: meeting.name || unit.name, fullName: displayName(s.user), moderator: teaches })
        if (!joined.ok) throw new HttpError(502, joined.error)
        return { url: joined.url }
      }
      if (!meeting.meetingUrl) throw new HttpError(404, 'This session has no meeting link yet.')
      return { url: meeting.meetingUrl }
    },
  },

  'bamboo.import': {
    admin: true,
    async run({ store, req, s }) {
      const db = await loadDb(store)
      const settings = withSettingDefaults(db.settings)
      const { values: secrets } = await loadSecrets(store)
      const found = await bambooEmployees(settings.integrations?.bamboohr, secrets.bambooApiKey)
      if (!found.ok) throw new HttpError(502, found.error)
      const taken = new Set(db.collections.users.map((u) => String(u.email).toLowerCase()))
      const upserts = []
      const hashes = []
      const passwords = {}
      for (const person of found.employees) {
        if (taken.has(person.email.toLowerCase())) continue
        taken.add(person.email.toLowerCase())
        const { user, rows } = newUserRows(db, settings, { ...person, source: 'BambooHR', mustChangePassword: true })
        const password = `${newSecret().slice(0, 10)}aA1`
        hashes.push({ userId: user.id, hash: await hashPassword(password) })
        passwords[user.id] = password
        upserts.push(...rows)
      }
      await store.setHashes(hashes)
      const plan = { upserts, deletes: [] }
      await commit(store, db, plan, { req, passwords })
      await recordHistory(store, db, s.user, plan)
      return { created: hashes.length, skipped: found.employees.length - hashes.length, emailed: emailReady(settings, secrets) }
    },
  },

  'engine.run': {
    admin: true,
    async run({ store, req }) {
      return { changed: await runTick(store, await loadDb(store), req, { force: true }) }
    },
  },
}

/** The price of what is being bought, for this person, right now. */
async function priced(c, db, { values: secrets }) {
  const { body, s } = c
  const settings = withSettingDefaults(db.settings)
  const user = db.collections.users.find((u) => u.id === s.user.id)
  const kind = body.kind === 'subscription' ? 'subscription' : 'course'
  let course = null
  let trial = false
  if (kind === 'course') {
    course = db.collections.courses.find((x) => x.id === body.courseId && x.status === 'active')
    if (!course) throw new HttpError(404, 'That course is not available.')
    if (db.collections.enrollments.some((e) => e.userId === user.id && e.courseId === course.id)) throw new HttpError(400, 'You are already enrolled in this course.')
  } else {
    const sub = settings.ecommerce.subscription
    if (!sub?.enabled) throw new HttpError(400, 'The portal does not offer a subscription.')
    trial = Number(sub.trialDays) > 0 && !user.trialUsed && !user.subscribedUntil
  }
  const g = settings.gamification
  const reward = rewardDiscount(scoreOf(allStats(stateOf(db)).get(user.id), g), g)
  const q = trial ? { list: Number(settings.ecommerce.subscription.fee) || 0, total: 0, lines: [{ label: `Free trial (${settings.ecommerce.subscription.trialDays} days)`, amount: 0 }], coupon: null } : quote({ kind, course, user, settings, couponCode: body.coupon, rewardPercent: reward })
  return {
    settings,
    user,
    course,
    kind,
    trial,
    quote: q,
    methods: paymentMethods(settings, { stripeReady: !!secrets.stripeSecretKey }),
    credits: Number(user.credits) || 0,
    currency: currencyCode(settings),
  }
}

export async function rpc(req, res) {
  const { store, secret } = await openStore()
  const query = queryOf(req)
  const body = req.method === 'POST' ? await readJson(req) : {}
  const name = String(query.get('do') || body.do || '')
  const action = Object.hasOwn(actions, name) ? actions[name] : null
  if (!action) throw new HttpError(404, 'Unknown action.')
  if (req.method !== 'POST' && name !== 'file.get') throw new HttpError(405, 'Use POST.')

  const c = { req, res, store, secret, body, query, s: null }
  if (!action.public) {
    c.s = await session(req, store, secret)
    if (action.admin && !isAdmin(c.s.user)) throw new HttpError(403, 'Administrators only.')
    const gate = gateFor(c.s.user, c.s.auth, c.s.settings, { twoFactor: twoFactorRequired(c.s.user, c.s.settings) })
    if (gate && !action.gated) throw new HttpError(403, 'Finish signing in first.')
  }
  const result = await action.run(c)
  if (result !== undefined) send(res, 200, publicResult(result), { 'Set-Cookie': c.s?.renew })
}

/** `priced()` carries whole records for the server's own use; only the figures go back to the browser. */
function publicResult(result) {
  if (!result || !result.quote || !result.settings) return result
  const { quote: q, methods, credits, currency, trial, kind } = result
  return { quote: { list: q.list, total: q.total, lines: q.lines, error: q.error || null, coupon: q.coupon?.code || '', covered: q.covered || null }, methods, credits, currency, trial, kind }
}

/* ----------------------------------------- sign in with another account */

const PROVIDER_LABEL = { google: 'Google', facebook: 'Facebook', linkedin: 'LinkedIn', sso: 'single sign-on' }

export async function oauth(req, res) {
  const { store, secret } = await openStore()
  const q = queryOf(req)
  const settings = withSettingDefaults(await store.get('settings', 'portal'))
  const { values: secrets } = await loadSecrets(store)
  const redirectUri = `${originOf(req)}/api/oauth`
  const fail = (message) => redirect(res, `/login?error=${encodeURIComponent(message)}`)

  if (!ipAllowed(clientIp(req), settings.security.allowedIps)) return fail('Signing in is not allowed from this network.')
  if (q.get('error')) return fail('Sign-in was cancelled.')

  if (!q.get('code')) {
    const provider = String(q.get('provider') || '')
    if (!signInProviders(settings, secrets)[provider]) return fail('That way of signing in is not available.')
    const nonce = newSecret().slice(0, 16)
    const url = await oauthStartUrl(provider, settings, secrets, { redirectUri, state: signTicket(secret, { k: 'oauth', p: provider, n: nonce }, 10 * 60000) })
    if (!url) return fail('That way of signing in is not set up correctly.')
    return redirect(res, url, { 'Set-Cookie': `lms_oauth=${nonce}; Path=/api/oauth; HttpOnly; SameSite=Lax; Max-Age=600` })
  }

  const state = readTicket(secret, q.get('state'))
  const nonce = (req.headers.cookie || '').match(/(?:^|;\s*)lms_oauth=([\w-]+)/)?.[1]
  if (!state || state.k !== 'oauth' || !nonce || state.n !== nonce) return fail('That sign-in attempt has expired. Try again.')
  const profile = await oauthProfile(state.p, settings, secrets, { code: q.get('code'), redirectUri })
  if (!profile.ok) return fail(profile.error)

  let user = await store.findUserByEmail(profile.email)
  if (!user) {
    // An organization's own sign-in creates accounts as people arrive; social accounts only where sign-up is open.
    const mayCreate = state.p === 'sso' || (settings.users.selfRegistration && emailDomainAllowed(profile.email, settings.users.allowedDomains))
    if (!mayCreate) return fail('No account was found for that email address. Ask the program office for one.')
    const db = await loadDb(store)
    const made = newUserRows(db, settings, { firstName: profile.firstName, lastName: profile.lastName, email: profile.email, selfRegistered: true, source: PROVIDER_LABEL[state.p] })
    await store.setHashes([{ userId: made.user.id, hash: await hashPassword(newSecret()) }])
    await commit(store, db, { upserts: made.rows, deletes: [] }, { req })
    user = made.user
  }
  if (!user.active) return fail('This account is inactive. Contact your administrator.')
  const hash = await store.getHash(user.id)
  if (!hash) return fail('This account cannot sign in yet. Contact your administrator.')
  const auth = (await store.get('_auth', user.id)) || {}
  const started = await startSession(req, store, secret, { user, hash, auth, settings, via: PROVIDER_LABEL[state.p] })
  res.setHeader('Set-Cookie', [started.cookie, 'lms_oauth=; Path=/api/oauth; HttpOnly; SameSite=Lax; Max-Age=0'])
  redirect(res, '/')
}
