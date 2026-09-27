/**
 * Who may read and change what. The browser sends plain record upserts; every
 * one is checked here against the signed-in user's role before it is stored.
 *
 * - Administrators: everything, including settings and other users' passwords.
 * - Instructors: courses they teach (and new ones), enrollments and grading in
 *   those courses, their own profile, messages and activity.
 * - Learners: their own profile, progress, submissions, certificates, enrollment
 *   requests, messages and activity — and self-enrollment where a course allows it.
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
]

export const isAdmin = (u) => u?.role === 'superadmin' || u?.role === 'admin'
const isInstructor = (u) => u?.role === 'instructor'

const SELF_FIELDS = ['firstName', 'lastName', 'bio', 'phone', 'avatar']
const PROGRESS_FIELDS = ['completedUnits', 'status', 'score', 'completedAt', 'timeSpentMin']
const GRADE_FIELDS = ['status', 'grade', 'feedback', 'gradedAt']

const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]))
export const withoutPassword = ({ password, ...rest }) => rest

/** Rows from the store -> { settings, meta, collections } */
export function assemble(rows) {
  const db = { settings: null, meta: {}, auditLog: [], collections: Object.fromEntries(COLLECTIONS.map((c) => [c, []])) }
  for (const { collection, id, data } of rows) {
    if (collection === 'settings') db.settings = data
    else if (collection === 'meta') db.meta[id] = data
    else if (collection === 'auditLog') db.auditLog.push(data)
    else if (db.collections[collection]) db.collections[collection].push(data)
  }
  db.auditLog.sort((a, b) => (a.at < b.at ? 1 : -1))
  return db
}

/** Settings the sign-in page needs before anyone has signed in. */
export function publicSettings(settings = {}) {
  return pick(settings, ['siteName', 'siteDescription', 'logo', 'supportEmail', 'supportPhone', 'website', 'domain', 'address'])
}

/** The portal as the signed-in user may see it, in the shape the app keeps in memory. */
export function viewFor(db, me) {
  const c = db.collections
  const base = {
    version: 1,
    settings: db.settings,
    courseImports: db.meta.courseImports?.value || [],
    userTypes: c.userTypes,
    categories: c.categories,
    courses: c.courses,
    branches: c.branches,
    groups: c.groups,
  }
  const users = c.users.map(withoutPassword)

  if (isAdmin(me) || isInstructor(me)) {
    return {
      ...base,
      users,
      enrollments: c.enrollments,
      notifications: isAdmin(me) ? c.notifications : [],
      messages: isAdmin(me) ? c.messages : c.messages.filter((m) => m.fromId === me.id || m.toId === me.id),
      events: c.events,
      submissions: c.submissions,
      certificates: c.certificates,
      enrollmentRequests: c.enrollmentRequests,
      auditLog: isAdmin(me) ? db.auditLog : [],
    }
  }

  // Learners see staff (to message them) and themselves, and only their own records.
  const enrollmentCounts = {}
  c.enrollments.forEach((e) => (enrollmentCounts[e.courseId] = (enrollmentCounts[e.courseId] || 0) + 1))
  return {
    ...base,
    users: users
      .filter((u) => u.id === me.id || u.role !== 'learner')
      .map((u) => (u.id === me.id ? u : pick(u, ['id', 'firstName', 'lastName', 'email', 'role', 'userType', 'avatar', 'active']))),
    enrollments: c.enrollments.filter((e) => e.userId === me.id),
    notifications: [],
    messages: c.messages.filter((m) => m.fromId === me.id || m.toId === me.id),
    events: [],
    submissions: c.submissions.filter((s) => s.userId === me.id),
    certificates: c.certificates.filter((x) => x.userId === me.id),
    enrollmentRequests: c.enrollmentRequests.filter((r) => r.userId === me.id),
    enrollmentCounts,
  }
}

/**
 * Checks a sync payload from the browser against the user's role.
 * Returns the rows to store, keys to delete and passwords to hash, plus
 * anything that was refused (the browser reloads when that happens).
 */
