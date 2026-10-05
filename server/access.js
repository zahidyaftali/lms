/**
 * Who may read and change what. The browser sends plain record upserts; every
 * one is checked here against the signed-in user's role before it is stored.
 *
 * - Administrators: everything, including settings and other users' passwords.
 * - Instructors: courses they teach (and new ones), enrollments, grading and
 *   discussions in those courses, their own profile, messages and activity.
 * - Learners: their own profile, progress, submissions, certificates, enrollment
 *   requests, messages, discussion posts, ratings and skill assessments — and
 *   self-enrollment where a course allows it.
 *
 * Orders, scheduled jobs and the email log are written by the server only.
 */
import { ADMIN_SETTINGS, publicEcommerce, withSettingDefaults } from '../src/lib/settingsDefaults.js'
import { leaderboard } from '../src/lib/gamification.js'
import { sellsCourses } from '../src/lib/commerce.js'
import { badIpRules, certificateExpired, displayName, ipAllowed, needsTerms, passwordExpired, termsVersion } from '../src/lib/rules.js'

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
  'discussions',
  'ratings',
  'skillResults',
  'orders',
  'jobs',
  'outbox',
]

/** Collections only the server writes. */
const SERVER_ONLY = ['orders', 'jobs', 'outbox']

export const isAdmin = (u) => u?.role === 'superadmin' || u?.role === 'admin'
const isInstructor = (u) => u?.role === 'instructor'

const SELF_FIELDS = ['firstName', 'lastName', 'bio', 'phone', 'avatar']
/** Fields the server keeps on a user record itself; an administrator's browser cannot set them. */
const SERVER_USER_FIELDS = ['loginCount', 'mustChangePassword', 'passwordChangedAt', 'termsAccepted', 'termsAcceptedAt', 'emailVerified', 'subscribedUntil', 'trialUsed']
const PROGRESS_FIELDS = ['completedUnits', 'status', 'score', 'completedAt', 'timeSpentMin', 'attempts', 'scores', 'failedAt']
const GRADE_FIELDS = ['status', 'grade', 'feedback', 'gradedAt']

const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]))
export const withoutPassword = ({ password, ...rest }) => rest

/** Rows from the store -> { settings, meta, collections } */
export function assemble(rows) {
  const db = { settings: null, meta: {}, auditLog: [], collections: Object.fromEntries(COLLECTIONS.map((c) => [c, []])) }
  for (const row of rows) {
    const { collection, id } = row
    // Every record carries its own id. Sign-in events written by earlier versions did not, and a browser
    // cannot tell such records apart, so the id the row is stored under is put back.
    const data = row.data && typeof row.data === 'object' && !Array.isArray(row.data) && row.data.id == null && COLLECTIONS.includes(collection) ? { ...row.data, id } : row.data
    if (collection === 'settings') db.settings = data
    else if (collection === 'meta') db.meta[id] = data
    else if (collection === 'auditLog') db.auditLog.push(data)
    else if (db.collections[collection]) db.collections[collection].push(data)
  }
  db.auditLog.sort((a, b) => (a.at < b.at ? 1 : -1))
  return db
}

/** The portal as the engine and the rules see it: every collection plus complete settings. */
export const stateOf = (db) => ({ ...db.collections, settings: withSettingDefaults(db.settings) })

/** Settings the sign-in page needs before anyone has signed in. */
export function publicSettings(raw = {}, extra = {}) {
  const settings = withSettingDefaults(raw)
  const shown = pick(settings, ['settingsVersion', 'siteName', 'siteDescription', 'customDomain', 'logo', 'favicon', 'theme', 'language', 'dateFormat', 'timezone', 'currency', 'supportEmail', 'supportPhone', 'website', 'domain', 'address', 'homepage'])
  // Only the announcement written for the sign-in page; the internal one stays behind the login.
  const { externalOn, external } = settings.announcements || {}
  shown.announcements = { internalOn: false, internal: '', externalOn: !!(externalOn && external), external: externalOn ? external : '' }
  const u = settings.users
  shown.users = {
    selfRegistration: !!u.selfRegistration,
    verification: u.verification,
    termsOn: !!u.termsOn,
    terms: u.termsOn ? u.terms : '',
    passwordMinLength: u.passwordMinLength,
    customFields: u.selfRegistration ? u.customFields : [],
    nameFormat: u.nameFormat,
    socialGoogle: !!(u.socialGoogle && extra.social?.google),
    socialFacebook: !!(u.socialFacebook && extra.social?.facebook),
    socialLinkedIn: !!(u.socialLinkedIn && extra.social?.linkedin),
  }
  shown.signIn = { sso: !!extra.social?.sso }
  shown.security = { strongPasswords: !!settings.security.strongPasswords }
  shown.courses = pick(settings.courses, ['externalCatalog', 'catalogLayout', 'socialSharing'])
  return shown
}

