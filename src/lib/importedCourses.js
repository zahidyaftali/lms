import imported from './importedCourses.json'
import { COURSE_DEFAULTS } from './courseDefaults'

/**
 * Courses copied from the GA Healthcare TalentLMS portal (gahctc.talentlms.com) on
 * 27/09/2026: lessons, sections, test settings, the assignment, and every document and
 * video (files live in public/course-files). Users, enrollments and other TalentLMS data
 * were deliberately not copied.
 *
 * The import is applied once per portal, recorded in `courseImports`, so courses edited
 * afterwards are never overwritten on the next load.
 */
export const IMPORT_ID = 'talentlms-2026-09-27'

export function applyCourseImport(state) {
  if ((state.courseImports || []).includes(IMPORT_ID)) return state

  const incoming = new Map(imported.courses.map((c) => [c.id, c]))
  // Matching courses keep what the portal added locally (instructors, certificate,
  // difficulty) and take everything TalentLMS holds, including the unit list.
  const courses = state.courses.map((c) => (incoming.has(c.id) ? { ...c, ...incoming.get(c.id) } : c))
  const known = new Set(courses.map((c) => c.id))
  imported.courses.forEach((c) => {
    if (!known.has(c.id)) courses.push({ ...COURSE_DEFAULTS, instructorIds: [], certificate: false, ...c })
  })

  // Progress that pointed at the portal's old sample units no longer applies.
  const unitsOf = new Map(courses.map((c) => [c.id, new Set(c.units.map((u) => u.id))]))
  const enrollments = state.enrollments.map((e) => {
    if (!incoming.has(e.courseId)) return e
    const valid = unitsOf.get(e.courseId)
    const completedUnits = e.completedUnits.filter((id) => valid.has(id))
    if (completedUnits.length === e.completedUnits.length) return e
    return {
      ...e,
      completedUnits,
      status: e.status === 'completed' ? e.status : completedUnits.length ? 'in_progress' : 'not_started',
    }
  })

  return { ...state, courses, enrollments, courseImports: [...(state.courseImports || []), IMPORT_ID] }
}
