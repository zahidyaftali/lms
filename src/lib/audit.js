/**
 * The admin History log: who created, edited or deleted users and courses, who
 * set whose password, and who changed portal settings.
 *
 * Plain JavaScript with no imports, so the same rules run on the server (which
 * records every change it accepts, with the signed-in user as the actor) and in
 * the browser when no database is connected.
 *
 * Entry: { id, at, actorId, actorName, action, targetId, targetName, note, changes[] }
 * action: user.create | user.update | user.delete | user.password |
 *         course.create | course.update | course.delete | settings.update
 */

export const AUDIT_LIMIT = 2000
const MERGE_WINDOW_MS = 10 * 60 * 1000

const USER_FIELDS = {
  firstName: 'first name',
  lastName: 'last name',
  email: 'email',
  userType: 'user type',
  active: 'status',
  branchId: 'branch',
  groupIds: 'groups',
  phone: 'phone',
  bio: 'bio',
  avatar: 'photo',
}

const COURSE_FIELDS = {
  name: 'name',
  code: 'code',
  description: 'description',
  categoryId: 'category',
  price: 'price',
  status: 'status',
  level: 'difficulty',
  cover: 'banner theme',
  instructorIds: 'instructors',
  capacity: 'capacity',
  showInCatalog: 'catalog visibility',
  publicSharing: 'public sharing',
  enrollmentRequest: 'enrollment request',
  timeMode: 'time rule',
  timeLimitDays: 'time limit',
  startDate: 'start date',
  endDate: 'end date',
  retainAccess: 'access retention',
  certificate: 'certificate',
  certificateType: 'certificate type',
  completionRule: 'completion rule',
  introVideo: 'intro video',
}

const SETTINGS_FIELDS = {
  siteName: 'site name',
  siteDescription: 'site description',
  logo: 'logo',
  website: 'website',
  supportEmail: 'support email',
  supportPhone: 'support phone',
  address: 'address',
  timezone: 'time zone',
  language: 'language',
  dateFormat: 'date format',
  users: 'user settings',
  courses: 'course settings',
  security: 'security settings',
}

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
const nameOf = (u) => (u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || 'Unknown user' : 'Unknown user')
const money = (n) => `$${Number(n || 0).toLocaleString('en-US')}`

function userChanges(before, after) {
  const out = []
  for (const [key, label] of Object.entries(USER_FIELDS)) {
    if (same(before[key], after[key])) continue
    if (key === 'active') out.push(after.active ? 'activated' : 'deactivated')
    else if (key === 'userType') out.push(`user type ${before.userType || '—'} → ${after.userType || '—'}`)
    else out.push(label)
  }
  return out
}

function courseChanges(before, after) {
  const out = []
  for (const [key, label] of Object.entries(COURSE_FIELDS)) {
    if (same(before[key], after[key])) continue
    if (key === 'status') out.push(after.status === 'active' ? 'activated' : 'deactivated')
    else if (key === 'price') out.push(`price ${money(before.price)} → ${money(after.price)}`)
    else out.push(label)
  }
  const was = new Map((before.units || []).map((u) => [u.id, u]))
  const now = new Map((after.units || []).map((u) => [u.id, u]))
  for (const [id, unit] of now) {
    if (!was.has(id)) out.push(`added unit "${unit.name}"`)
    else if (!same(was.get(id), unit)) out.push(`edited unit "${unit.name}"`)
  }
  for (const [id, unit] of was) if (!now.has(id)) out.push(`removed unit "${unit.name}"`)
  const order = (list) => (list || []).map((u) => u.id).filter((id) => was.has(id) && now.has(id))
  if (!same(order(before.units), order(after.units))) out.push('reordered units')
  return out
}

/**
 * Entries describing how `after` differs from `before` ({ users, courses, settings }).
 * `passwords` lists user ids whose password was just set (the server passes these;
 * in the browser a changed `password` field is detected directly).
 */
