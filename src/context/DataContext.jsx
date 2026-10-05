import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { loadSession, loadState, saveState, clearState } from '../lib/storage'
import { auditFor, mergeAudit } from '../lib/audit'
import { buildSeed } from '../lib/seed'
import { withSettingDefaults } from '../lib/settingsDefaults.js'
import { COURSE_DEFAULTS } from '../lib/courseDefaults'
import { applyCourseImport } from '../lib/importedCourses'
import { api, detectBackend } from '../lib/api'
import { COLLECTIONS, advanceSnapshot, diffState, emptyState, snapshotOf } from '../lib/serverSync'
import { applyOps, hasOps, react, tick } from '../lib/engine.js'
import { currencyCode, paymentMethods, paypalLink, quote, settleOrder } from '../lib/commerce.js'
import { allStats, rewardDiscount, scoreOf } from '../lib/gamification.js'
import { courseIsComplete, isAdminRole, newEnrollment, pathProgress, termsVersion } from '../lib/rules.js'
import { setSharedFiles } from '../lib/fileStore'
import { idleFor } from '../lib/activity'
import { configureLocale, uid } from '../lib/utils'

const UPLOADED_KEY = 'ga_lms_state_uploaded_v1'
const TICK_EVERY_MS = 5 * 60000

const DataContext = createContext(null)

/** Every collection present and every setting filled in, whatever version of the portal saved it. */
function normalize(state) {
  const next = { ...state, settings: withSettingDefaults(state.settings) }
  for (const c of COLLECTIONS) if (!Array.isArray(next[c])) next[c] = []
  return next
}

/**
 * The portal's data. With a database connected (see server/), everything lives
 * on the server and every change is sent there, so accounts work on any device.
 * Without one, the portal keeps its data in this browser as it always has.
 *
 * backend.mode: 'pending' until /api/health answers, then 'local' or 'server'.
 * In server mode backend.status is 'loading' | 'anonymous' | 'ready' | 'error'.
 */
