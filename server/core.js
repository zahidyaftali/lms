/**
 * Plumbing shared by every API route: opening the store, reading requests,
 * checking who is signed in, and saving a change together with everything the
 * portal does in response to it (automations, notifications, emails, webhooks).
 */
import { getStore } from './store.js'
import { COLLECTIONS, assemble, stateOf, withoutPassword } from './access.js'
import { auditFor, mergeAudit } from '../src/lib/audit.js'
import { applyOps, hasOps, react, tick } from '../src/lib/engine.js'
import { withSettingDefaults } from '../src/lib/settingsDefaults.js'
import { ipAllowed, newEnrollment } from '../src/lib/rules.js'
import { loadSecrets, postWebhook, sendEmail } from './services.js'
import {
  clientIp,
  createToken,
  hashPassword,
  newId,
  newSecret,
  originOf,
  readCookie,
  readToken,
  sessionCookie,
  tokenMatchesHash,
} from './auth.js'

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message)
    this.status = status
    this.extra = extra
  }
}

export function send(res, status, body, headers = {}) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  for (const [k, v] of Object.entries(headers)) if (v) res.setHeader(k, v)
  res.end(JSON.stringify(body))
}

export function redirect(res, location, headers = {}) {
  res.statusCode = 302
  res.setHeader('Location', location)
  res.setHeader('Cache-Control', 'no-store')
  for (const [k, v] of Object.entries(headers)) if (v) res.setHeader(k, v)
  res.end()
}

export const queryOf = (req) => new URL(req.url, 'http://x').searchParams

/** Uploads travel as base64 inside JSON; Vercel accepts request bodies up to about 4.5 MB. */
const MAX_BODY = 6 * 1024 * 1024

export async function readJson(req) {
  if (req.body !== undefined && req.body !== null && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body
  if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {}
  if (Buffer.isBuffer(req.body)) return req.body.length ? JSON.parse(req.body.toString('utf8')) : {}
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY) throw new HttpError(413, 'That upload is too large.')
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  return text ? JSON.parse(text) : {}
}

/* -------------------------------------------------------------- first start */

