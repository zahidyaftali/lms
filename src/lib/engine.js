/**
 * What the portal does by itself: automations, notifications, learning-path
 * steps, webhooks and the housekeeping that runs on a timer.
 *
 * `react(before, after)` looks at how the portal changed and returns the record
 * changes that follow from it. `tick(state)` does the same for things that
 * depend on the clock (delayed automations, expiring certificates, idle accounts).
 *
 * No browser or Node APIs are used here. With the shared database the server
 * runs this after every accepted change (server/handler.js); without one the
 * browser runs it (DataContext).
 */
import { accessWindow } from './courseAccess.js'
import {
  DAY,
  certificateCode,
  certificateExpired,
  certificateExpiry,
  displayName,
  fillTemplate,
  isAdminRole,
  newEnrollment,
  pathProgress,
} from './rules.js'

const HOUR = 3600000

/** Notification triggers: the label administrators pick, and the portal event behind it. */
export const NOTIFICATION_EVENTS = [
  { label: 'User is created', type: 'user.created' },
  { label: 'User is enrolled in course', type: 'course.assigned' },
  { label: 'User completes course', type: 'course.completed' },
  { label: 'User fails a test', type: 'test.failed' },
  { label: 'Assignment is submitted', type: 'assignment.submitted' },
  { label: 'Assignment is graded', type: 'assignment.graded' },
  { label: 'Certificate is issued', type: 'certificate.issued' },
  { label: 'Instructor-led session is scheduled', type: 'session.scheduled' },
  { label: 'User has not logged in for 14 days', type: 'user.idle' },
  { label: 'Certificate expires in 30 days', type: 'certificate.expiring' },
]

export const NOTIFICATION_RECIPIENTS = ['The user', "The user's instructor", 'All administrators', 'Program director']

export const PLACEHOLDERS = [
  'user_name',
  'user_first_name',
  'user_email',
  'course_name',
  'unit_name',
  'grade',
  'session_name',
  'session_date',
  'certificate_code',
  'site_name',
  'login_url',
]

/** Events a webhook (Zapier, a store, your own system) can subscribe to. */
export const WEBHOOK_EVENTS = [
  { type: 'user.created', label: 'User is created' },
  { type: 'course.assigned', label: 'User is enrolled in a course' },
  { type: 'course.completed', label: 'User completes a course' },
  { type: 'course.failed', label: 'User fails a course' },
  { type: 'certificate.issued', label: 'Certificate is issued' },
  { type: 'assignment.submitted', label: 'Assignment is submitted' },
]

/** Automations that follow something happening, and the event each one waits for. */
const AUTOMATION_TRIGGERS = {
  assign_after_assignment: 'course.assigned',
  assign_after_completion: 'course.completed',
  assign_after_score: 'course.completed',
  assign_after_failure: 'course.failed',
  assign_after_creation: 'user.created',
  deactivate_after_completion: 'course.completed',
  deactivate_after_creation: 'user.created',
  points_on_completion: 'course.completed',
  url_on_completion: 'course.completed',
}

const byId = (list) => new Map((list || []).map((r) => [r.id, r]))

/* ------------------------------------------------------------ working copy */

class Work {
  constructor(state, ctx) {
    this.state = { ...state }
    this.ctx = ctx
    this.ops = { upserts: {}, deletes: {}, effects: [] }
    this.iso = new Date(ctx.now).toISOString()
  }
  list(coll) {
    return this.state[coll] || []
  }
  find(coll, id) {
    return this.list(coll).find((r) => r.id === id) || null
  }
  put(coll, record) {
    const list = this.list(coll)
    this.state[coll] = list.some((r) => r.id === record.id)
      ? list.map((r) => (r.id === record.id ? record : r))
      : [...list, record]
    const queued = (this.ops.upserts[coll] ||= [])
    const i = queued.findIndex((r) => r.id === record.id)
    if (i >= 0) queued[i] = record
    else queued.push(record)
  }
  remove(coll, id) {
    this.state[coll] = this.list(coll).filter((r) => r.id !== id)
    if (this.ops.upserts[coll]) this.ops.upserts[coll] = this.ops.upserts[coll].filter((r) => r.id !== id)
    ;(this.ops.deletes[coll] ||= []).push(id)
  }
  log(type, text, actorId) {
    if (this.state.settings?.security?.auditLog === false) return
    this.put('events', { id: this.ctx.makeId('ev'), type, text, actorId, targetId: null, at: this.iso })
  }
}

