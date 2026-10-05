/**
 * The REST API other systems use (a student information system, Zapier, an
 * online store). Switched on in Account & Settings → Integrations → API, where
 * keys are issued. Send the key as `Authorization: Bearer <key>` or `X-API-Key`.
 *
 *   GET    /api/v1/users            ?email=            list accounts
 *   POST   /api/v1/users            { firstName, lastName, email, password?, userType? }
 *   PATCH  /api/v1/users/:id        { active?, firstName?, lastName?, phone? }
 *   GET    /api/v1/courses                              active and inactive courses
 *   GET    /api/v1/enrollments      ?userId=&courseId=&email=
 *   POST   /api/v1/enrollments      { userId | email, courseId | courseCode }
 *   DELETE /api/v1/enrollments      { userId | email, courseId | courseCode }
 *   GET    /api/v1/certificates     ?userId=&email=
 *   POST   /api/v1/orders           { email, firstName, lastName, courseCodes | courseIds, reference?, amount? }
 *                                   creates the account if needed and enrolls it (for stores)
 *
 * The same paths also work as /api/v1?path=users for hosts that do not rewrite.
 */
import { withSettingDefaults } from '../src/lib/settingsDefaults.js'
import { certificateExpiry, contentUnits, newEnrollment } from '../src/lib/rules.js'
import { currencyCode, invoiceNumber } from '../src/lib/commerce.js'
import { HttpError, commit, loadDb, newUserRows, openStore, queryOf, readJson, send } from './core.js'
import { hashPassword, newId, newSecret, passwordProblem, sha256 } from './auth.js'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const row = (collection, data) => ({ collection, id: data.id, data })
const iso = () => new Date().toISOString()

const userOut = (u) => ({
  id: u.id,
  firstName: u.firstName,
  lastName: u.lastName,
  email: u.email,
  userType: u.userType,
  role: u.role,
  active: !!u.active,
  phone: u.phone || '',
  branchId: u.branchId || null,
  groupIds: u.groupIds || [],
  registeredAt: u.registeredAt,
  lastLogin: u.lastLogin || null,
  custom: u.custom || {},
})

const courseOut = (c) => ({
  id: c.id,
  name: c.name,
  code: c.code || '',
  status: c.status,
  categoryId: c.categoryId || null,
  price: Number(c.price) || 0,
  level: c.level,
  units: contentUnits(c).length,
  updatedAt: c.updatedAt,
})

async function authenticate(req, store) {
  const header = req.headers.authorization || ''
  const key = (header.startsWith('Bearer ') ? header.slice(7) : req.headers['x-api-key'] || '').trim()
  if (!key) throw new HttpError(401, 'Send your API key as “Authorization: Bearer <key>”.')
  const hash = sha256(key)
  const record = (await store.allIn('_apikeys')).find((k) => k.hash === hash)
  if (!record) throw new HttpError(401, 'That API key is not valid.')
  // Noting when a key was last used helps spot ones that can be retired; once an hour is enough.
  if (!record.lastUsedAt || Date.now() - new Date(record.lastUsedAt).getTime() > 3600000)
    await store.upsert([{ collection: '_apikeys', id: record.id, data: { ...record, lastUsedAt: iso() } }])
  return record
}