export function DataProvider({ children }) {
  const [backend, setBackend] = useState({ mode: 'pending' })
  const [me, setMe] = useState(null)
  const [gate, setGate] = useState(null)
  const [server, setServer] = useState({})
  const [publicCatalog, setPublicCatalog] = useState(null)
  const [signedOutReason, setSignedOutReason] = useState('')
  const [notice, setNotice] = useState(null)
  const [syncProblem, setSyncProblem] = useState(null)
  const [storageFull, setStorageFull] = useState(false)
  const [state, setState] = useState(() => emptyState())
  const stateRef = useRef(state)
  stateRef.current = state
  const backendRef = useRef(backend)
  backendRef.current = backend
  const meRef = useRef(me)
  meRef.current = me
  const sync = useRef({ snapshot: null, timer: null, running: false, again: false, refetch: false, quiet: false })

  // Dates, money and names follow the portal settings everywhere they are written.
  configureLocale(state.settings)

  const adopt = useCallback((next) => {
    stateRef.current = next
    setState(next)
  }, [])

  /**
   * Fetches what the signed-in user may see (or, signed out, the public branding).
   * A `soft` refresh never overwrites edits that are still on their way to the server.
   */
  const reload = useCallback(
    async ({ soft = false } = {}) => {
      try {
        // A page refreshing itself while nobody is using it does not keep the session alive.
        const answer = await api.get(soft && idleFor() > 120000 ? 'data?bg=1' : 'data')
        const s = sync.current
        if (soft && (s.running || (s.snapshot && diffState(stateRef.current, s.snapshot)))) return
        const next = normalize({ ...emptyState(), ...answer.data })
        s.snapshot = answer.gate ? null : snapshotOf(next)
        adopt(next)
        setMe(answer.me)
        setGate(answer.gate || null)
        setServer(answer.server || {})
        setSignedOutReason('')
        setBackend((b) => ({ ...b, status: 'ready', error: null }))
      } catch (err) {
        if (err.status !== 401) {
          if (!soft) setBackend((b) => ({ ...b, status: b.status === 'ready' ? 'ready' : 'error', error: err.message }))
          return
        }
        if (meRef.current && /^(You were signed out|Signing in is not)/.test(err.message)) setSignedOutReason(err.message)
        const pub = await api.get('public').catch(() => ({}))
        sync.current.snapshot = null
        adopt(emptyState(pub.settings))
        setPublicCatalog(pub.catalog || null)
        setMe(null)
        setGate(null)
        setBackend((b) => ({ ...b, status: 'anonymous', error: null }))
      }
    },
    [adopt],
  )

  useEffect(() => {
    let cancelled = false
    detectBackend().then((found) => {
      if (cancelled) return
      setSharedFiles(!!found.database)
      if (found.database) {
        setBackend({ mode: 'server', database: found.database, status: 'loading' })
        reload()
        return
      }
      // Saved portals from an earlier version may predate newer collections, so
      // seed defaults fill in any keys the stored state is missing. The TalentLMS
      // course import is layered on once, for new and existing portals alike.
      const stored = loadState()
      adopt(normalize(applyCourseImport(stored ? { ...buildSeed(), ...stored } : buildSeed())))
      setBackend({ mode: 'local', api: found.api })
    })
    return () => {
      cancelled = true
    }
  }, [adopt, reload])

  /** Sends whatever changed since the server last accepted the portal's state. */
  const pushChanges = useCallback(async () => {
    const s = sync.current
    if (s.running) {
      s.again = true
      return
    }
    if (!s.snapshot || backendRef.current.status !== 'ready') return
    const payload = diffState(stateRef.current, s.snapshot)
    if (!payload) return
    if (s.quiet) payload.quiet = true
    s.quiet = false
    s.running = true
    try {
      const result = await api.post('sync', payload)
      s.snapshot = advanceSnapshot(s.snapshot, payload)
      setSyncProblem(null)
      if (payload.passwords) {
        // Hashed on the server now; the plain text leaves memory.
        const sent = new Map(payload.passwords.map((x) => [x.userId, x.password]))
        setState((prev) => ({
          ...prev,
          users: prev.users.map((u) => {
            if (!sent.has(u.id) || u.password !== sent.get(u.id)) return u
            const { password, ...rest } = u
            return rest
          }),
        }))
      }
      if (result.rejected?.length) {
        console.warn('The server did not accept some changes:', result.rejected)
        const shown = result.rejected.find((r) => r.show)
        if (shown) setNotice({ id: uid('n'), text: shown.why, tone: 'error' })
        await reload()
      } else if (result.changed) {
        // The portal did something in response (an automation, a certificate): fetch it.
        s.refetch = true
      }
    } catch (err) {
      if (err.status === 401 || err.status === 403) await reload()
      else {
        setSyncProblem(err.message)
        clearTimeout(s.timer)
        s.timer = setTimeout(() => pushChanges(), 5000)
      }
    } finally {
      s.running = false
      if (s.again) {
        s.again = false
        pushChanges()
      } else if (s.refetch) {
        s.refetch = false
        reload({ soft: true })
      }
    }
  }, [reload])

  /* --------------------------------------------- without a database: the browser does the server's jobs */

  // The History log.
  const auditBase = useRef(null)
  useEffect(() => {
    if (backend.mode !== 'local') return
    const before = auditBase.current
    auditBase.current = state
    if (!before || before === state || state.settings.security?.auditLog === false) return
    const actor = state.users.find((u) => u.id === loadSession()?.userId)
    if (!actor) return
    const entries = auditFor(before, state, { actor, at: new Date().toISOString(), makeId: () => uid('au') })
    if (entries.length) setState((prev) => ({ ...prev, auditLog: mergeAudit(prev.auditLog || [], entries).log }))
  }, [state, backend.mode])

  /** Applies what the engine decided, and does the little a browser can about emails and webhooks. */
  const applyEngine = useCallback((base, ops) => {
    for (const effect of ops.effects || []) {
      if (effect.type === 'webhook') {
        fetch(effect.url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(effect.payload) }).catch(() => {})
      }
    }
    if (!hasOps(ops)) return base
    if (ops.upserts.outbox) {
      ops.upserts.outbox = ops.upserts.outbox.map(({ privateBody, ...m }) =>
        m.status === 'queued' ? { ...m, status: 'skipped', error: 'Email is sent by the server: connect the shared database and an email service.' } : m,
      )
    }
    setState((prev) => applyOps(prev, ops))
    return applyOps(base, ops)
  }, [])

  // Automations, notifications, certificates and learning-path steps.
  const engineBase = useRef(null)
  useEffect(() => {
    if (backend.mode !== 'local') return
    const before = engineBase.current
    engineBase.current = state
    if (!before || before === state) return
    const ops = react(before, state, { now: Date.now(), makeId: uid, origin: window.location.origin })
    engineBase.current = applyEngine(state, ops)
  }, [state, backend.mode, applyEngine])

  // Things that depend on the clock.
  useEffect(() => {
    if (backend.mode !== 'local') return undefined
    const run = () => {
      const current = stateRef.current
      const ops = tick(current, { now: Date.now(), makeId: uid, origin: window.location.origin })
      engineBase.current = applyEngine(current, ops)
    }
    const first = setTimeout(run, 1500)
    const timer = setInterval(run, TICK_EVERY_MS)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [backend.mode, applyEngine])

  /** Automations → “Check now”: runs whatever is due without waiting for the next check. */
  const runEngine = useCallback(async () => {
    if (backendRef.current.mode === 'server') {
      try {
        const answer = await api.post('rpc?do=engine.run', {})
        await reload({ soft: true })
        return { ok: true, changed: !!answer.changed }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
    const current = stateRef.current
    const ops = tick(current, { now: Date.now(), makeId: uid, origin: window.location.origin })
    engineBase.current = applyEngine(current, ops)
    return { ok: true, changed: hasOps(ops) }
  }, [applyEngine, reload])

  /** A wholesale replacement of the data is not something to react to user by user. */
  const rebase = () => {
    auditBase.current = null
    engineBase.current = null
    sync.current.quiet = true
  }

  useEffect(() => {
    if (backend.mode === 'local') setStorageFull(!saveState(state))
    else if (backend.mode === 'server' && backend.status === 'ready') {
      clearTimeout(sync.current.timer)
      sync.current.timer = setTimeout(pushChanges, 250)
    }
  }, [state, backend.mode, backend.status, pushChanges])

  // Other people's changes (a learner's enrollment request, a graded test) show up
  // when the tab regains focus and every minute while it is open.
  useEffect(() => {
    if (backend.mode !== 'server' || backend.status !== 'ready') return undefined
    const refresh = () => document.visibilityState === 'visible' && reload({ soft: true })
    const timer = setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [backend.mode, backend.status, reload])

  const patch = useCallback((updater) => setState((prev) => ({ ...prev, ...updater(prev) })), [])
  const isServer = () => backendRef.current.mode === 'server'
  /** Who is acting. With the database the server knows; without one the saved session does. */
  const actorId = () => (isServer() ? meRef.current : loadSession()?.userId) || null

  /**
   * Asks the server to carry out one action (server/rpc.js), then refreshes.
   * Returns { ok: true, …answer } or { ok: false, error }.
   */
  const rpc = useCallback(
    async (name, body = {}, { refresh = true } = {}) => {
      try {
        const answer = await api.post(`rpc?do=${name}`, body)
        if (refresh) {
          clearTimeout(sync.current.timer)
          await pushChanges()
          await reload()
        }
        return { ok: true, ...answer }
      } catch (err) {
        return { ok: false, error: err.message, status: err.status }
      }
    },
    [pushChanges, reload],
  )

  /* ------------------------------------------------------------- accounts */
  const signIn = useCallback(
    async (credentials) => {
      try {
        const answer = await api.post('login', credentials)
        if (answer.twoFactor) return { ok: false, twoFactor: true, ticket: answer.ticket }
        await reload()
        return { ok: true, user: answer.user }
      } catch (err) {
        return { ok: false, error: err.message, status: err.status }
      }
    },
    [reload],
  )

  const signOut = useCallback(async () => {
    await api.post('logout').catch(() => {})
    await reload()
  }, [reload])

  /** A password given by somebody else is replaced at first sign-in when that setting is on. */
  const stamp = (userId) => ({
    passwordChangedAt: new Date().toISOString(),
    mustChangePassword: !!stateRef.current.settings.users?.forcePasswordReset && userId !== actorId(),
  })

  const changePassword = useCallback(
    async (userId, current, next) => {
      if (isServer()) {
        try {
          await api.post('password', { current, next })
          await reload()
          return { ok: true }
        } catch (err) {
          return { ok: false, error: err.message }
        }
      }
      const user = stateRef.current.users.find((u) => u.id === userId)
      if (!user || user.password !== current) return { ok: false, error: 'Your current password is not correct.' }
      if (user.mustChangePassword && next === current) return { ok: false, error: 'Choose a password that is different from the current one.' }
      patch((prev) => ({
        users: prev.users.map((u) =>
          u.id === userId ? { ...u, password: next, passwordChangedAt: new Date().toISOString(), mustChangePassword: false } : u,
        ),
      }))
      return { ok: true }
    },
    [patch, reload],
  )

  const acceptTerms = useCallback(
    async (userId) => {
      if (isServer()) return rpc('terms.accept')
      patch((prev) => ({
        users: prev.users.map((u) =>
          u.id === userId ? { ...u, termsAccepted: termsVersion(prev.settings.users.terms), termsAcceptedAt: new Date().toISOString() } : u,
        ),
      }))
      return { ok: true }
    },
    [patch, rpc],
  )

  /**
   * What an earlier, browser-only portal saved in this browser — users added
   * here, course edits, settings — waiting to be moved to the shared database.
   */
  const [uploadedAt, setUploadedAt] = useState(() => {
    try {
      return localStorage.getItem(UPLOADED_KEY)
    } catch {
      return null
    }
  })
  const localCopy = useMemo(() => {
    if (backend.mode !== 'server' || uploadedAt) return null
    const local = loadState()
    return local?.users?.length ? { users: local.users.length, courses: (local.courses || []).length } : null
  }, [backend.mode, uploadedAt])

  const uploadLocalData = useCallback(() => {
    const stored = loadState()
    if (!stored) return
    const local = normalize(applyCourseImport({ ...buildSeed(), ...stored }))
    rebase()
    setState((prev) => {
      const next = { ...prev }
      // Orders, scheduled jobs and the email log are the server's own records.
      for (const c of COLLECTIONS.filter((x) => !['orders', 'jobs', 'outbox'].includes(x))) {
        const mine = local[c] || []
        const ids = new Set(mine.map((r) => r.id))
        next[c] = [...(prev[c] || []).filter((r) => !ids.has(r.id)), ...mine]
      }
      next.settings = withSettingDefaults({ ...prev.settings, ...(local.settings || {}) })
      next.courseImports = [...new Set([...(prev.courseImports || []), ...(local.courseImports || [])])]
      return next
    })
    const at = new Date().toISOString()
    try {
      localStorage.setItem(UPLOADED_KEY, at)
    } catch {
      // The card simply shows again next time.
    }
    setUploadedAt(at)
  }, [])

  const logEvent = useCallback(
    (type, text, actor, targetId = null) =>
      patch((prev) => {
        // Account & Settings → Security → "Keep an audit log".
        if (prev.settings.security?.auditLog === false) return {}
        return {
          events: [{ id: uid('ev'), type, text, actorId: actor, targetId, at: new Date().toISOString() }, ...prev.events].slice(0, 200),
        }
      }),
    [patch],
  )

  /* ---------------------------------------------------------------- users */

  /** Subscription → Limits: whether one more active account would go over the ceiling set there. */
  const overUserLimit = (extra = 0) => {
    const limit = Number(stateRef.current.settings.subscription?.userLimit) || 0
    return limit > 0 && stateRef.current.users.filter((u) => u.active).length + extra >= limit
  }

  const addUser = useCallback(
    (user) => {
      const { settings, groups } = stateRef.current
      if (user.active !== false && overUserLimit())
        setNotice({ id: uid('n'), tone: 'info', text: 'The active user limit set on the Subscription page has been reached, so the new account was added as inactive.' })
      // Accounts created without choosing groups (an import) join the default group and get its courses.
      const fallback = user.groupIds === undefined ? groups.find((g) => g.id === settings.users?.defaultGroupId) : null
      const id = uid('u')
      const record = {
        id,
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        role: 'learner',
        userType: 'Learner-Type',
        active: true,
        bio: '',
        phone: '',
        branchId: null,
        avatar: null,
        registeredAt: new Date().toISOString(),
        lastLogin: null,
        ...user,
        groupIds: user.groupIds ?? (fallback ? [fallback.id] : []),
        active: user.active !== false && !overUserLimit(),
        // Someone who signed up chose their own password; nobody needs to replace it.
        ...(user.password ? { ...stamp(id), ...(user.selfRegistered ? { mustChangePassword: false } : {}) } : {}),
      }
      const at = new Date().toISOString()
      patch((prev) => ({
        users: [...prev.users, record],
        enrollments: fallback
          ? [...prev.enrollments, ...(fallback.courseIds || []).filter((cid) => prev.courses.some((c) => c.id === cid)).map((cid) => newEnrollment(uid('en'), id, cid, at))]
          : prev.enrollments,
      }))
      return record
    },
    [patch],
  )

  const updateUser = useCallback(
    (id, changes) =>
      patch((prev) => ({
        users: prev.users.map((x) => (x.id === id ? { ...x, ...changes, ...(changes.password ? stamp(id) : {}) } : x)),
      })),
    [patch],
  )

  const deleteUsers = useCallback(
    (ids) =>
      patch((prev) => ({
        users: prev.users.filter((x) => !ids.includes(x.id)),
        enrollments: prev.enrollments.filter((e) => !ids.includes(e.userId)),
      })),
    [patch],
  )

  /* -------------------------------------------------------------- courses */
  const addCourse = useCallback(
    (course) => {
      const now = new Date().toISOString()
      const defaults = stateRef.current.settings.courses || {}
      const record = {
        ...COURSE_DEFAULTS,
        // New courses start from Account & Settings → Courses.
        completionRule: defaults.defaultCompletionRule || COURSE_DEFAULTS.completionRule,
        certificate: defaults.certificateEnabled !== false,
        certificateType: String(defaults.certificateTemplate || 'Classic').toLowerCase(),
        id: uid('c'),
        units: [],
        instructorIds: [],
        createdAt: now,
        updatedAt: now,
        ...course,
      }
      patch((prev) => ({ courses: [...prev.courses, record] }))
      return record
    },
    [patch],
  )

  const updateCourse = useCallback(
    (id, given) => {
      let changes = given
      const { settings, courses } = stateRef.current
      const limit = Number(settings.subscription?.courseLimit) || 0
      const wasActive = courses.find((c) => c.id === id)?.status === 'active'
      // Subscription → Limits: a course cannot be activated past the ceiling set there.
      if (changes.status === 'active' && !wasActive && limit > 0 && courses.filter((c) => c.status === 'active').length >= limit) {
        changes = { ...changes, status: 'inactive', published: false }
        setNotice({ id: uid('n'), tone: 'error', text: `The active course limit of ${limit} set on the Subscription page has been reached, so the course was left inactive.` })
      }
      patch((prev) => ({
        courses: prev.courses.map((x) =>
          x.id === id ? { ...x, ...changes, updatedAt: new Date().toISOString() } : x,
        ),
      }))
    },
    [patch],
  )

  const deleteCourses = useCallback(
    (ids) =>
      patch((prev) => ({
        courses: prev.courses.filter((x) => !ids.includes(x.id)),
        enrollments: prev.enrollments.filter((e) => !ids.includes(e.courseId)),
      })),
    [patch],
  )

  const duplicateCourse = useCallback(
    (id) => {
      const source = stateRef.current.courses.find((c) => c.id === id)
      if (!source) return null
      const copy = {
        ...structuredClone(source),
        id: uid('c'),
        name: `${source.name} (copy)`,
        status: 'inactive',
        published: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      patch((prev) => ({ courses: [...prev.courses, copy] }))
      return copy
    },
    [patch],
  )

  /* ---------------------------------------------------------------- units */
  const addUnit = useCallback(
    (courseId, unit) => {
      const record = { id: uid('un'), name: 'Untitled unit', data: {}, ...unit }
      patch((prev) => ({
        courses: prev.courses.map((c) =>
          c.id === courseId
            ? { ...c, units: [...c.units, record], updatedAt: new Date().toISOString() }
            : c,
        ),
      }))
      return record
    },
    [patch],
  )

  const updateUnit = useCallback(
    (courseId, unitId, changes) =>
      patch((prev) => ({
        courses: prev.courses.map((c) =>
          c.id === courseId
            ? {
                ...c,
                units: c.units.map((un) => (un.id === unitId ? { ...un, ...changes } : un)),
                updatedAt: new Date().toISOString(),
              }
            : c,
        ),
      })),
    [patch],
  )

  const deleteUnit = useCallback(
    (courseId, unitId) =>
      patch((prev) => ({
        courses: prev.courses.map((c) =>
          c.id === courseId ? { ...c, units: c.units.filter((un) => un.id !== unitId) } : c,
        ),
        enrollments: prev.enrollments.map((e) =>
          e.courseId === courseId
            ? { ...e, completedUnits: e.completedUnits.filter((id) => id !== unitId) }
            : e,
        ),
      })),
    [patch],
  )

  const moveUnit = useCallback(
    (courseId, unitId, direction) =>
      patch((prev) => ({
        courses: prev.courses.map((c) => {
          if (c.id !== courseId) return c
          const units = [...c.units]
          const i = units.findIndex((un) => un.id === unitId)
          const j = i + direction
          if (i < 0 || j < 0 || j >= units.length) return c
          ;[units[i], units[j]] = [units[j], units[i]]
          return { ...c, units }
        }),
      })),
    [patch],
  )

  /* ---------------------------------------------------------- enrollments */
  const enroll = useCallback(
    (userIds, courseIds, extra = {}) =>
      patch((prev) => {
        const additions = []
        const at = new Date().toISOString()
        userIds.forEach((userId) => {
          courseIds.forEach((courseId) => {
            const exists =
              prev.enrollments.some((e) => e.userId === userId && e.courseId === courseId) ||
              additions.some((e) => e.userId === userId && e.courseId === courseId)
            if (!exists) additions.push(newEnrollment(uid('en'), userId, courseId, at, extra))
          })
        })
        return additions.length ? { enrollments: [...prev.enrollments, ...additions] } : {}
      }),
    [patch],
  )

  /** A learner asks to join a course; an administrator approves or declines. */
  const requestEnrollment = useCallback(
    (userId, courseId, note = '') =>
      patch((prev) => {
        const open = (prev.enrollmentRequests || []).some(
          (r) => r.userId === userId && r.courseId === courseId && r.status === 'pending',
        )
        if (open) return {}
        return {
          enrollmentRequests: [
            ...(prev.enrollmentRequests || []),
            {
              id: uid('er'),
              userId,
              courseId,
              note,
              requestedAt: new Date().toISOString(),
              status: 'pending',
            },
          ],
        }
      }),
    [patch],
  )

  const resolveEnrollmentRequest = useCallback(
    (id, approve) =>
      patch((prev) => {
        const request = (prev.enrollmentRequests || []).find((r) => r.id === id)
        if (!request) return {}
        const enrollmentRequests = prev.enrollmentRequests.map((r) =>
          r.id === id
            ? { ...r, status: approve ? 'approved' : 'declined', resolvedAt: new Date().toISOString() }
            : r,
        )
        if (!approve) return { enrollmentRequests }

        const already = prev.enrollments.some(
          (e) => e.userId === request.userId && e.courseId === request.courseId,
        )
        const enrollments = already
          ? prev.enrollments
          : [...prev.enrollments, newEnrollment(uid('en'), request.userId, request.courseId, new Date().toISOString())]
        return { enrollmentRequests, enrollments }
      }),
    [patch],
  )

  const unenroll = useCallback(
    (userId, courseId) =>
      patch((prev) => ({
        enrollments: prev.enrollments.filter((e) => !(e.userId === userId && e.courseId === courseId)),
      })),
    [patch],
  )

  const resetProgress = useCallback(
    (userId, courseId) =>
      patch((prev) => ({
        enrollments: prev.enrollments.map((e) =>
          e.userId === userId && e.courseId === courseId
            ? {
                ...e,
                completedUnits: [],
                status: 'not_started',
                score: null,
                completedAt: null,
                timeSpentMin: 0,
                attempts: {},
                scores: {},
                failedAt: null,
                markedComplete: false,
              }
            : e,
        ),
      })),
    [patch],
  )

  /**
   * Marks a unit complete and rolls the enrollment forward under the course's
   * completion rule. The certificate, and anything else that follows from
   * finishing a course, is issued by the engine (src/lib/engine.js).
   */
  const completeUnit = useCallback(
    (userId, courseId, unitId, extra = {}) =>
      patch((prev) => {
        const course = prev.courses.find((c) => c.id === courseId)
        const now = new Date().toISOString()
        return {
          enrollments: prev.enrollments.map((e) => {
            if (e.userId !== userId || e.courseId !== courseId) return e
            const completedUnits = e.completedUnits.includes(unitId) ? e.completedUnits : [...e.completedUnits, unitId]
            const scores =
              extra.score != null ? { ...(e.scores || {}), [unitId]: Math.max(Number(e.scores?.[unitId]) || 0, extra.score) } : e.scores
            const marks = Object.values(scores || {})
            const done = courseIsComplete(course, completedUnits, e)
            return {
              ...e,
              completedUnits,
              ...(scores ? { scores } : {}),
              ...(extra.attempt ? { attempts: { ...(e.attempts || {}), [unitId]: (Number(e.attempts?.[unitId]) || 0) + 1 } } : {}),
              timeSpentMin: (e.timeSpentMin || 0) + (extra.minutes || 2),
              score: marks.length ? Math.round(marks.reduce((a, b) => a + b, 0) / marks.length) : e.score,
              status: done ? 'completed' : e.failedAt ? 'failed' : 'in_progress',
              completedAt: done ? e.completedAt || now : null,
            }
          }),
        }
      }),
    [patch],
  )

  /** A test attempt that did not pass. Using up the attempts a test allows fails the course. */
  const failTest = useCallback(
    (userId, courseId, unitId) =>
      patch((prev) => {
        const unit = prev.courses.find((c) => c.id === courseId)?.units.find((u) => u.id === unitId)
        const max = Number(unit?.data?.maxAttempts) || 0
        const now = new Date().toISOString()
        return {
          enrollments: prev.enrollments.map((e) => {
            if (e.userId !== userId || e.courseId !== courseId) return e
            const used = (Number(e.attempts?.[unitId]) || 0) + 1
            const out = max > 0 && used >= max && !e.completedUnits.includes(unitId) && e.status !== 'completed'
            return {
              ...e,
              attempts: { ...(e.attempts || {}), [unitId]: used },
              status: out ? 'failed' : e.status === 'not_started' ? 'in_progress' : e.status,
              failedAt: out ? now : e.failedAt || null,
            }
          }),
        }
      }),
    [patch],
  )

  /** For courses whose rule is "Instructor marks the course complete". */
  const markCourseComplete = useCallback(
    (userId, courseId, done = true) =>
      patch((prev) => ({
        enrollments: prev.enrollments.map((e) =>
          e.userId === userId && e.courseId === courseId
            ? {
                ...e,
                markedComplete: done,
                status: done ? 'completed' : e.completedUnits.length ? 'in_progress' : 'not_started',
                completedAt: done ? e.completedAt || new Date().toISOString() : null,
                failedAt: done ? null : e.failedAt || null,
              }
            : e,
        ),
      })),
    [patch],
  )

  /* ---------------------------------------- collections with plain records */
  const collectionActions = useMemo(() => {
    const make = (key, prefix) => ({
      add: (item) => {
        const record = { id: uid(prefix), createdAt: new Date().toISOString(), ...item }
        patch((prev) => ({ [key]: [...(prev[key] || []), record] }))
        return record
      },
      update: (id, changes) =>
        patch((prev) => ({ [key]: (prev[key] || []).map((x) => (x.id === id ? { ...x, ...changes } : x)) })),
      remove: (id) => patch((prev) => ({ [key]: (prev[key] || []).filter((x) => x.id !== id) })),
    })
    return {
      groups: make('groups', 'g'),
      branches: make('branches', 'br'),
      categories: make('categories', 'cat'),
      userTypes: make('userTypes', 'ut'),
      notificationRules: make('notifications', 'nt'),
      messages: make('messages', 'm'),
      submissions: make('submissions', 'sub'),
      learningPaths: make('learningPaths', 'lp'),
      automations: make('automations', 'auto'),
      skills: make('skills', 'sk'),
      discussions: make('discussions', 'dp'),
      ratings: make('ratings', 'rt'),
      skillResults: make('skillResults', 'sr'),
      outbox: make('outbox', 'ob'),
    }
  }, [patch])

  const gradeSubmission = useCallback(
    (id, grade, feedback) =>
      patch((prev) => ({
        submissions: prev.submissions.map((s) =>
          s.id === id ? { ...s, grade, feedback, status: 'graded', gradedAt: new Date().toISOString() } : s,
        ),
      })),
    [patch],
  )

  const markMessageRead = useCallback(
    (id) =>
      patch((prev) => ({ messages: prev.messages.map((m) => (m.id === id ? { ...m, read: true } : m)) })),
    [patch],
  )

  const updateSettings = useCallback(
    (changes) => patch((prev) => ({ settings: { ...prev.settings, ...changes } })),
    [patch],
  )

  /* ------------------------------------------------------------- learning paths */

  /** Adds a learner to a path (their own choice, or an administrator's) and opens its first courses. */
  const joinPath = useCallback(
    async (pathId, userId) => {
      if (isServer() && userId === meRef.current && !isAdminRole(stateRef.current.users.find((u) => u.id === userId))) return rpc('path.join', { pathId })
      const at = new Date().toISOString()
      patch((prev) => {
        const path = prev.learningPaths.find((p) => p.id === pathId)
        if (!path) return {}
        const joined = {
          ...path,
          userIds: [...new Set([...(path.userIds || []), userId])],
          joined: { ...(path.joined || {}), [userId]: path.joined?.[userId] || at },
        }
        const learningPaths = prev.learningPaths.map((p) => (p.id === pathId ? joined : p))
        const progress = pathProgress(joined, userId, { ...prev, learningPaths })
        const open = path.ordered ? (progress.next ? [progress.next] : []) : progress.steps
        const additions = path.status === 'active' ? open.filter((s) => !s.enrollment).map((s) => newEnrollment(uid('en'), userId, s.courseId, at, { pathId })) : []
        return { learningPaths, enrollments: [...prev.enrollments, ...additions] }
      })
      return { ok: true }
    },
    [patch, rpc],
  )

  /* ------------------------------------------------------------------ buying */

  /** Without a database the browser prices the order with the same rules the server uses. */
  const priceHere = useCallback(({ kind = 'course', courseId, coupon }) => {
    const st = stateRef.current
    const user = st.users.find((u) => u.id === actorId())
    const course = st.courses.find((c) => c.id === courseId)
    const g = st.settings.gamification
    const sub = st.settings.ecommerce.subscription
    const trial = kind === 'subscription' && Number(sub.trialDays) > 0 && !user?.trialUsed && !user?.subscribedUntil
    const q = trial
      ? { list: Number(sub.fee) || 0, total: 0, lines: [{ label: `Free trial (${sub.trialDays} days)`, amount: 0 }], coupon: null }
      : quote({ kind, course, user, settings: st.settings, couponCode: coupon, rewardPercent: rewardDiscount(scoreOf(allStats(st).get(user?.id), g), g) })
    return {
      user,
      course,
      trial,
      kind,
      quote: { list: q.list, total: q.total, lines: q.lines, error: q.error || null, coupon: q.coupon?.code || '', covered: q.covered || null },
      methods: paymentMethods(st.settings, { stripeReady: false }),
      credits: Number(user?.credits) || 0,
      currency: currencyCode(st.settings),
    }
  }, [])

  const settleHere = useCallback(
    (order) =>
      patch((prev) => {
        const out = settleOrder(prev, order, { now: Date.now(), makeId: uid })
        return {
          orders: [...prev.orders.filter((o) => o.id !== order.id), out.order],
          users: out.user ? prev.users.map((u) => (u.id === out.user.id ? out.user : u)) : prev.users,
          enrollments: out.enrollment ? [...prev.enrollments, out.enrollment] : prev.enrollments,
          settings: out.settings || prev.settings,
        }
      }),
    [patch],
  )

  const getQuote = useCallback(
    async (args) => {
      if (isServer()) return rpc('checkout.quote', args, { refresh: false })
      const { user, course, ...shown } = priceHere(args)
      return { ok: true, ...shown }
    },
    [rpc, priceHere],
  )

  /** Buys a course (or the portal subscription). Returns { ok, order?, redirect?, instructions?, error? }. */
  const checkout = useCallback(
    async (args) => {
      if (isServer()) return rpc('checkout', args)
      const p = priceHere(args)
      if (p.quote.error) return { ok: false, error: p.quote.error }
      const st = stateRef.current
      const total = p.quote.total
      const method = total === 0 ? (p.trial ? 'trial' : p.quote.covered ? 'subscription' : 'free') : args.method
      if (total > 0 && !p.methods.some((m) => m.id === method)) return { ok: false, error: 'Choose how you would like to pay.' }
      const order = {
        id: uid('or'),
        userId: p.user.id,
        kind: p.kind,
        courseId: p.course?.id || null,
        name: p.kind === 'subscription' ? `${st.settings.siteName} subscription` : p.course.name,
        list: p.quote.list,
        amount: total,
        lines: p.quote.lines,
        currency: p.currency,
        coupon: p.quote.coupon,
        trial: !!p.trial,
        method,
        status: 'pending',
        at: new Date().toISOString(),
      }
      if (total === 0 || method === 'credits') {
        if (method === 'credits' && p.credits < total) return { ok: false, error: `You have ${p.credits} credits; this costs ${total}.` }
        settleHere(order)
        return { ok: true, order: { ...order, status: 'paid' } }
      }
      patch((prev) => ({ orders: [...prev.orders, order] }))
      if (method === 'paypal')
        return { ok: true, order, redirect: paypalLink(st.settings.ecommerce.paypalEmail, { order, name: order.name, currency: order.currency, origin: window.location.origin }) }
      return { ok: true, order, instructions: st.settings.ecommerce.offline?.instructions || '' }
    },
    [rpc, priceHere, settleHere, patch],
  )

  const confirmPayment = useCallback((orderId, sessionId) => (isServer() ? rpc('checkout.confirm', { orderId, sessionId }) : { ok: true }), [rpc])

  const settleOrderById = useCallback(
    async (orderId) => {
      if (isServer()) return rpc('order.settle', { orderId })
      const order = stateRef.current.orders.find((o) => o.id === orderId)
      if (order) settleHere(order)
      return { ok: true }
    },
    [rpc, settleHere],
  )

  const cancelOrder = useCallback(
    async (orderId) => {
      if (isServer()) return rpc('order.cancel', { orderId })
      patch((prev) => ({
        orders: prev.orders.map((o) => (o.id === orderId ? { ...o, status: 'cancelled', cancelledAt: new Date().toISOString() } : o)),
      }))
      return { ok: true }
    },
    [rpc, patch],
  )

  // A backup from an earlier version has no learning paths, automations or skills.
  const importState = useCallback((next) => {
    rebase()
    setState(normalize({ ...emptyState(), ...next }))
  }, [])

  const resetPortal = useCallback(() => {
    if (backendRef.current.mode === 'local') clearState()
    rebase()
    setState(normalize(applyCourseImport(buildSeed())))
  }, [])

  const clearNotice = useCallback(() => setNotice(null), [])

  const actions = useMemo(
    () => ({
      signIn,
      signOut,
      reload,
      rpc,
      runEngine,
      changePassword,
      acceptTerms,
      uploadLocalData,
      logEvent,
      addUser,
      updateUser,
      deleteUsers,
      addCourse,
      updateCourse,
      deleteCourses,
      duplicateCourse,
      addUnit,
      updateUnit,
      deleteUnit,
      moveUnit,
      enroll,
      requestEnrollment,
      resolveEnrollmentRequest,
      unenroll,
      resetProgress,
      completeUnit,
      failTest,
      markCourseComplete,
      gradeSubmission,
      markMessageRead,
      updateSettings,
      joinPath,
      getQuote,
      checkout,
      confirmPayment,
      settleOrder: settleOrderById,
      cancelOrder,
      importState,
      resetPortal,
      clearNotice,
      ...collectionActions,
    }),
    [
      signIn,
      signOut,
      reload,
      rpc,
      runEngine,
      changePassword,
      acceptTerms,
      uploadLocalData,
      logEvent,
      addUser,
      updateUser,
      deleteUsers,
      addCourse,
      updateCourse,
      deleteCourses,
      duplicateCourse,
      addUnit,
      updateUnit,
      deleteUnit,
      moveUnit,
      enroll,
      requestEnrollment,
      resolveEnrollmentRequest,
      unenroll,
      resetProgress,
      completeUnit,
      failTest,
      markCourseComplete,
      gradeSubmission,
      markMessageRead,
      updateSettings,
      joinPath,
      getQuote,
      checkout,
      confirmPayment,
      settleOrderById,
      cancelOrder,
      importState,
      resetPortal,
      clearNotice,
      collectionActions,
    ],
  )

  const value = useMemo(
    () => ({
      ...state,
      backend,
      me,
      gate,
      server,
      publicCatalog,
      signedOutReason,
      notice,
      syncProblem,
      storageFull,
      localCopy,
      actions,
    }),
    [state, backend, me, gate, server, publicCatalog, signedOutReason, notice, syncProblem, storageFull, localCopy, actions],
  )

  if (backend.mode === 'pending' || (backend.mode === 'server' && backend.status === 'loading')) return <Splash />
  if (backend.mode === 'server' && backend.status === 'error')
    return <Splash error={backend.error} onRetry={() => reload()} />

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

/** The keys of the context value that are not portal data (see Import-Export). */
export const NON_DATA_KEYS = ['actions', 'backend', 'me', 'gate', 'server', 'publicCatalog', 'signedOutReason', 'notice', 'syncProblem', 'storageFull', 'localCopy']

function Splash({ error, onRetry }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      {error ? (
        <div className="text-center max-w-sm">
          <p className="text-[15px] font-semibold text-ink-900">The portal could not load</p>
          <p className="hint mt-1.5">{error}</p>
          <button onClick={onRetry} className="btn-primary mt-5">
            Try again
          </button>
        </div>
      ) : (
        <p className="text-[14px] text-ink-500 animate-pulse">Loading portal…</p>
      )}
    </div>
  )
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside DataProvider')
  return ctx
}

/* ----------------------------------------------------------- selectors */
export function useSelectors() {
  const data = useData()
  return useMemo(() => {
    const userById = (id) => data.users.find((u) => u.id === id) || null
    const courseById = (id) => data.courses.find((c) => c.id === id) || null
    const categoryById = (id) => data.categories.find((c) => c.id === id) || null
    const branchById = (id) => data.branches.find((b) => b.id === id) || null
    const groupById = (id) => data.groups.find((g) => g.id === id) || null

    const enrollmentsOf = (userId) => data.enrollments.filter((e) => e.userId === userId)
    const enrollmentsIn = (courseId) => data.enrollments.filter((e) => e.courseId === courseId)
    const enrollment = (userId, courseId) =>
      data.enrollments.find((e) => e.userId === userId && e.courseId === courseId) || null

    const progressOf = (enrollmentRecord) => {
      if (!enrollmentRecord) return 0
      if (enrollmentRecord.status === 'completed') return 100
      const course = courseById(enrollmentRecord.courseId)
      const total = (course?.units || []).filter((u) => u.type !== 'section').length
      if (!total) return 0
      return Math.min(100, Math.round((enrollmentRecord.completedUnits.length / total) * 100))
    }

    const coursesOfInstructor = (userId) =>
      data.courses.filter((c) => (c.instructorIds || []).includes(userId))

    const coursesOfLearner = (userId) =>
      enrollmentsOf(userId)
        .map((e) => ({ enrollment: e, course: courseById(e.courseId) }))
        .filter((x) => x.course)

    return {
      userById,
      courseById,
      categoryById,
      branchById,
      groupById,
      enrollmentsOf,
      enrollmentsIn,
      enrollment,
      progressOf,
      coursesOfInstructor,
      coursesOfLearner,
    }
  }, [data])
}