export const hasOps = (ops) =>
  !!ops && (Object.keys(ops.upserts).some((c) => ops.upserts[c].length) || Object.keys(ops.deletes).some((c) => ops.deletes[c].length))

/** The portal state with a set of engine changes applied. */
export function applyOps(state, ops) {
  const next = { ...state }
  for (const [coll, records] of Object.entries(ops.upserts)) {
    if (!records.length) continue
    const incoming = byId(records)
    const kept = (next[coll] || []).map((r) => incoming.get(r.id) || r)
    const known = new Set(kept.map((r) => r.id))
    next[coll] = [...kept, ...records.filter((r) => !known.has(r.id))]
  }
  for (const [coll, ids] of Object.entries(ops.deletes)) {
    if (ids.length) next[coll] = (next[coll] || []).filter((r) => !ids.includes(r.id))
  }
  return next
}

/* -------------------------------------------------------- what just happened */

/** Unchanged records keep their identity between `before` and `after`, so only real changes are examined. */
export function detectEvents(before, after) {
  const events = []

  if (before.users !== after.users) {
    const old = byId(before.users)
    for (const u of after.users || []) if (!old.has(u.id)) events.push({ type: 'user.created', userId: u.id })
  }

  if (before.enrollments !== after.enrollments) {
    const old = byId(before.enrollments)
    for (const e of after.enrollments || []) {
      const was = old.get(e.id)
      if (was === e) continue
      const base = { userId: e.userId, courseId: e.courseId }
      if (!was) events.push({ type: 'course.assigned', ...base })
      if (e.status === 'completed' && was?.status !== 'completed') events.push({ type: 'course.completed', ...base, score: e.score })
      if (e.status === 'failed' && was?.status !== 'failed') events.push({ type: 'course.failed', ...base })
      for (const [unitId, count] of Object.entries(e.attempts || {})) {
        if (count > (was?.attempts?.[unitId] || 0) && !(e.completedUnits || []).includes(unitId))
          events.push({ type: 'test.failed', ...base, unitId })
      }
    }
  }

  if (before.submissions !== after.submissions) {
    const old = byId(before.submissions)
    for (const s of after.submissions || []) {
      const was = old.get(s.id)
      if (was === s) continue
      const base = { userId: s.userId, courseId: s.courseId, unitId: s.unitId, submissionId: s.id }
      if (!was && s.type === 'assignment') events.push({ type: 'assignment.submitted', ...base })
      if (s.status === 'graded' && was && was.status !== 'graded') events.push({ type: 'assignment.graded', ...base, grade: s.grade })
    }
  }

  if (before.certificates !== after.certificates) {
    const old = byId(before.certificates)
    for (const c of after.certificates || []) {
      if (!old.has(c.id)) events.push({ type: 'certificate.issued', userId: c.userId, courseId: c.courseId, pathId: c.pathId, certificateId: c.id })
    }
  }

  if (before.courses !== after.courses) {
    const old = byId(before.courses)
    for (const course of after.courses || []) {
      const was = old.get(course.id)
      if (was === course) continue
      const known = new Set((was?.units || []).flatMap((u) => (u.type === 'ilt' ? (u.data?.sessions || []).map((s) => s.id) : [])))
      for (const unit of course.units || []) {
        if (unit.type !== 'ilt') continue
        for (const session of unit.data?.sessions || []) {
          // A brand-new course has no learners yet, so only sessions added to a known course are announced.
          if (was && !known.has(session.id) && session.start) events.push({ type: 'session.scheduled', courseId: course.id, unitId: unit.id, session })
        }
      }
    }
  }

  return events
}

/* ------------------------------------------------------------------ actions */

function assign(work, userId, courseIds, extra = {}) {
  const user = work.find('users', userId)
  if (!user) return []
  const added = []
  for (const courseId of courseIds || []) {
    if (!work.find('courses', courseId)) continue
    if (work.list('enrollments').some((e) => e.userId === userId && e.courseId === courseId)) continue
    work.put('enrollments', newEnrollment(work.ctx.makeId('en'), userId, courseId, work.iso, extra))
    added.push(courseId)
  }
  return added
}

