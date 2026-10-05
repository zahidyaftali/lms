/**
 * The portal's rules: passwords, names, course completion, certificates,
 * learning paths, skills and sign-in networks.
 *
 * Plain JavaScript with no imports, so the server applies exactly the rules the
 * browser shows (see server/handler.js and server/access.js).
 */

export const DAY = 86400000

/* ---------------------------------------------------------------- passwords */

export const passwordPolicy = (settings) => ({
  minLength: Math.max(4, Number(settings?.users?.passwordMinLength) || 8),
  strong: !!settings?.security?.strongPasswords,
})

/** Returns an error message, or null when the password can be saved as typed. */
export function passwordProblem(password, policy = {}) {
  const { minLength = 8, strong = false } = typeof policy === 'number' ? { minLength: policy } : policy
  if (typeof password !== 'string' || !password) return 'Type a password or click Generate.'
  if (password !== password.trim()) return 'Remove the spaces at the start or end of the password.'
  if (password.length < minLength) return `Use at least ${minLength} characters.`
  if (strong && !(/[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password)))
    return 'Use at least one uppercase letter, one lowercase letter and one number.'
  return null
}

export function passwordHint(policy) {
  return `At least ${policy.minLength} characters${policy.strong ? ', with an uppercase letter, a lowercase letter and a number' : ''}.`
}

/** Whether a password set at `changedAt` has run past the expiry in Account & Settings → Security. */
export function passwordExpired(changedAt, settings, now = Date.now()) {
  const days = Number(settings?.security?.passwordExpiryDays) || 0
  if (!days || !changedAt) return false
  return now - new Date(changedAt).getTime() > days * DAY
}

/* -------------------------------------------------------------------- names */

export function displayName(user, format) {
  if (!user) return 'Unknown user'
  const first = (user.firstName || '').trim()
  const last = (user.lastName || '').trim()
  if (format === 'Email address') return user.email || `${first} ${last}`.trim() || 'Unknown user'
  if (format === 'First initial and last name' && first && last) return `${first[0]}. ${last}`
  return `${first} ${last}`.trim() || user.email || 'Unknown user'
}

export const isAdminRole = (user) => user?.role === 'superadmin' || user?.role === 'admin'

/* ----------------------------------------------------------------- courses */

export const contentUnits = (course) => (course?.units || []).filter((u) => u.type !== 'section')

export const COMPLETION_RULES = [
  'All units must be completed',
  'Only the final test must be passed',
  'Instructor marks the course complete',
]

/** Whether the units a learner has finished complete the course under its completion rule. */
export function courseIsComplete(course, completedUnits = [], enrollment = null) {
  const units = contentUnits(course)
  if (!units.length) return false
  if (enrollment?.markedComplete) return true
  if (course.completionRule === 'Instructor marks the course complete') return false
  if (course.completionRule === 'Only the final test must be passed') {
    const tests = units.filter((u) => u.type === 'test')
    // A course with no test falls back to "all units", or it could never be completed.
    if (tests.length) return completedUnits.includes(tests[tests.length - 1].id)
  }
  return units.every((u) => completedUnits.includes(u.id))
}

/** With units taken in order, a unit opens once every unit before it is completed. */
export function unitLocked(course, completedUnits = [], unitId, sequential) {
  if (!sequential) return false
  for (const unit of contentUnits(course)) {
    if (unit.id === unitId) return false
    if (!completedUnits.includes(unit.id)) return true
  }
  return false
}

export function testAttemptsLeft(unit, enrollment) {
  const max = Number(unit?.data?.maxAttempts) || 0
  if (!max) return Infinity
  return Math.max(0, max - (Number(enrollment?.attempts?.[unit.id]) || 0))
}

export const STATUS_LABEL = {
  completed: 'Completed',
  in_progress: 'In progress',
  failed: 'Failed',
  not_started: 'Not started',
}
export const STATUS_TONE = { completed: 'green', in_progress: 'blue', failed: 'red', not_started: 'gray' }
export const statusLabel = (status) => STATUS_LABEL[status] || STATUS_LABEL.not_started
export const statusTone = (status) => STATUS_TONE[status] || 'gray'