export function auditFor(before, after, { actor, passwords = [], at, makeId }) {
  const entries = []
  const base = { actorId: actor?.id || null, actorName: nameOf(actor), at }
  const add = (entry) => entries.push({ id: makeId(), ...base, note: '', changes: [], ...entry })

  const usersBefore = new Map((before.users || []).map((u) => [u.id, u]))
  const usersAfter = new Map((after.users || []).map((u) => [u.id, u]))
  const created = new Set()
  for (const [id, u] of usersAfter) {
    const old = usersBefore.get(id)
    if (!old) {
      created.add(id)
      add({ action: 'user.create', targetId: id, targetName: nameOf(u), note: [u.email, u.userType].filter(Boolean).join(' · ') })
      continue
    }
    const changes = userChanges(old, u)
    if (changes.length) add({ action: 'user.update', targetId: id, targetName: nameOf(u), changes })
  }
  for (const [id, u] of usersBefore) {
    if (!usersAfter.has(id)) add({ action: 'user.delete', targetId: id, targetName: nameOf(u), note: u.email || '' })
  }

  const passwordIds = new Set(passwords)
  for (const [id, u] of usersAfter) {
    const old = usersBefore.get(id)
    if (old && u.password && old.password !== u.password) passwordIds.add(id)
  }
  for (const id of passwordIds) {
    if (created.has(id)) continue
    const u = usersAfter.get(id) || usersBefore.get(id)
    add({ action: 'user.password', targetId: id, targetName: nameOf(u), note: id === actor?.id ? 'their own password' : '' })
  }

  const coursesBefore = new Map((before.courses || []).map((c) => [c.id, c]))
  const coursesAfter = new Map((after.courses || []).map((c) => [c.id, c]))
  for (const [id, c] of coursesAfter) {
    const old = coursesBefore.get(id)
    if (!old) add({ action: 'course.create', targetId: id, targetName: c.name, note: c.code || '' })
    else {
      const changes = courseChanges(old, c)
      if (changes.length) add({ action: 'course.update', targetId: id, targetName: c.name, changes })
    }
  }
  for (const [id, c] of coursesBefore) {
    if (!coursesAfter.has(id)) add({ action: 'course.delete', targetId: id, targetName: c.name, note: c.code || '' })
  }

  if (before.settings && after.settings) {
    const changes = Object.entries(SETTINGS_FIELDS)
      .filter(([key]) => !same(before.settings[key], after.settings[key]))
      .map(([key, label]) => (key === 'logo' ? (after.settings.logo ? 'logo' : 'removed logo') : label))
    if (changes.length) add({ action: 'settings.update', targetId: 'portal', targetName: 'Portal settings', changes })
  }

  return entries
}

/**
 * Adds entries to a newest-first log. Repeated edits of the same thing by the
 * same person within ten minutes fold into one entry, so typing a course
 * description does not produce a line per keystroke.
 * Returns { log, stored: entries to save, dropped: ids pushed past the limit }.
 */
export function mergeAudit(log, entries, limit = AUDIT_LIMIT) {
  let next = [...log]
  const stored = []
  for (const entry of entries) {
    const foldable = entry.action.endsWith('.update')
    const i = foldable
      ? next.findIndex(
          (e) =>
            e.action === entry.action &&
            e.actorId === entry.actorId &&
            e.targetId === entry.targetId &&
            Date.parse(entry.at) - Date.parse(e.at) < MERGE_WINDOW_MS,
        )
      : -1
    if (i >= 0) {
      const merged = {
        ...next[i],
        at: entry.at,
        targetName: entry.targetName,
        changes: [...new Set([...next[i].changes, ...entry.changes])],
      }
      next.splice(i, 1)
      next.unshift(merged)
      stored.push(merged)
    } else {
      next.unshift(entry)
      stored.push(entry)
    }
  }
  const dropped = next.slice(limit).map((e) => e.id)
  next = next.slice(0, limit)
  return { log: next, stored, dropped }
}

const VERBS = {
  'user.create': 'Created user',
  'user.update': 'Edited user',
  'user.delete': 'Deleted user',
  'user.password': 'Changed the password of',
  'course.create': 'Added course',
  'course.update': 'Edited course',
  'course.delete': 'Deleted course',
  'settings.update': 'Changed',
}

export const auditVerb = (action) => VERBS[action] || action