function resetProgress(work, userId, courseId) {
  const e = work.list('enrollments').find((x) => x.userId === userId && x.courseId === courseId)
  if (!e) return
  work.put('enrollments', {
    ...e,
    completedUnits: [],
    status: 'not_started',
    score: null,
    completedAt: null,
    attempts: {},
    scores: {},
    failedAt: null,
    markedComplete: false,
    enrolledAt: work.iso,
  })
}

function deactivate(work, userId, why) {
  const user = work.find('users', userId)
  if (!user || !user.active || isAdminRole(user)) return false
  work.put('users', { ...user, active: false, deactivatedAt: work.iso, deactivatedBy: why })
  work.log('user', `was deactivated — ${why}`, userId)
  return true
}

function runAutomation(work, a, { userId, courseId, score }) {
  const names = (ids) => ids.map((id) => work.find('courses', id)?.name).filter(Boolean).join(', ')
  const by = `the automation “${a.name}”`
  switch (a.rule) {
    case 'assign_after_assignment':
    case 'assign_after_completion':
    case 'assign_after_score':
    case 'assign_after_failure':
    case 'assign_before_expiry':
    case 'assign_after_creation': {
      const added = assign(work, userId, a.targetCourseIds, { automationId: a.id })
      if (added.length) work.log('user', `was enrolled in ${names(added)} by ${by}`, userId)
      break
    }
    case 'reassign_after_certificate':
    case 'reassign_before_certificate': {
      resetProgress(work, userId, a.courseId)
      const added = assign(work, userId, a.targetCourseIds, { automationId: a.id })
      work.log('user', `had ${names([a.courseId]) || 'a course'} reset${added.length ? ` and was enrolled in ${names(added)}` : ''} by ${by}`, userId)
      break
    }
    case 'deactivate_after_completion':
    case 'deactivate_after_creation':
    case 'deactivate_inactive':
      deactivate(work, userId, by)
      break
    case 'points_on_completion': {
      const user = work.find('users', userId)
      if (user) work.put('users', { ...user, bonusPoints: (Number(user.bonusPoints) || 0) + (Number(a.points) || 0) })
      break
    }
    case 'url_on_completion':
      work.ops.effects.push({ type: 'webhook', url: a.url, payload: payloadFor(work, { type: 'course.completed', userId, courseId, score }) })
      break
    default:
      return
  }
  const fresh = work.find('automations', a.id)
  if (fresh) work.put('automations', { ...fresh, runs: (Number(fresh.runs) || 0) + 1, lastRunAt: work.iso })
}

function matches(a, ev) {
  if (!a.active || AUTOMATION_TRIGGERS[a.rule] !== ev.type) return false
  if (ev.type !== 'user.created' && a.courseId !== ev.courseId) return false
  if (a.rule === 'assign_after_score') {
    const score = Number(ev.score)
    if (ev.score == null || score < Number(a.scoreMin) || score > Number(a.scoreMax)) return false
  }
  return true
}

/* ------------------------------------------------------------ notifications */

function payloadFor(work, ev) {
  const user = work.find('users', ev.userId)
  const course = work.find('courses', ev.courseId)
  return {
    event: ev.type,
    at: work.iso,
    portal: work.ctx.origin || '',
    user: user ? { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, userType: user.userType } : null,
    course: course ? { id: course.id, name: course.name, code: course.code || '' } : null,
    score: ev.score ?? null,
    grade: ev.grade ?? null,
  }
}

function templateValues(work, ev) {
  const settings = work.state.settings || {}
  const user = work.find('users', ev.userId)
  const course = work.find('courses', ev.courseId)
  const path = ev.pathId ? work.find('learningPaths', ev.pathId) : null
  const unit = course?.units?.find((u) => u.id === ev.unitId)
  const certificate = ev.certificateId ? work.find('certificates', ev.certificateId) : null
  const origin = work.ctx.origin || ''
  return {
    user_name: user ? displayName(user) : '',
    user_first_name: user?.firstName || '',
    user_email: user?.email || '',
    course_name: course?.name || path?.name || '',
    unit_name: unit?.name || '',
    grade: ev.grade != null ? `${ev.grade}%` : ev.score != null ? `${ev.score}%` : '',
    session_name: ev.session?.name || unit?.name || '',
    session_date: ev.session?.start ? new Date(ev.session.start).toLocaleString('en-US') : '',
    certificate_code: certificate?.code || '',
    site_name: settings.siteName || '',
    login_url: `${origin}/login`,
  }
}