/** A brand-new enrollment record. */
export function newEnrollment(id, userId, courseId, at, extra = {}) {
  return {
    id,
    userId,
    courseId,
    enrolledAt: at,
    completedUnits: [],
    status: 'not_started',
    score: null,
    completedAt: null,
    timeSpentMin: 0,
    ...extra,
  }
}

/* ------------------------------------------------------------- certificates */

export function certificateExpiry(certificate, settings) {
  const months = parseInt(settings?.courses?.certificateValidity, 10)
  if (!months || !certificate?.issuedAt) return null
  const d = new Date(certificate.issuedAt)
  d.setMonth(d.getMonth() + months)
  return d.getTime()
}

export function certificateExpired(certificate, settings, now = Date.now()) {
  const ends = certificateExpiry(certificate, settings)
  return ends != null && now > ends
}

export function certificateCode(code, random = Math.random) {
  return `GA-${(code || 'CRS').toUpperCase()}-${Math.floor(1000 + random() * 8999)}`
}

/** A short fingerprint of the terms of service, so changing the text asks everyone to accept again. */
export function termsVersion(text) {
  let h = 5381
  const s = String(text || '').trim()
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h.toString(36)
}

export function needsTerms(user, settings) {
  const u = settings?.users
  // Administrators write the terms; they are not stopped by them.
  if (!u?.termsOn || !String(u.terms || '').trim() || isAdminRole(user)) return false
  return user?.termsAccepted !== termsVersion(u.terms)
}

/* ----------------------------------------------------------- learning paths */

export const PATH_RULES = ['All courses must be completed', 'Only the last course must be completed']

/**
 * A learner's position on a learning path.
 * Returns { steps: [{ courseId, course, state }], done, total, completed, expired, expiresAt, next }
 * where state is 'completed' | 'open' | 'locked'.
 */
export function pathProgress(path, userId, state, now = Date.now()) {
  const courses = new Map((state.courses || []).map((c) => [c.id, c]))
  const mine = new Map(
    (state.enrollments || []).filter((e) => e.userId === userId).map((e) => [e.courseId, e]),
  )
  const ids = (path.courseIds || []).filter((id) => courses.has(id))
  let blocked = false
  const steps = ids.map((courseId) => {
    const enrollment = mine.get(courseId) || null
    const completed = enrollment?.status === 'completed'
    const step = { courseId, course: courses.get(courseId), enrollment, state: completed ? 'completed' : blocked ? 'locked' : 'open' }
    if (path.ordered && !completed) blocked = true
    return step
  })
  const done = steps.filter((s) => s.state === 'completed').length
  const last = steps[steps.length - 1]
  const completed =
    steps.length > 0 &&
    (path.completionRule === PATH_RULES[1] ? last.state === 'completed' : done === steps.length)
  const joined = path.joined?.[userId] || path.createdAt
  const days = Number(path.timeLimitDays) || 0
  const expiresAt = days > 0 && joined ? new Date(joined).getTime() + days * DAY : null
  return {
    steps,
    done,
    total: steps.length,
    completed,
    expiresAt,
    expired: !completed && expiresAt != null && now > expiresAt,
    next: steps.find((s) => s.state === 'open') || null,
  }
}

/* ------------------------------------------------------------------- skills */

export const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced']

/**
 * Whether a user holds a skill, and how. A skill is earned by being given it by
 * an administrator, by completing a course linked to it, or by passing its
 * assessment; assessment passes expire after the months set in settings.
 */
