/**
 * Course rules set in Course options (Availability and Limits tabs).
 * Older saved portals predate these fields, so every check treats a missing
 * value as the permissive default the course had before.
 */

const DAY = 86400000

/** "2026-10-01" from a date input → local midnight, in ms. */
function parseDay(value) {
  if (!value) return null
  const [y, m, d] = String(value).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d).getTime()
}

/**
 * Whether a learner can open the course right now.
 * - Time limit: `timeLimitDays` counted from the learner's enrollment date.
 * - Timeframe: open from `startDate` through the whole of `endDate`.
 * - Access retention: learners who completed the course keep access after either one runs out.
 *
 * Returns { state: 'open' | 'upcoming' | 'expired', starts?, ends? } with times in ms.
 */
export function accessWindow(course, enrollment, now = Date.now()) {
  if (!course) return { state: 'open' }
  if (course.retainAccess && enrollment?.status === 'completed') return { state: 'open' }

  if (course.timeMode === 'timeframe') {
    const starts = parseDay(course.startDate)
    const endDay = parseDay(course.endDate)
    const ends = endDay != null ? endDay + DAY - 1 : null
    if (starts != null && now < starts) return { state: 'upcoming', starts, ends }
    if (ends != null && now > ends) return { state: 'expired', starts, ends }
    return { state: 'open', starts, ends }
  }

  const days = Number(course.timeLimitDays) || 0
  if (days > 0 && enrollment?.enrolledAt) {
    const ends = new Date(enrollment.enrolledAt).getTime() + days * DAY
    return { state: now > ends ? 'expired' : 'open', ends }
  }
  return { state: 'open' }
}

/** A timeframe whose end date has passed — nobody new should be offered the course. */
export function timeframeEnded(course, now = Date.now()) {
  if (course?.timeMode !== 'timeframe') return false
  const endDay = parseDay(course.endDate)
  return endDay != null && now > endDay + DAY - 1
}

/** Capacity counts enrollments only; 0 or empty means unlimited. */
export function isCourseFull(course, enrolledCount) {
  const capacity = Number(course?.capacity) || 0
  return capacity > 0 && enrolledCount >= capacity
}

/**
 * Learners may join without approval only when the portal allows
 * self-enrollment and this course has its enrollment request switched off.
 */
export function canSelfEnroll(course, settings) {
  return !!settings?.courses?.allowSelfEnrollment && course?.enrollmentRequest === false
}

export function isPubliclyShared(course) {
  return !!course && course.status === 'active' && !!course.publicSharing
}

export function publicCourseURL(courseId) {
  return `${window.location.origin}/share/${courseId}`
}