const DEFAULT_BODY = {
  'user.created': 'Hello {user_first_name},\n\nYour account at {site_name} is ready. Sign in at {login_url}.',
  'course.assigned': 'Hello {user_first_name},\n\nYou have been enrolled in {course_name}. Sign in at {login_url} to start.',
  'course.completed': '{user_name} completed {course_name}.',
  'test.failed': '{user_name} did not pass {unit_name} in {course_name}.',
  'assignment.submitted': '{user_name} submitted {unit_name} in {course_name}. It is waiting for review.',
  'assignment.graded': 'Hello {user_first_name},\n\n{unit_name} in {course_name} has been graded: {grade}.',
  'certificate.issued': 'Hello {user_first_name},\n\nYour certificate for {course_name} is ready ({certificate_code}).',
  'session.scheduled': 'Hello {user_first_name},\n\n{session_name} for {course_name} is scheduled for {session_date}.',
  'user.idle': 'Hello {user_first_name},\n\nIt has been a while since you signed in to {site_name}. Pick up where you left off at {login_url}.',
  'certificate.expiring': 'Hello {user_first_name},\n\nYour certificate for {course_name} ({certificate_code}) expires within 30 days.',
}

/** Puts a message in someone's portal inbox and queues the same text as an email. */
function deliver(work, to, subject, body, meta = {}) {
  if (!to) return
  if (meta.inbox !== false) {
    work.put('messages', { id: work.ctx.makeId('m'), fromId: null, system: true, toId: to.id, subject, body, sentAt: work.iso, read: false })
  }
  if (to.email && meta.email !== false) {
    work.put('outbox', {
      id: work.ctx.makeId('ob'),
      toUserId: to.id,
      to: to.email,
      subject,
      body,
      at: work.iso,
      status: 'queued',
      kind: meta.kind || 'notification',
      rule: meta.rule || '',
      ...(meta.privateBody ? { privateBody: meta.privateBody } : {}),
    })
  }
}

function recipientsOf(work, rule, ev) {
  const users = work.list('users').filter((u) => u.active)
  const course = work.find('courses', ev.courseId)
  switch (rule.recipient) {
    case "The user's instructor":
      return users.filter((u) => (course?.instructorIds || []).includes(u.id))
    case 'All administrators':
      return users.filter(isAdminRole)
    case 'Program director':
      return users.filter((u) => u.role === 'superadmin')
    default: {
      const user = work.find('users', ev.userId)
      return user ? [user] : []
    }
  }
}

function notify(work, ev) {
  const label = NOTIFICATION_EVENTS.find((e) => e.type === ev.type)?.label
  if (!label) return
  const rules = work.list('notifications').filter((n) => n.active && n.event === label)
  if (!rules.length) return
  const values = templateValues(work, ev)
  for (const rule of rules) {
    const subject = fillTemplate(rule.subject?.trim() || rule.name, values)
    const body = fillTemplate(rule.body?.trim() || DEFAULT_BODY[ev.type] || '', values)
    // The welcome email already carries a new user's login details, so this rule only reaches their inbox.
    const email = !(ev.type === 'user.created' && rule.recipient === 'The user' && work.state.settings?.users?.welcomeEmail)
    for (const to of recipientsOf(work, rule, ev)) deliver(work, to, subject, body, { rule: rule.name, email })
  }
}

function sendWebhooks(work, ev) {
  for (const hook of work.state.settings?.webhooks || []) {
    if (!hook.active || !hook.url || !(hook.events || []).includes(ev.type)) continue
    work.ops.effects.push({ type: 'webhook', url: hook.url, hookId: hook.id, payload: payloadFor(work, ev) })
  }
}

/* --------------------------------------------------------------- one event */

function advancePaths(work, ev) {
  const settings = work.state.settings || {}
  for (const path of work.list('learningPaths')) {
    if (path.status !== 'active' || !(path.userIds || []).includes(ev.userId) || !(path.courseIds || []).includes(ev.courseId)) continue
    const p = pathProgress(path, ev.userId, work.state, work.ctx.now)
    if (p.expired) continue
    if (path.ordered && p.next && !p.next.enrollment) assign(work, ev.userId, [p.next.courseId], { pathId: path.id })
    const hasCertificate = work.list('certificates').some((c) => c.userId === ev.userId && c.pathId === path.id)
    if (p.completed && path.certificate && settings.courses?.certificateEnabled !== false && !hasCertificate) {
      work.put('certificates', {
        id: work.ctx.makeId('cert'),
        userId: ev.userId,
        pathId: path.id,
        issuedAt: work.iso,
        type: String(settings.courses?.certificateTemplate || 'Classic').toLowerCase(),
        code: certificateCode(path.code || 'PATH'),
      })
      work.log('completion', `completed the learning path ${path.name}`, ev.userId)
    }
  }
}