export async function apiV1(req, res) {
  const { store } = await openStore()
  const settings = withSettingDefaults(await store.get('settings', 'portal'))
  if (!settings.api?.enabled) throw new HttpError(403, 'The API is switched off. Turn it on in Account & Settings → Integrations.')
  await authenticate(req, store)

  const query = queryOf(req)
  const pathname = new URL(req.url, 'http://x').pathname
  const tail = query.get('path') || pathname.replace(/^\/api\/v1\/?/, '')
  const [resource = '', id = ''] = tail.split('/').filter(Boolean)
  const method = req.method.toUpperCase()
  const body = method === 'GET' ? {} : await readJson(req)
  const db = await loadDb(store)
  const c = db.collections
  const ok = (data, status = 200) => send(res, status, { data })

  const findUser = (ref) =>
    c.users.find((u) => (ref.userId && u.id === ref.userId) || (ref.email && String(u.email).toLowerCase() === String(ref.email).toLowerCase()))
  const findCourse = (ref) =>
    c.courses.find((x) => (ref.courseId && x.id === ref.courseId) || (ref.courseCode && String(x.code || '').toLowerCase() === String(ref.courseCode).toLowerCase()))

  /** Creates an account with a password (given or generated) and returns it with the password to pass on. */
  async function createUser(fields) {
    const email = String(fields.email || '').trim().toLowerCase()
    if (!EMAIL.test(email)) throw new HttpError(400, 'A valid email address is required.')
    if (findUser({ email })) throw new HttpError(409, 'An account with this email address already exists.')
    const limit = Number(settings.subscription?.userLimit) || 0
    if (limit > 0 && c.users.filter((u) => u.active).length >= limit) throw new HttpError(403, 'The active user limit set on the Subscription page has been reached.')
    const password = fields.password || `${newSecret().slice(0, 10)}aA1`
    const problem = passwordProblem(password, settings)
    if (problem) throw new HttpError(400, problem)
    const made = newUserRows(db, settings, {
      firstName: String(fields.firstName || '').trim(),
      lastName: String(fields.lastName || '').trim(),
      email,
      phone: String(fields.phone || ''),
      userType: fields.userType,
      source: 'API',
      mustChangePassword: !fields.password,
    })
    await store.setHashes([{ userId: made.user.id, hash: await hashPassword(password) }])
    return { ...made, password }
  }

  switch (`${method} ${resource}`) {
    case 'GET users': {
      if (id) {
        const user = c.users.find((u) => u.id === id)
        if (!user) throw new HttpError(404, 'No such user.')
        return ok(userOut(user))
      }
      const email = query.get('email')
      return ok(c.users.filter((u) => !email || String(u.email).toLowerCase() === email.toLowerCase()).map(userOut))
    }

    case 'POST users': {
      const made = await createUser(body)
      await commit(store, db, { upserts: made.rows, deletes: [] }, { req, passwords: { [made.user.id]: made.password } })
      return ok({ ...userOut(made.user), password: body.password ? undefined : made.password }, 201)
    }

    case 'PATCH users':
    case 'PUT users': {
      const user = c.users.find((u) => u.id === id)
      if (!user) throw new HttpError(404, 'No such user.')
      const next = { ...user }
      for (const field of ['firstName', 'lastName', 'phone']) if (typeof body[field] === 'string') next[field] = body[field].trim()
      if (typeof body.active === 'boolean') next.active = body.active
      await commit(store, db, { upserts: [row('users', next)], deletes: [] }, { req })
      return ok(userOut(next))
    }

    case 'GET courses': {
      if (id) {
        const course = c.courses.find((x) => x.id === id)
        if (!course) throw new HttpError(404, 'No such course.')
        return ok(courseOut(course))
      }
      return ok(c.courses.map(courseOut))
    }

    case 'GET enrollments': {
      const user = query.get('email') ? findUser({ email: query.get('email') }) : null
      const userId = query.get('userId') || user?.id
      const courseId = query.get('courseId')
      if (query.get('email') && !user) return ok([])
      return ok(c.enrollments.filter((e) => (!userId || e.userId === userId) && (!courseId || e.courseId === courseId)))
    }

    case 'POST enrollments': {
      const user = findUser(body)
      const course = findCourse(body)
      if (!user) throw new HttpError(404, 'No such user.')
      if (!course) throw new HttpError(404, 'No such course.')
      const existing = c.enrollments.find((e) => e.userId === user.id && e.courseId === course.id)
      if (existing) return ok(existing)
      const enrollment = newEnrollment(newId('en'), user.id, course.id, iso())
      await commit(store, db, { upserts: [row('enrollments', enrollment)], deletes: [] }, { req })
      return ok(enrollment, 201)
    }

    case 'DELETE enrollments': {
      const user = findUser({ userId: body.userId || query.get('userId'), email: body.email || query.get('email') })
      const course = findCourse({ courseId: body.courseId || query.get('courseId'), courseCode: body.courseCode || query.get('courseCode') })
      const existing = user && course && c.enrollments.find((e) => e.userId === user.id && e.courseId === course.id)
      if (!existing) throw new HttpError(404, 'No such enrollment.')
      await commit(store, db, { upserts: [], deletes: [{ collection: 'enrollments', id: existing.id }] }, { req })
      return ok({ removed: existing.id })
    }

    case 'GET certificates': {
      const user = query.get('email') ? findUser({ email: query.get('email') }) : null
      const userId = query.get('userId') || user?.id
      return ok(c.certificates.filter((x) => !userId || x.userId === userId).map((x) => ({ ...x, expiresAt: certificateExpiry(x, settings) })))
    }

    case 'POST orders': {
      const refs = [...(body.courseIds || []).map((courseId) => ({ courseId })), ...(body.courseCodes || []).map((courseCode) => ({ courseCode }))]
      const courses = refs.map(findCourse)
      if (!refs.length || courses.some((x) => !x)) throw new HttpError(400, 'Send courseCodes or courseIds that match courses in the portal.')
      const rows = []
      let user = findUser({ email: body.email })
      let password
      if (!user) {
        const made = await createUser(body)
        user = made.user
        password = made.password
        rows.push(...made.rows)
      }
      const at = iso()
      const each = Number(body.amount) > 0 ? Number(body.amount) / courses.length : 0
      const orders = []
      for (const course of courses) {
        const enrolled = c.enrollments.some((e) => e.userId === user.id && e.courseId === course.id) || rows.some((r) => r.collection === 'enrollments' && r.data.courseId === course.id)
        if (!enrolled) rows.push(row('enrollments', newEnrollment(newId('en'), user.id, course.id, at)))
        const order = {
          id: newId('or'),
          userId: user.id,
          kind: 'course',
          courseId: course.id,
          name: course.name,
          list: Number(course.price) || 0,
          amount: Math.round(each * 100) / 100,
          lines: [],
          currency: body.currency || currencyCode(settings),
          coupon: '',
          method: 'external',
          ref: String(body.reference || ''),
          status: 'paid',
          at,
          paidAt: at,
          invoiceNo: each > 0 ? invoiceNumber([...c.orders, ...orders], Date.now()) : '',
        }
        orders.push(order)
        rows.push(row('orders', order))
      }
      await commit(store, db, { upserts: rows, deletes: [] }, { req, passwords: password ? { [user.id]: password } : {} })
      return ok({ user: userOut(user), password, orders }, 201)
    }

    default:
      throw new HttpError(404, 'Unknown API resource.')
  }
}
