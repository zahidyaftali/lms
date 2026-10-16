/**
 * Everything with a date that a person should see on the Calendar: instructor-led
 * sessions, events added by administrators and instructors, course windows,
 * assignment due dates, access that runs out, certificates that expire.
 */
import { accessWindow } from './courseAccess'
import { DAY, assignmentDue, calendarEventVisible, certificateExpiry, contentUnits, isAdminRole } from './rules.js'

export const KIND = {
  session: { label: 'Instructor-led session', tone: 'bg-brand-700', soft: 'bg-brand-50 text-brand-800 border-brand-100' },
  event: { label: 'Event', tone: 'bg-gold-500', soft: 'bg-amber-50 text-amber-900 border-amber-100' },
  course: { label: 'Course dates', tone: 'bg-navy-600', soft: 'bg-slate-100 text-slate-800 border-slate-200' },
  due: { label: 'Due date', tone: 'bg-red-500', soft: 'bg-red-50 text-red-800 border-red-100' },
  expiry: { label: 'Expiry', tone: 'bg-gray-500', soft: 'bg-gray-100 text-ink-700 border-gray-200' },
}

const iso = (ms) => new Date(ms).toISOString()

/**
 * The dated items `user` (seen as `view`) should see.
 * Item: { id, kind, title, start, end, allDay, courseId?, unitId?, sessionId?, eventId?, location?, meetingUrl?, description?, path? }
 */
export function calendarItems(state, user, view) {
  if (!user) return []
  const items = []
  const courses = state.courses || []
  const enrollments = state.enrollments || []
  const staffView = view === 'admin' || view === 'instructor'
  const teaches = (c) => (c.instructorIds || []).includes(user.id)
  const mine = new Map(enrollments.filter((e) => e.userId === user.id).map((e) => [e.courseId, e]))
  const registrations = (state.registrations || []).filter((r) => r.userId === user.id && r.attended !== false)

  for (const course of courses) {
    const enrollment = mine.get(course.id)
    const relevant = view === 'admin' ? isAdminRole(user) : view === 'instructor' ? teaches(course) : !!enrollment
    if (!relevant) continue
    const path = staffView ? `/courses/${course.id}` : `/my-courses/${course.id}`

    for (const unit of contentUnits(course)) {
      if (unit.type === 'ilt') {
        for (const s of unit.data?.sessions || []) {
          if (!s.start) continue
          // Learners see the sessions of their courses; the one they registered for is marked as theirs.
          const registered = registrations.some((r) => r.sessionId === s.id)
          items.push({
            id: `s_${s.id}`,
            kind: 'session',
            title: s.name || unit.name,
            subtitle: course.name,
            start: s.start,
            end: s.end || iso(new Date(s.start).getTime() + 3600000),
            allDay: false,
            courseId: course.id,
            unitId: unit.id,
            sessionId: s.id,
            location: s.location || '',
            meetingUrl: s.meetingUrl || '',
            instructor: s.instructor || '',
            registered,
            path,
          })
        }
      }
      if (unit.type === 'assignment' && enrollment && !staffView && !(enrollment.completedUnits || []).includes(unit.id)) {
        const due = assignmentDue(unit, enrollment)
        if (due) items.push({ id: `d_${course.id}_${unit.id}`, kind: 'due', title: `${unit.name} is due`, subtitle: course.name, start: iso(due), end: iso(due), allDay: true, courseId: course.id, unitId: unit.id, path })
      }
    }

    if (course.timeMode === 'timeframe' && (course.startDate || course.endDate)) {
      if (course.startDate) items.push({ id: `cs_${course.id}`, kind: 'course', title: `${course.name} opens`, start: `${course.startDate}T00:00:00`, allDay: true, courseId: course.id, path })
      if (course.endDate) items.push({ id: `ce_${course.id}`, kind: 'course', title: `${course.name} closes`, start: `${course.endDate}T00:00:00`, allDay: true, courseId: course.id, path })
    } else if (enrollment && !staffView && enrollment.status !== 'completed') {
      const { ends } = accessWindow(course, enrollment)
      if (ends) items.push({ id: `ae_${enrollment.id}`, kind: 'due', title: `Access to ${course.name} ends`, start: iso(ends), allDay: true, courseId: course.id, path })
    }
  }

  // Certificates that run out, for the learner who holds them.
  if (!staffView) {
    for (const c of state.certificates || []) {
      if (c.userId !== user.id) continue
      const ends = certificateExpiry(c, state.settings)
      if (!ends) continue
      const name = courses.find((x) => x.id === c.courseId)?.name || (state.learningPaths || []).find((p) => p.id === c.pathId)?.name || 'Certificate'
      items.push({ id: `ex_${c.id}`, kind: 'expiry', title: `Certificate for ${name} expires`, start: iso(ends), allDay: true, path: '/certificates' })
    }
  }

  for (const ev of state.calendarEvents || []) {
    if (!calendarEventVisible(ev, user, state)) continue
    items.push({
      id: `e_${ev.id}`,
      kind: 'event',
      title: ev.title,
      start: ev.start,
      end: ev.end || ev.start,
      allDay: !!ev.allDay,
      eventId: ev.id,
      location: ev.location || '',
      meetingUrl: ev.url || '',
      description: ev.description || '',
      courseId: ev.audience === 'course' ? ev.targetId : undefined,
    })
  }

  return items.sort((a, b) => new Date(a.start) - new Date(b.start))
}

/** Items that touch the day starting at `dayStart` (local midnight, ms). */
export function itemsOnDay(items, dayStart) {
  const dayEnd = dayStart + DAY
  return items.filter((it) => {
    const s = new Date(it.start).getTime()
    const e = it.end ? new Date(it.end).getTime() : s
    if (it.allDay) {
      const d = new Date(it.start)
      const local = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
      return local === dayStart
    }
    return s < dayEnd && Math.max(e, s) >= dayStart
  })
}

/* --------------------------------------------------------------- iCalendar */

const esc = (v) => String(v || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const stamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const day = (value) => {
  const d = new Date(value)
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

/** An .ics file holding `items` (from calendarItems) that any calendar app can import. */
export function icsFile(items, { name = 'Calendar', origin = '' } = {}) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GA Healthcare Training//Learning Portal//EN', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(name)}`]
  for (const it of items) {
    const start = new Date(it.start).getTime()
    if (!Number.isFinite(start)) continue
    lines.push('BEGIN:VEVENT', `UID:${it.id}@lms`, `DTSTAMP:${stamp(Date.now())}`)
    if (it.allDay) {
      const next = new Date(it.start)
      next.setDate(next.getDate() + 1)
      lines.push(`DTSTART;VALUE=DATE:${day(it.start)}`, `DTEND;VALUE=DATE:${day(next)}`)
    } else {
      const end = it.end ? new Date(it.end).getTime() : start + 3600000
      lines.push(`DTSTART:${stamp(start)}`, `DTEND:${stamp(Math.max(end, start))}`)
    }
    lines.push(`SUMMARY:${esc(it.title)}`)
    const description = [it.subtitle, it.description, it.meetingUrl && `Join: ${it.meetingUrl}`, it.path && origin && `${origin}${it.path}`].filter(Boolean).join('\n')
    if (description) lines.push(`DESCRIPTION:${esc(description)}`)
    if (it.location) lines.push(`LOCATION:${esc(it.location)}`)
    if (it.meetingUrl) lines.push(`URL:${esc(it.meetingUrl)}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  // Lines longer than 75 octets are folded, as the format requires.
  return lines.map((l) => (l.length > 74 ? l.match(/.{1,73}/g).join('\r\n ') : l)).join('\r\n')
}
