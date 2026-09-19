import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { loadState, saveState, clearState } from '../lib/storage'
import { buildSeed } from '../lib/seed'
import { uid } from '../lib/utils'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  // Saved portals from an earlier version may predate newer collections, so
  // seed defaults fill in any keys the stored state is missing.
  const [state, setState] = useState(() => {
    const stored = loadState()
    return stored ? { ...buildSeed(), ...stored } : buildSeed()
  })
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    saveState(state)
  }, [state])

  const patch = useCallback((updater) => setState((prev) => ({ ...prev, ...updater(prev) })), [])

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
        id: uid('c'),
        name: 'New course',
        code: '',
        categoryId: null,
        price: 0,
        description: '',
        status: 'inactive',
        published: false,
        level: 'All levels',
        capacity: 0,
        instructorIds: [],
        certificate: true,
        completionRule: 'All units must be completed',
        timeLimitDays: 0,
        cover: 'default',
        units: [],
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
    clearState()
    setState(buildSeed())
  }, [])

  const value = useMemo(
    () => ({
      ...state,
      actions: {
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

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
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