/** A completed course earns its certificate, unless the learner already holds one that is still valid. */
function issueCertificate(work, ev) {
  const settings = work.state.settings || {}
  const course = work.find('courses', ev.courseId)
  if (!course?.certificate || settings.courses?.certificateEnabled === false) return
  const valid = work.list('certificates').some((c) => c.userId === ev.userId && c.courseId === ev.courseId && !certificateExpired(c, settings, work.ctx.now))
  if (valid) return
  work.put('certificates', {
    id: work.ctx.makeId('cert'),
    userId: ev.userId,
    courseId: ev.courseId,
    issuedAt: work.iso,
    type: course.certificateType || String(settings.courses?.certificateTemplate || 'Classic').toLowerCase(),
    code: certificateCode(course.code),
  })
}

function welcome(work, ev) {
  const settings = work.state.settings || {}
  const user = work.find('users', ev.userId)
  if (!settings.users?.welcomeEmail || !user?.active || !user.email) return
  const password = work.ctx.passwords?.[user.id]
  const origin = work.ctx.origin || ''
  const text = (passwordLine) =>
    [
      `Hello ${user.firstName || ''},`.replace(' ,', ','),
      '',
      `Your account at ${settings.siteName} is ready.`,
      '',
      `Sign in at: ${origin}/login`,
      `Email: ${user.email}`,
      passwordLine,
      '',
      settings.siteName,
    ].join('\n')
  // The password goes out in the email only. What is kept in the Sent log never contains it.
  deliver(work, user, `Your ${settings.siteName} account`, text('Your password was set by the program office. If you do not have it, ask them for a new one.'), {
    kind: 'welcome',
    inbox: false,
    privateBody: password ? text(`Password: ${password}`) : undefined,
  })
}

function handle(work, ev) {
  if (ev.type === 'course.completed') {
    issueCertificate(work, ev)
    advancePaths(work, ev)
  }
  if (ev.type === 'user.created') welcome(work, ev)

  for (const a of work.list('automations')) {
    if (!matches(a, ev)) continue
    const hours = Number(a.hours) || 0
    if (hours > 0) {
      work.put('jobs', {
        id: work.ctx.makeId('jb'),
        automationId: a.id,
        userId: ev.userId,
        courseId: ev.courseId || null,
        score: ev.score ?? null,
        runAt: new Date(work.ctx.now + hours * HOUR).toISOString(),
        status: 'pending',
        createdAt: work.iso,
      })
    } else runAutomation(work, a, ev)
  }

  if (ev.type === 'session.scheduled') {
    // Announced to everyone enrolled in the course.
    for (const e of work.list('enrollments')) if (e.courseId === ev.courseId) notify(work, { ...ev, userId: e.userId })
  } else notify(work, ev)

  sendWebhooks(work, ev)
}

/** Handles the events between `before` and the working state, then whatever those changes set off in turn. */
function cascade(work, before) {
  let prev = before
  for (let round = 0; round < 4; round++) {
    const events = detectEvents(prev, work.state)
    if (!events.length) return
    prev = { ...work.state }
    for (const ev of events) handle(work, ev)
  }
}

/**
 * ctx: { now (ms), makeId(prefix), origin (portal address), passwords? { userId: plain text } }
 * Returns { upserts: { collection: [records] }, deletes: { collection: [ids] }, effects: [{ type: 'webhook', … }] }
 */
export function react(before, after, ctx) {
  const work = new Work(after, ctx)
  cascade(work, before)
  return work.ops
}

/* ------------------------------------------------------------- on the clock */

function once(work, key) {
  const id = `jb_${key}`
  if (work.find('jobs', id)) return false
  work.put('jobs', { id, marker: true, status: 'done', runAt: work.iso, doneAt: work.iso, createdAt: work.iso })
  return true
}