/** The courses visitors may browse without signing in (Account & Settings → Courses → External catalog). */
export function publicCatalog(db) {
  const settings = withSettingDefaults(db.settings)
  if (!settings.courses.externalCatalog) return null
  return {
    categories: db.collections.categories,
    courses: db.collections.courses
      .filter((c) => c.status === 'active' && c.showInCatalog !== false)
      .map((c) => ({
        ...pick(c, ['id', 'name', 'code', 'description', 'categoryId', 'price', 'level', 'cover', 'introVideo', 'certificate', 'publicSharing', 'status', 'custom', 'timeMode', 'startDate', 'endDate']),
        showInCatalog: true,
        // The outline, without the lessons themselves.
        units: (c.units || []).map((u) => ({ id: u.id, type: u.type, name: u.name })),
      })),
  }
}

/** The portal as the signed-in user may see it, in the shape the app keeps in memory. */
export function viewFor(db, me) {
  const c = db.collections
  const full = withSettingDefaults(db.settings)
  const admin = isAdmin(me)
  const staff = admin || isInstructor(me)

  const settings = { ...full }
  if (!admin) {
    ADMIN_SETTINGS.forEach((key) => delete settings[key])
    settings.ecommerce = publicEcommerce(full.ecommerce)
    settings.security = { ...full.security, allowedIps: '' }
  }

  const mine = (list) => list.filter((r) => r.userId === me.id)
  const skillsOn = full.skills.enabled && full.skills.learners
  const myCourses = new Set(mine(c.enrollments).map((e) => e.courseId))

  const base = {
    version: 1,
    settings,
    courseImports: db.meta.courseImports?.value || [],
    userTypes: c.userTypes,
    categories: c.categories,
    courses: c.courses,
    branches: c.branches,
    groups: c.groups,
    learningPaths: admin
      ? c.learningPaths
      : c.learningPaths
          .filter((p) => (p.userIds || []).includes(me.id) || (p.status === 'active' && p.selfEnroll))
          .map((p) => ({ ...p, userIds: (p.userIds || []).filter((id) => id === me.id), joined: pick(p.joined || {}, [me.id]) })),
    skills: admin
      ? c.skills
      : skillsOn
        ? c.skills.map((s) => ({ ...s, userIds: (s.userIds || []).filter((id) => id === me.id) }))
        : [],
    automations: admin ? c.automations : [],
    ratings: c.ratings,
    jobs: admin ? c.jobs : [],
    outbox: admin ? c.outbox : [],
  }
  const users = c.users.map(withoutPassword)

  if (staff) {
    return {
      ...base,
      users,
      enrollments: c.enrollments,
      notifications: admin ? c.notifications : [],
      messages: admin ? c.messages : c.messages.filter((m) => m.fromId === me.id || m.toId === me.id),
      events: c.events,
      submissions: c.submissions,
      certificates: c.certificates,
      enrollmentRequests: c.enrollmentRequests,
      discussions: c.discussions,
      skillResults: c.skillResults,
      orders: admin ? c.orders : mine(c.orders),
      auditLog: admin ? db.auditLog : [],
    }
  }

  // Learners see staff (to message them), themselves and the classmates they share a discussion with.
  const discussions = full.courses.discussions ? c.discussions.filter((p) => myCourses.has(p.courseId)) : []
  const posters = new Set(discussions.map((p) => p.userId))
  const enrollmentCounts = {}
  c.enrollments.forEach((e) => (enrollmentCounts[e.courseId] = (enrollmentCounts[e.courseId] || 0) + 1))
  const g = full.gamification
  return {
    ...base,
    users: users
      .filter((u) => u.id === me.id || u.role !== 'learner' || posters.has(u.id))
      .map((u) =>
        u.id === me.id
          ? u
          : u.role === 'learner'
            ? pick(u, ['id', 'firstName', 'lastName', 'role', 'userType', 'avatar', 'active'])
            : pick(u, ['id', 'firstName', 'lastName', 'email', 'role', 'userType', 'avatar', 'active']),
      ),
    enrollments: mine(c.enrollments),
    notifications: [],
    messages: c.messages.filter((m) => m.fromId === me.id || m.toId === me.id),
    events: [],
    submissions: mine(c.submissions),
    certificates: mine(c.certificates),
    enrollmentRequests: mine(c.enrollmentRequests),
    discussions,
    skillResults: mine(c.skillResults),
    orders: mine(c.orders),
    enrollmentCounts,
    leaderboard: g.enabled && g.leaderboard.enabled ? leaderboard(stateOf(db), g, (u) => displayName(u, full.users.nameFormat)).slice(0, 50) : [],
  }
}