export function skillStatus(skill, userId, state, settings, now = Date.now()) {
  const s = settings?.skills || {}
  const results = (state.skillResults || [])
    .filter((r) => r.skillId === skill.id && r.userId === userId)
    .sort((a, b) => (a.at < b.at ? 1 : -1))
  const months = Number(s.expiryMonths) || 0
  const live = (r) => {
    if (!months) return true
    const d = new Date(r.at)
    d.setMonth(d.getMonth() + months)
    return d.getTime() > now
  }
  const passes = results.filter((r) => r.passed && live(r))
  const assigned = (skill.userIds || []).includes(userId)
  const byCourse = (state.enrollments || []).some(
    (e) => e.userId === userId && e.status === 'completed' && (skill.courseIds || []).includes(e.courseId),
  )
  const last = results[0] || null
  const retryAt =
    last && !last.passed ? new Date(last.at).getTime() + (Number(s.retryDays) || 0) * DAY : null
  const maxLevel = s.levels ? SKILL_LEVELS.length : 1
  const level = Math.min(maxLevel, passes.length + (assigned || byCourse ? 1 : 0))
  let expiresAt = null
  if (!assigned && !byCourse && passes.length && months) {
    const d = new Date(passes[0].at)
    d.setMonth(d.getMonth() + months)
    expiresAt = d.getTime()
  }
  return {
    earned: assigned || byCourse || passes.length > 0,
    source: assigned ? 'assigned' : byCourse ? 'course' : passes.length ? 'assessment' : null,
    level: Math.max(assigned || byCourse || passes.length ? 1 : 0, level),
    maxLevel,
    last,
    retryAt: retryAt && retryAt > now ? retryAt : null,
    expiresAt,
    hasAssessment: (skill.questions || []).length > 0,
  }
}

/* ----------------------------------------------------------------- networks */

const ipv4ToInt = (ip) => {
  const parts = String(ip).split('.')
  if (parts.length !== 4) return null
  let n = 0
  for (const p of parts) {
    const v = Number(p)
    if (!/^\d{1,3}$/.test(p) || v > 255) return null
    n = n * 256 + v
  }
  return n
}

export function normalizeIp(ip) {
  let v = String(ip || '').trim()
  if (v.includes(',')) v = v.split(',')[0].trim()
  if (v.startsWith('::ffff:')) v = v.slice(7)
  if (v === '::1') v = '127.0.0.1'
  return v.toLowerCase()
}

/**
 * `list` is the "Allowed IP addresses" box: one address, CIDR block (203.0.113.0/24)
 * or range (203.0.113.5-203.0.113.40) per line. An empty list allows everyone.
 */
export function ipAllowed(ip, list) {
  const rules = String(list || '')
    .split(/[\n,;]+/)
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean)
  if (!rules.length) return true
  const addr = normalizeIp(ip)
  const n = ipv4ToInt(addr)
  return rules.some((rule) => {
    if (rule === addr) return true
    if (n == null) return false
    if (rule.includes('/')) {
      const [base, bits] = rule.split('/')
      const b = ipv4ToInt(base)
      const size = Number(bits)
      if (b == null || !(size >= 0 && size <= 32)) return false
      const span = 2 ** (32 - size)
      return Math.floor(n / span) === Math.floor(b / span)
    }
    if (rule.includes('-')) {
      const [from, to] = rule.split('-').map((x) => ipv4ToInt(x.trim()))
      return from != null && to != null && n >= from && n <= to
    }
    return false
  })
}

/** Lines of the allow list that are not an address, block or range. */
export function badIpRules(list) {
  return String(list || '')
    .split(/[\n,;]+/)
    .map((r) => r.trim())
    .filter(Boolean)
    .filter((rule) => {
      if (rule.includes('/')) {
        const [base, bits] = rule.split('/')
        return ipv4ToInt(base) == null || !/^\d{1,2}$/.test(bits) || Number(bits) > 32
      }
      if (rule.includes('-')) return rule.split('-').some((x) => ipv4ToInt(x.trim()) == null)
      return ipv4ToInt(rule) == null && !/^[0-9a-f:]+$/i.test(rule)
    })
}

/* ------------------------------------------------------------- registration */

export function emailDomainAllowed(email, allowedDomains) {
  const domains = String(allowedDomains || '')
    .split(/[\s,;]+/)
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean)
  if (!domains.length) return true
  const domain = String(email || '').toLowerCase().split('@')[1] || ''
  return domains.includes(domain)
}

/** Which roles must use two-factor authentication under the Security settings. */
export function twoFactorRequired(user, settings) {
  const s = settings?.security
  if (!s?.twoFactor) return false
  if (s.twoFactorFor === 'Everyone') return true
  if (s.twoFactorFor === 'Administrators and instructors') return isAdminRole(user) || user?.role === 'instructor'
  return isAdminRole(user)
}

/** Fills {placeholders} in notification subjects and messages. */
export function fillTemplate(text, values) {
  return String(text || '').replace(/\{(\w+)\}/g, (whole, key) => (values[key] != null ? String(values[key]) : whole))
}