export function authorize(db, me, payload) {
  const out = { upserts: [], deletes: [], passwords: [], rejected: [] }
  const byId = (coll) => new Map(db.collections[coll].map((r) => [r.id, r]))
  const index = Object.fromEntries(COLLECTIONS.map((coll) => [coll, byId(coll)]))
  const incoming = payload.upserts || {}
  const refuse = (coll, id, why) => out.rejected.push({ collection: coll, id, why })
  const keep = (coll, data) => out.upserts.push({ collection: coll, id: data.id, data })
  const teaches = (courseId) => (index.courses.get(courseId)?.instructorIds || []).includes(me.id)
  const admin = isAdmin(me)

  for (const [coll, records] of Object.entries(incoming)) {
    if (!COLLECTIONS.includes(coll) || !Array.isArray(records)) continue
    for (const raw of records) {
      if (!raw || typeof raw.id !== 'string' || !raw.id) continue
      const record = coll === 'users' ? withoutPassword(raw) : raw
      const existing = index[coll].get(record.id)

      if (admin) {
        keep(coll, record)
        continue
      }

      switch (coll) {
        case 'users':
          if (record.id === me.id && existing) keep(coll, { ...existing, ...pick(record, SELF_FIELDS) })
          else refuse(coll, record.id, 'not your account')
          break

        case 'courses':
          if (isInstructor(me) && (!existing ? (record.instructorIds || []).includes(me.id) : teaches(record.id)))
            keep(coll, record)
          else refuse(coll, record.id, 'not your course')
          break

        case 'enrollments':
          if (isInstructor(me) && teaches(record.courseId) && (!existing || teaches(existing.courseId))) {
            keep(coll, record)
          } else if (existing && existing.userId === me.id && record.userId === me.id && existing.courseId === record.courseId) {
            keep(coll, { ...existing, ...pick(record, PROGRESS_FIELDS) })
          } else if (!existing && record.userId === me.id && canSelfEnroll(db, record.courseId, me.id)) {
            keep(coll, { ...record, completedUnits: [], status: 'not_started', score: null, completedAt: null, timeSpentMin: 0 })
          } else refuse(coll, record.id, 'not your enrollment')
          break

        case 'submissions':
          if (isInstructor(me) && existing && teaches(existing.courseId)) keep(coll, { ...existing, ...pick(record, GRADE_FIELDS) })
          else if (!existing && record.userId === me.id)
            keep(coll, { ...record, status: 'pending', grade: null, feedback: '', gradedAt: undefined })
          else refuse(coll, record.id, 'not your submission')
          break

        case 'certificates':
          if (!existing && record.userId === me.id && completed(db, incoming, me.id, record.courseId)) keep(coll, record)
          else refuse(coll, record.id, 'course not completed')
          break

        case 'enrollmentRequests':
          if (!existing && record.userId === me.id) keep(coll, { ...record, status: 'pending' })
          else refuse(coll, record.id, 'not your request')
          break

        case 'messages':
          if (!existing && record.fromId === me.id) keep(coll, record)
          else if (existing && existing.toId === me.id) keep(coll, { ...existing, read: !!record.read })
          else refuse(coll, record.id, 'not your message')
          break

        case 'events':
          if (!existing && record.actorId === me.id) keep(coll, record)
          else if (!existing) refuse(coll, record.id, 'not your activity')
          break

        default:
          refuse(coll, record.id, 'administrators only')
      }
    }
  }

  for (const [coll, ids] of Object.entries(payload.deletes || {})) {
    if (!COLLECTIONS.includes(coll) || !Array.isArray(ids)) continue
    for (const id of ids) {
      const existing = index[coll].get(id)
      if (!existing) continue
      const allowed =
        admin ||
        (isInstructor(me) && coll === 'enrollments' && teaches(existing.courseId)) ||
        (isInstructor(me) && coll === 'courses' && teaches(id)) ||
        // Staff browsers trim the activity log to its latest entries.
        (isInstructor(me) && coll === 'events')
      if (allowed && !(coll === 'users' && id === me.id)) out.deletes.push({ collection: coll, id })
      else if (coll !== 'events') refuse(coll, id, 'cannot delete')
    }
  }

  if (payload.settings) {
    if (admin) out.upserts.push({ collection: 'settings', id: 'portal', data: payload.settings })
    else refuse('settings', 'portal', 'administrators only')
  }
  if (payload.meta?.courseImports) {
    if (admin) out.upserts.push({ collection: 'meta', id: 'courseImports', data: { value: payload.meta.courseImports } })
  }

  for (const entry of payload.passwords || []) {
    if (admin && entry && typeof entry.userId === 'string') out.passwords.push(entry)
    else refuse('users', entry?.userId, 'passwords are set by administrators')
  }

  return out
}

function canSelfEnroll(db, courseId, userId) {
  const course = db.collections.courses.find((c) => c.id === courseId)
  const already = db.collections.enrollments.some((e) => e.userId === userId && e.courseId === courseId)
  return (
    !already &&
    !!course &&
    course.status === 'active' &&
    course.enrollmentRequest === false &&
    !!db.settings?.courses?.allowSelfEnrollment
  )
}

function completed(db, incoming, userId, courseId) {
  const course = db.collections.courses.find((c) => c.id === courseId)
  if (!course?.certificate) return false
  const pending = (incoming.enrollments || []).find((e) => e.userId === userId && e.courseId === courseId)
  const stored = db.collections.enrollments.find((e) => e.userId === userId && e.courseId === courseId)
  return (pending || stored)?.status === 'completed' && !!stored
}