/**
 * Checks a sync payload from the browser against the user's role.
 * Returns the rows to store, keys to delete and passwords to hash, plus
 * anything that was refused (the browser reloads when that happens; refusals
 * marked `show` are also explained to the user).
 */
export function authorize(db, me, payload, { ip = '' } = {}) {
  const out = { upserts: [], deletes: [], passwords: [], rejected: [] }
  const settings = withSettingDefaults(db.settings)
  const byId = (coll) => new Map(db.collections[coll].map((r) => [r.id, r]))
  const index = Object.fromEntries(COLLECTIONS.map((coll) => [coll, byId(coll)]))
  const incoming = payload.upserts || {}
  const refuse = (coll, id, why, show = false) => out.rejected.push({ collection: coll, id, why, show })
  const keep = (coll, data) => out.upserts.push({ collection: coll, id: data.id, data })
  const teaches = (courseId) => (index.courses.get(courseId)?.instructorIds || []).includes(me.id)
  const enrolledIn = (courseId) => db.collections.enrollments.some((e) => e.userId === me.id && e.courseId === courseId)
  const admin = isAdmin(me)

  const userLimit = Number(settings.subscription?.userLimit) || 0
  let activeUsers = db.collections.users.filter((u) => u.active).length

  for (const [coll, records] of Object.entries(incoming)) {
    if (!COLLECTIONS.includes(coll) || !Array.isArray(records)) continue
    for (const raw of records) {
      if (!raw || typeof raw.id !== 'string' || !raw.id) continue
      const record = coll === 'users' ? withoutPassword(raw) : raw
      const existing = index[coll].get(record.id)

      if (SERVER_ONLY.includes(coll)) {
        refuse(coll, record.id, 'kept by the portal')
        continue
      }

      if (admin) {
        if (coll === 'users') {
          const activating = record.active && !existing?.active
          if (activating && userLimit > 0 && activeUsers >= userLimit) {
            refuse(coll, record.id, `The active user limit of ${userLimit} set on the Subscription page has been reached.`, true)
            continue
          }
          if (activating) activeUsers += 1
          // What the server tracks about an account survives an edit made from a stale page.
          keep(coll, { ...record, ...pick(existing || {}, SERVER_USER_FIELDS) })
        } else keep(coll, record)
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
          } else if (!existing && record.userId === me.id && canSelfEnroll(db, settings, record.courseId, me.id)) {
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
          if (!existing && record.userId === me.id && completed(db, settings, incoming, me.id, record.courseId)) keep(coll, record)
          else refuse(coll, record.id, 'course not completed')
          break

        case 'enrollmentRequests':
          if (!existing && record.userId === me.id) keep(coll, { ...record, status: 'pending' })
          else refuse(coll, record.id, 'not your request')
          break

        case 'messages':
          if (!existing && record.fromId === me.id) keep(coll, { ...record, system: false })
          else if (existing && existing.toId === me.id) keep(coll, { ...existing, read: !!record.read })
          else refuse(coll, record.id, 'not your message')
          break

        case 'events':
          if (!existing && record.actorId === me.id) keep(coll, record)
          else if (!existing) refuse(coll, record.id, 'not your activity')
          break

        case 'discussions': {
          const courseId = existing?.courseId || record.courseId
          const member = teaches(courseId) || enrolledIn(courseId)
          if (!settings.courses.discussions || !member) refuse(coll, record.id, 'not your discussion')
          else if (!existing && record.userId === me.id)
            keep(coll, { ...pick(record, ['id', 'courseId', 'userId', 'parentId', 'body', 'at']), upvotes: [] })
          else if (existing && existing.userId === me.id)
            keep(coll, { ...existing, body: String(record.body ?? existing.body), editedAt: record.editedAt })
          else if (existing) {
            // Anyone else may only add or take back their own upvote.
            const others = (existing.upvotes || []).filter((id) => id !== me.id)
            keep(coll, { ...existing, upvotes: (record.upvotes || []).includes(me.id) ? [...others, me.id] : others })
          } else refuse(coll, record.id, 'not your post')
          break
        }

        case 'ratings':
          if (settings.courses.ratings && record.userId === me.id && (!existing || existing.userId === me.id) && enrolledIn(record.courseId))
            keep(coll, { ...pick(record, ['id', 'courseId', 'userId', 'comment', 'at']), stars: Math.min(5, Math.max(1, Math.round(Number(record.stars) || 0))) })
          else refuse(coll, record.id, 'not your rating')
          break

        case 'skillResults':
          if (!existing && record.userId === me.id && settings.skills.enabled && settings.skills.learners && index.skills.has(record.skillId))
            keep(coll, record)
          else refuse(coll, record.id, 'not your assessment')
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
        (admin && !(SERVER_ONLY.includes(coll) && coll !== 'outbox')) ||
        (isInstructor(me) && coll === 'enrollments' && teaches(existing.courseId)) ||
        (isInstructor(me) && coll === 'courses' && teaches(id)) ||
        (isInstructor(me) && coll === 'discussions' && teaches(existing.courseId)) ||
        ((coll === 'discussions' || coll === 'ratings') && existing.userId === me.id) ||
        // Staff browsers trim the activity log to its latest entries.
        (isInstructor(me) && coll === 'events')
      if (allowed && !(coll === 'users' && id === me.id)) out.deletes.push({ collection: coll, id })
      else if (coll !== 'events') refuse(coll, id, 'cannot delete')
    }
  }

  if (payload.settings) {
    const next = payload.settings
    const bad = badIpRules(next.security?.allowedIps)
    if (!admin) refuse('settings', 'portal', 'administrators only')
    else if (bad.length) refuse('settings', 'portal', `Allowed IP addresses: “${bad[0]}” is not an address, a block such as 203.0.113.0/24 or a range. Nothing was saved.`, true)
    else if (!ipAllowed(ip, next.security?.allowedIps))
      // Saving a list that leaves out the administrator's own network would lock them out on the spot.
      refuse('settings', 'portal', `Allowed IP addresses: the list does not include your own address (${ip}), so the settings were not saved.`, true)
    else out.upserts.push({ collection: 'settings', id: 'portal', data: next })
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

function canSelfEnroll(db, settings, courseId, userId) {
  const course = db.collections.courses.find((c) => c.id === courseId)
  const already = db.collections.enrollments.some((e) => e.userId === userId && e.courseId === courseId)
  // A course with a price is joined through checkout once the portal takes payments.
  const mustPay = Number(course?.price) > 0 && sellsCourses(settings)
  return (
    !already &&
    !!course &&
    course.status === 'active' &&
    course.enrollmentRequest === false &&
    !!settings.courses?.allowSelfEnrollment &&
    !mustPay
  )
}

function completed(db, settings, incoming, userId, courseId) {
  const course = db.collections.courses.find((c) => c.id === courseId)
  if (!course?.certificate || settings.courses.certificateEnabled === false) return false
  // One valid certificate per course; an expired one may be replaced by taking the course again.
  const valid = db.collections.certificates.some((c) => c.userId === userId && c.courseId === courseId && !certificateExpired(c, settings))
  if (valid) return false
  const pending = (incoming.enrollments || []).find((e) => e.userId === userId && e.courseId === courseId)
  const stored = db.collections.enrollments.find((e) => e.userId === userId && e.courseId === courseId)
  return (pending || stored)?.status === 'completed' && !!stored
}

/**
 * What a signed-in user must do before the portal opens for them: set up
 * two-factor, choose a new password, accept the terms of service.
 */
export function gateFor(user, auth, settings, { twoFactor }) {
  const gate = {}
  if (twoFactor && !auth?.totp?.enabled) gate.twoFactor = 'setup'
  if (user.mustChangePassword) gate.password = 'first'
  else if (passwordExpired(user.passwordChangedAt, settings)) gate.password = 'expired'
  if (needsTerms(user, settings)) gate.terms = termsVersion(settings.users.terms)
  return Object.keys(gate).length ? gate : null
}
