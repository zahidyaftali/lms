import { DEFAULT_SETTINGS } from './seed'

/**
 * Keeping the in-memory portal and the shared database in step. After every
 * change the app diffs its state against a snapshot of what the server last
 * accepted and sends only the records that differ.
 */

export const COLLECTIONS = [
  'userTypes',
  'categories',
  'users',
  'courses',
  'branches',
  'groups',
  'enrollments',
  'notifications',
  'messages',
  'events',
  'submissions',
  'certificates',
  'enrollmentRequests',
  'learningPaths',
  'automations',
  'skills',
]

export const emptyState = (settings = {}) => ({
  version: 1,
  settings: { ...DEFAULT_SETTINGS, ...settings },
  courseImports: [],
  auditLog: [],
  ...Object.fromEntries(COLLECTIONS.map((c) => [c, []])),
})

// Passwords never go into the snapshot: a `password` on a user record means
// "an administrator just set this", and it is sent separately to be hashed.
const serialize = (collection, record) => {
  if (collection !== 'users' || !('password' in record)) return JSON.stringify(record)
  const { password, ...rest } = record
  return JSON.stringify(rest)
}

export function snapshotOf(state) {
  return {
    records: Object.fromEntries(
      COLLECTIONS.map((c) => [c, new Map((state[c] || []).map((r) => [r.id, serialize(c, r)]))]),
    ),
    settings: JSON.stringify(state.settings),
    courseImports: JSON.stringify(state.courseImports || []),
  }
}

/** The payload for POST /api/sync, or null when nothing changed. */
export function diffState(state, snapshot) {
  const upserts = {}
  const deletes = {}
  const passwords = []
  let changed = false

  for (const c of COLLECTIONS) {
    const known = snapshot.records[c]
    const seen = new Set()
    for (const record of state[c] || []) {
      seen.add(record.id)
      if (c === 'users' && record.password) passwords.push({ userId: record.id, password: record.password })
      if (known.get(record.id) !== serialize(c, record)) {
        ;(upserts[c] ||= []).push(c === 'users' ? withoutPassword(record) : record)
        changed = true
      }
    }
    for (const id of known.keys()) {
      if (!seen.has(id)) {
        ;(deletes[c] ||= []).push(id)
        changed = true
      }
    }
  }

  const payload = { upserts, deletes }
  if (JSON.stringify(state.settings) !== snapshot.settings) payload.settings = state.settings
  if (JSON.stringify(state.courseImports || []) !== snapshot.courseImports)
    payload.meta = { courseImports: state.courseImports || [] }
  if (passwords.length) payload.passwords = passwords

  return changed || payload.settings || payload.meta || passwords.length ? payload : null
}

/** The snapshot once the server has accepted `payload`. */
export function advanceSnapshot(snapshot, payload) {
  const records = Object.fromEntries(COLLECTIONS.map((c) => [c, new Map(snapshot.records[c])]))
  for (const [c, list] of Object.entries(payload.upserts)) list.forEach((r) => records[c].set(r.id, serialize(c, r)))
  for (const [c, ids] of Object.entries(payload.deletes)) ids.forEach((id) => records[c].delete(id))
  return {
    records,
    settings: payload.settings ? JSON.stringify(payload.settings) : snapshot.settings,
    courseImports: payload.meta ? JSON.stringify(payload.meta.courseImports) : snapshot.courseImports,
  }
}

function withoutPassword(record) {
  const { password, ...rest } = record
  return rest
}