let ready = null
export async function openStore() {
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

export async function loadDb(store) {
  return assemble(await store.all())
}

export const settingsOf = (db) => withSettingDefaults(db.settings)

/* ----------------------------------------------------------------- sessions */

/**
 * The signed-in user, or a 401. Deactivated accounts and changed passwords end
 * the session, as do the rules in Account & Settings → Security: the session
 * timeout, one session at a time and the allowed networks.
 *
 * `background` requests (the page refreshing itself) do not count as activity.
 */
export async function session(req, store, secret, { background = false } = {}) {
  const token = readToken(secret, readCookie(req))
  if (!token) throw new HttpError(401, 'Please sign in.')
  const [user, hash, rawSettings, auth] = await Promise.all([
    store.get('users', token.u),
    store.getHash(token.u),
    store.get('settings', 'portal'),
    store.get('_auth', token.u),
  ])
  if (!user || !user.active || !hash || !tokenMatchesHash(secret, token, hash)) throw new HttpError(401, 'Please sign in again.')
  const settings = withSettingDefaults(rawSettings)
  const sec = settings.security
  if (!ipAllowed(clientIp(req), sec.allowedIps)) throw new HttpError(401, 'Signing in is not allowed from this network.')
  if (sec.singleSession && auth?.sid && token.s !== auth.sid)
    throw new HttpError(401, 'You were signed out because this account signed in on another device.')
  const idle = Number(sec.sessionTimeout) || 0
  const now = Date.now()
  if (idle > 0 && token.a && now - token.a > idle * 60000)
    throw new HttpError(401, `You were signed out after ${idle} minutes without activity.`)
  const renew =
    !background && now - (token.a || 0) > 60000
      ? sessionCookie(req, createToken(secret, user.id, hash, { sid: token.s || '', at: now }))
      : null
  return { user, hash, auth: auth || {}, settings, token, renew }
}

/** Starts a session for a user who has proved who they are, and records the sign-in. */
export async function startSession(req, store, secret, { user, hash, auth, settings, via = '' }) {
  const now = new Date().toISOString()
  const sid = newId('s')
  const signedIn = {
    ...user,
    lastLogin: now,
    loginCount: (Number(user.loginCount) || 0) + 1,
    // Accounts from before password expiry existed start their clock at this sign-in.
    passwordChangedAt: user.passwordChangedAt || now,
  }
  const rows = [
    { collection: 'users', id: user.id, data: signedIn },
    { collection: '_auth', id: user.id, data: { ...(auth || {}), userId: user.id, fails: 0, lockedUntil: null, sid } },
  ]
  if (settings.security.auditLog !== false) {
    const id = newId('ev')
    rows.push({
      collection: 'events',
      id,
      data: { id, type: 'login', text: via ? `signed in with ${via}` : 'signed in', actorId: user.id, targetId: null, at: now },
    })
  }
  await store.upsert(rows)
  return { user: signedIn, cookie: sessionCookie(req, createToken(secret, user.id, hash, { sid })) }
}

/**
 * The rows for a new account created outside the Users page (sign-up, the API,
 * an HR import, a sign-in provider): the user, in the default group, with the
 * enrollments that group gives.
 */
export function newUserRows(db, settings, fields) {
  const now = new Date().toISOString()
  const wanted = db.collections.userTypes.find((t) => t.name === (fields.userType || settings.users.defaultUserType))
  // Accounts nobody at the school created by hand are never given staff access.
  const type = wanted?.role === 'learner' ? wanted : db.collections.userTypes.find((t) => t.role === 'learner')
  const group = db.collections.groups.find((g) => g.id === settings.users.defaultGroupId)
  const user = {
    id: newId('u'),
    firstName: '',
    lastName: '',
    email: '',
    active: true,
    bio: '',
    phone: '',
    branchId: null,
    groupIds: group ? [group.id] : [],
    avatar: null,
    registeredAt: now,
    lastLogin: null,
    passwordChangedAt: now,
    ...fields,
    role: 'learner',
    userType: type?.name || 'Learner-Type',
  }
  const rows = [{ collection: 'users', id: user.id, data: user }]
  for (const courseId of group?.courseIds || []) {
    if (!db.collections.courses.some((c) => c.id === courseId)) continue
    const e = newEnrollment(newId('en'), user.id, courseId, now)
    rows.push({ collection: 'enrollments', id: e.id, data: e })
  }
  return { user, rows }
}

/* ------------------------------------------------------- saving and reacting */

export const ctxOf = (req, extra = {}) => ({ now: Date.now(), makeId: newId, origin: req ? originOf(req) : '', ...extra })

/** The state after a set of row upserts and deletes; untouched records keep their identity. */
export function applyPlan(state, plan) {
  const next = { ...state }
  const touched = new Set([...plan.upserts.map((u) => u.collection), ...plan.deletes.map((d) => d.collection)])
  for (const coll of touched) {
    if (coll === 'settings') {
      next.settings = withSettingDefaults(plan.upserts.find((u) => u.collection === 'settings').data)
      continue
    }
    if (!COLLECTIONS.includes(coll)) continue
    const byId = new Map((state[coll] || []).map((r) => [r.id, r]))
    plan.upserts.filter((u) => u.collection === coll).forEach((u) => byId.set(u.id, u.data))
    plan.deletes.filter((d) => d.collection === coll).forEach((d) => byId.delete(d.id))
    next[coll] = [...byId.values()]
  }
  return next
}

/** What is stored never includes `privateBody`: the text of an email that holds a password. */
const storable = ({ privateBody, ...rest }) => rest
const opsRows = (ops) =>
  Object.entries(ops.upserts).flatMap(([collection, records]) => records.map((r) => ({ collection, id: r.id, data: storable(r) })))
const opsKeys = (ops) => Object.entries(ops.deletes).flatMap(([collection, ids]) => ids.map((id) => ({ collection, id })))

/** Sends the emails and webhooks a change set off, and records how each email went. */
export async function deliver(store, settings, { mails = [], hooks = [] }) {
  if (!mails.length && !hooks.length) return
  const { values: secrets } = await loadSecrets(store)
  const at = new Date().toISOString()
  const results = await Promise.all(
    mails.slice(0, 25).map(async (m) => {
      const r = await sendEmail(settings, secrets, { ...m, body: m.privateBody || m.body })
      const status = r.ok ? 'sent' : r.skipped ? 'skipped' : 'failed'
      return { collection: 'outbox', id: m.id, data: { ...storable(m), status, error: r.ok ? '' : r.error, sentAt: r.ok ? at : null } }
    }),
  )
  await store.upsert(results)
  await Promise.all(hooks.slice(0, 20).map((h) => postWebhook(h.url, h.payload)))
}

/**
 * Stores a change, then everything that follows from it: the engine's own
 * record changes are saved in the same step and its emails and webhooks sent.
 * `quiet` saves without reacting (bulk imports and restores).
 */
export async function commit(store, db, plan, { req, quiet = false, passwords = {} } = {}) {
  const before = stateOf(db)
  const after = applyPlan(before, plan)
  const ops = quiet ? { upserts: {}, deletes: {}, effects: [] } : react(before, after, ctxOf(req, { passwords }))
  await store.upsert([...plan.upserts, ...opsRows(ops)])
  await store.remove([...plan.deletes, ...opsKeys(ops)])
  await deliver(store, after.settings, {
    mails: (ops.upserts.outbox || []).filter((m) => m.status === 'queued'),
    hooks: ops.effects.filter((e) => e.type === 'webhook'),
  })
  return { ops, changed: hasOps(ops), state: applyOps(after, ops) }
}

const TICK_EVERY_MS = 10 * 60000

/**
 * Runs what depends on the clock: delayed automations, expiry reminders, idle
 * accounts. Called by the daily cron and, at most every ten minutes, whenever
 * someone loads the portal. Returns whether anything changed.
 */
export async function runTick(store, db, req, { force = false } = {}) {
  const last = Number(db.meta.lastTick?.value) || 0
  if (!force && Date.now() - last < TICK_EVERY_MS) return false
  await store.upsert([{ collection: 'meta', id: 'lastTick', data: { value: Date.now() } }])
  const state = stateOf(db)
  const ops = tick(state, ctxOf(req))
  await store.upsert(opsRows(ops))
  await store.remove(opsKeys(ops))
  const fresh = new Set((ops.upserts.outbox || []).map((m) => m.id))
  // Emails still waiting from a busy moment go out with this batch.
  const waiting = (state.outbox || []).filter((m) => m.status === 'queued' && !fresh.has(m.id))
  await deliver(store, state.settings, {
    mails: [...(ops.upserts.outbox || []).filter((m) => m.status === 'queued'), ...waiting],
    hooks: ops.effects.filter((e) => e.type === 'webhook'),
  })
  return hasOps(ops)
}

/**
 * Writes History entries for the users, courses and settings a change touched.
 * The actor is always the signed-in user, never something the browser claims.
 */
export async function recordHistory(store, db, me, plan, passwordUserIds = []) {
  if (settingsOf(db).security.auditLog === false) return
  const before = { users: db.collections.users, courses: db.collections.courses, settings: db.settings }
  const apply = (list, coll) => {
    const byId = new Map(list.map((r) => [r.id, r]))
    plan.upserts.filter((u) => u.collection === coll).forEach((u) => byId.set(u.id, u.data))
    plan.deletes.filter((d) => d.collection === coll).forEach((d) => byId.delete(d.id))
    return [...byId.values()]
  }
  const settings = plan.upserts.find((u) => u.collection === 'settings')?.data || db.settings
  const after = { users: apply(before.users, 'users'), courses: apply(before.courses, 'courses'), settings }
  const entries = auditFor(before, after, {
    actor: me,
    passwords: passwordUserIds,
    at: new Date().toISOString(),
    makeId: () => newId('au'),
  })
  if (!entries.length) return
  const { stored, dropped } = mergeAudit(db.auditLog, entries)
  await store.upsert(stored.map((e) => ({ collection: 'auditLog', id: e.id, data: e })))
  await store.remove(dropped.map((id) => ({ collection: 'auditLog', id })))
}
