import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { loadSession, loadState, saveState, clearState } from '../lib/storage'
import { auditFor, mergeAudit } from '../lib/audit'
import { buildSeed } from '../lib/seed'
import { COURSE_DEFAULTS } from '../lib/courseDefaults'
import { applyCourseImport } from '../lib/importedCourses'
import { api, detectBackend } from '../lib/api'
import { COLLECTIONS, advanceSnapshot, diffState, emptyState, snapshotOf } from '../lib/serverSync'
import { uid } from '../lib/utils'

const UPLOADED_KEY = 'ga_lms_state_uploaded_v1'

const DataContext = createContext(null)

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
  const [syncProblem, setSyncProblem] = useState(null)
  const [storageFull, setStorageFull] = useState(false)
  const [state, setState] = useState(() => emptyState())
  const stateRef = useRef(state)
  stateRef.current = state
  const backendRef = useRef(backend)
  backendRef.current = backend
  const sync = useRef({ snapshot: null, timer: null, running: false, again: false })

  const adopt = useCallback((next) => {
    stateRef.current = next
    setState(next)
  }, [])

  /**
   * Fetches what the signed-in user may see (or, signed out, the public branding).
   * A background refresh never overwrites edits that are still on their way to the server.
   */
  const reload = useCallback(
    async ({ background = false } = {}) => {
      try {
        const { me: id, data } = await api.get('data')
        const s = sync.current
        if (background && (s.running || (s.snapshot && diffState(stateRef.current, s.snapshot)))) return
        const next = { ...emptyState(), ...data }
        s.snapshot = snapshotOf(next)
        adopt(next)
        setMe(id)
        setBackend((b) => ({ ...b, status: 'ready', error: null }))
      } catch (err) {
        if (err.status !== 401) {
          if (!background) setBackend((b) => ({ ...b, status: b.status === 'ready' ? 'ready' : 'error', error: err.message }))
          return
        }
        const pub = await api.get('public').catch(() => ({}))
        sync.current.snapshot = null
        adopt(emptyState(pub.settings))
        setMe(null)
        setBackend((b) => ({ ...b, status: 'anonymous', error: null }))
      }
    },
    [adopt],
  )

  useEffect(() => {
    let cancelled = false
    detectBackend().then((found) => {
      if (cancelled) return
      if (found.database) {
        setBackend({ mode: 'server', database: found.database, status: 'loading' })
        reload()
        return
      }
      // Saved portals from an earlier version may predate newer collections, so
      // seed defaults fill in any keys the stored state is missing. The TalentLMS
      // course import is layered on once, for new and existing portals alike.
      const stored = loadState()
      adopt(applyCourseImport(stored ? { ...buildSeed(), ...stored } : buildSeed()))
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
        await reload()
      }
    } catch (err) {
      if (err.status === 401) await reload()
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
      }
    }
  }, [reload])

  // Without a database the browser keeps the History itself (the server does it otherwise).
  const auditBase = useRef(null)
  useEffect(() => {
    if (backend.mode !== 'local') return
    const before = auditBase.current
    auditBase.current = state
    if (!before || before === state) return
    const actor = state.users.find((u) => u.id === loadSession()?.userId)
    if (!actor) return
    const entries = auditFor(before, state, { actor, at: new Date().toISOString(), makeId: () => uid('au') })
    if (entries.length) setState((prev) => ({ ...prev, auditLog: mergeAudit(prev.auditLog || [], entries).log }))
  }, [state, backend.mode])

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
    const refresh = () => document.visibilityState === 'visible' && reload({ background: true })
    const timer = setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [backend.mode, backend.status, reload])

  const patch = useCallback((updater) => setState((prev) => ({ ...prev, ...updater(prev) })), [])

  /* ------------------------------------------------------------- accounts */
  const signIn = useCallback(
    async (email, password) => {
      try {
        const { user } = await api.post('login', { email, password })
        await reload()
        return { ok: true, user }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    },
    [reload],
  )

  const signOut = useCallback(async () => {
    await api.post('logout').catch(() => {})
    await reload()
  }, [reload])

  const changePassword = useCallback(
    async (userId, current, next) => {
      if (backendRef.current.mode === 'server') {
        try {
          await api.post('password', { current, next })
          return { ok: true }
        } catch (err) {
          return { ok: false, error: err.message }
        }
      }
      const user = stateRef.current.users.find((u) => u.id === userId)
      if (!user || user.password !== current) return { ok: false, error: 'Your current password is not correct.' }
      patch((prev) => ({ users: prev.users.map((u) => (u.id === userId ? { ...u, password: next } : u)) }))
      return { ok: true }
    },
    [patch],
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
    const local = applyCourseImport({ ...buildSeed(), ...stored })
    setState((prev) => {
      const next = { ...prev }
      for (const c of COLLECTIONS) {
        const mine = local[c] || []
        const ids = new Set(mine.map((r) => r.id))
        next[c] = [...(prev[c] || []).filter((r) => !ids.has(r.id)), ...mine]
      }
      next.settings = { ...prev.settings, ...(local.settings || {}) }
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
    (type, text, actorId, targetId = null) =>
      patch((prev) => ({
        events: [
          { id: uid('ev'), type, text, actorId, targetId, at: new Date().toISOString() },
          ...prev.events,
        ].slice(0, 200),
      })),
    [patch],
  )

  /* ---------------------------------------------------------------- users */
  const addUser = useCallback(
    (user) => {
      const record = {
        id: uid('u'),
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
        groupIds: [],
        avatar: null,
        registeredAt: new Date().toISOString(),
        lastLogin: null,
        ...user,
      }
      patch((prev) => ({ users: [...prev.users, record] }))
      return record
    },
    [patch],
  )

  const updateUser = useCallback(
    (id, changes) =>
      patch((prev) => ({ users: prev.users.map((x) => (x.id === id ? { ...x, ...changes } : x)) })),
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
      const record = {
        ...COURSE_DEFAULTS,
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
    (id, changes) =>
      patch((prev) => ({
        courses: prev.courses.map((x) =>
          x.id === id ? { ...x, ...changes, updatedAt: new Date().toISOString() } : x,
        ),
      })),
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
    (userIds, courseIds) =>
      patch((prev) => {
        const additions = []
        userIds.forEach((userId) => {
          courseIds.forEach((courseId) => {
            const exists = prev.enrollments.some((e) => e.userId === userId && e.courseId === courseId)
            if (!exists) {
              additions.push({
                id: uid('en'),
                userId,
                courseId,
                enrolledAt: new Date().toISOString(),
                completedUnits: [],
                status: 'not_started',
                score: null,
                completedAt: null,
                timeSpentMin: 0,
              })
            }
          })
        })
        return { enrollments: [...prev.enrollments, ...additions] }
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
          : [
              ...prev.enrollments,
              {
                id: uid('en'),
                userId: request.userId,
                courseId: request.courseId,
                enrolledAt: new Date().toISOString(),
                completedUnits: [],
                status: 'not_started',
                score: null,
                completedAt: null,
                timeSpentMin: 0,
              },
            ]
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
            ? { ...e, completedUnits: [], status: 'not_started', score: null, completedAt: null, timeSpentMin: 0 }
            : e,
        ),
      })),
    [patch],
  )

  /** Marks a unit complete and rolls the enrollment status forward. */
  const completeUnit = useCallback(
    (userId, courseId, unitId, extra = {}) =>
      patch((prev) => {
        const course = prev.courses.find((c) => c.id === courseId)
        const contentUnits = (course?.units || []).filter((un) => un.type !== 'section')
        const enrollments = prev.enrollments.map((e) => {
          if (e.userId !== userId || e.courseId !== courseId) return e
          const completedUnits = e.completedUnits.includes(unitId)
            ? e.completedUnits
            : [...e.completedUnits, unitId]
          const done = contentUnits.length > 0 && contentUnits.every((un) => completedUnits.includes(un.id))
          return {
            ...e,
            completedUnits,
            timeSpentMin: (e.timeSpentMin || 0) + (extra.minutes || 2),
            score: extra.score != null ? extra.score : e.score,
            status: done ? 'completed' : 'in_progress',
            completedAt: done ? e.completedAt || new Date().toISOString() : null,
          }
        })
        const finished = enrollments.find(
          (e) => e.userId === userId && e.courseId === courseId && e.status === 'completed',
        )
        let certificates = prev.certificates
        if (finished && course?.certificate && !certificates.some((c) => c.userId === userId && c.courseId === courseId)) {
          certificates = [
            ...certificates,
            {
              id: uid('cert'),
              userId,
              courseId,
              issuedAt: new Date().toISOString(),
              type: course.certificateType || 'classic',
              code: `GA-${(course.code || 'CRS').toUpperCase()}-${Math.floor(1000 + Math.random() * 8999)}`,
            },
          ]
        }
        return { enrollments, certificates }
      }),
    [patch],
  )

  /* ---------------------------------------- collections with plain records */
  const collectionActions = useMemo(() => {
    const make = (key, prefix) => ({
      add: (item) => {
        const record = { id: uid(prefix), createdAt: new Date().toISOString(), ...item }
        patch((prev) => ({ [key]: [...prev[key], record] }))
        return record
      },
      update: (id, changes) =>
        patch((prev) => ({ [key]: prev[key].map((x) => (x.id === id ? { ...x, ...changes } : x)) })),
      remove: (id) => patch((prev) => ({ [key]: prev[key].filter((x) => x.id !== id) })),
    })
    return {
      groups: make('groups', 'g'),
      branches: make('branches', 'br'),
      categories: make('categories', 'cat'),
      userTypes: make('userTypes', 'ut'),
      notificationRules: make('notifications', 'nt'),
      messages: make('messages', 'm'),
      submissions: make('submissions', 'sub'),
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

  const importState = useCallback((next) => setState(next), [])

  const resetPortal = useCallback(() => {
    if (backendRef.current.mode === 'local') clearState()
    setState(applyCourseImport(buildSeed()))
  }, [])

  const value = useMemo(
    () => ({
      ...state,
      backend,
      me,
      syncProblem,
      storageFull,
      localCopy,
      actions: {
        signIn,
        signOut,
        reload,
        changePassword,
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
        gradeSubmission,
        markMessageRead,
        updateSettings,
        importState,
        resetPortal,
        ...collectionActions,
      },
    }),
    [
      state,
      backend,
      me,
      syncProblem,
      storageFull,
      localCopy,
      signIn,
      signOut,
      reload,
      changePassword,
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
      gradeSubmission,
      markMessageRead,
      updateSettings,
      importState,
      resetPortal,
      collectionActions,
    ],
  )

  if (backend.mode === 'pending' || (backend.mode === 'server' && backend.status === 'loading')) return <Splash />
  if (backend.mode === 'server' && backend.status === 'error')
    return <Splash error={backend.error} onRetry={() => reload()} />

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

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
      const course = courseById(enrollmentRecord.courseId)
      const total = (course?.units || []).filter((u) => u.type !== 'section').length
      if (!total) return 0
      return Math.round((enrollmentRecord.completedUnits.length / total) * 100)
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