function runDueJobs(work) {
  for (const job of work.list('jobs')) {
    if (job.status !== 'pending' || new Date(job.runAt).getTime() > work.ctx.now) continue
    const a = work.find('automations', job.automationId)
    if (a?.active) runAutomation(work, a, job)
    work.put('jobs', { ...job, status: a?.active ? 'done' : 'skipped', doneAt: work.iso })
  }
}

function timedAutomations(work) {
  const { now } = work.ctx
  const settings = work.state.settings || {}
  for (const a of work.list('automations')) {
    if (!a.active) continue
    const lead = Math.max(0, Number(a.hours) || 0) * HOUR

    if (a.rule === 'assign_before_expiry') {
      const course = work.find('courses', a.courseId)
      for (const e of work.list('enrollments')) {
        if (e.courseId !== a.courseId || e.status === 'completed') continue
        const { ends } = accessWindow(course, e, now)
        if (ends && now >= ends - lead && now <= ends && once(work, `${a.id}_${e.id}`)) runAutomation(work, a, e)
      }
    }

    if (a.rule === 'reassign_after_certificate' || a.rule === 'reassign_before_certificate') {
      for (const c of work.list('certificates')) {
        if (c.courseId !== a.courseId) continue
        const ends = certificateExpiry(c, settings)
        if (!ends) continue
        const due = a.rule === 'reassign_after_certificate' ? now >= ends + lead : now >= ends - lead && now < ends
        if (due && once(work, `${a.id}_${c.id}`)) runAutomation(work, a, c)
      }
    }

    if (a.rule === 'deactivate_inactive') {
      const limit = Math.max(1, Number(a.days) || 0) * DAY
      for (const u of work.list('users')) {
        if (!u.active || isAdminRole(u)) continue
        const seen = new Date(u.lastLogin || u.registeredAt || now).getTime()
        if (now - seen > limit) runAutomation(work, a, { userId: u.id })
      }
    }
  }
}

function timedNotifications(work) {
  const { now } = work.ctx
  const settings = work.state.settings || {}
  const active = (label) => work.list('notifications').some((n) => n.active && n.event === label)

  if (active('User has not logged in for 14 days')) {
    for (const u of work.list('users')) {
      if (!u.active || !u.lastLogin || now - new Date(u.lastLogin).getTime() < 14 * DAY) continue
      if (once(work, `idle_${u.id}_${new Date(u.lastLogin).getTime().toString(36)}`)) notify(work, { type: 'user.idle', userId: u.id })
    }
  }

  if (active('Certificate expires in 30 days')) {
    for (const c of work.list('certificates')) {
      const ends = certificateExpiry(c, settings)
      if (!ends || certificateExpired(c, settings, now) || ends - now > 30 * DAY) continue
      if (once(work, `certexp_${c.id}`))
        notify(work, { type: 'certificate.expiring', userId: c.userId, courseId: c.courseId, pathId: c.pathId, certificateId: c.id })
    }
  }
}

/** Account & Settings → Users → "Deactivate after inactivity". Administrators are never deactivated. */
function deactivateIdle(work) {
  const days = Number(work.state.settings?.users?.inactivityDays) || 0
  if (!days) return
  for (const u of work.list('users')) {
    if (!u.active || isAdminRole(u)) continue
    const seen = new Date(u.lastLogin || u.registeredAt || work.ctx.now).getTime()
    if (work.ctx.now - seen > days * DAY) deactivate(work, u.id, `no sign-in for ${days} days`)
  }
}

function prune(work) {
  const cutoff = work.ctx.now - 180 * DAY
  for (const job of work.list('jobs')) {
    if (job.status !== 'pending' && new Date(job.doneAt || job.runAt).getTime() < cutoff) work.remove('jobs', job.id)
  }
  const outbox = [...work.list('outbox')].sort((a, b) => (a.at < b.at ? 1 : -1))
  for (const mail of outbox.slice(300)) work.remove('outbox', mail.id)
}

export function tick(state, ctx) {
  const work = new Work(state, ctx)
  runDueJobs(work)
  timedAutomations(work)
  timedNotifications(work)
  deactivateIdle(work)
  cascade(work, state)
  prune(work)
  return work.ops
}

/** Queues an email outside the rules above (verification links, invoices, test messages). */
export function mailRecord(makeId, now, { to, toUserId = null, subject, body, kind = 'system' }) {
  return { id: makeId('ob'), toUserId, to, subject, body, at: new Date(now).toISOString(), status: 'queued', kind, rule: '' }
}
