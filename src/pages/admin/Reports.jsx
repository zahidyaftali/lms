import { useMemo, useState } from 'react'
import { ActivityChart, DonutChart, MiniBars } from '../../components/charts/Charts'
import { Badge, Button, DataTable, PageHeader, Progress, SearchInput, Select, Tabs, Icon } from '../../components/ui'
import { useData, useSelectors } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { cx, download, duration, formatDate, fullName, shortName, timeAgo, toCSV } from '../../lib/utils'

export default function Reports() {
  const { users, courses, enrollments, events, submissions } = useData()
  const { progressOf, userById, courseById, coursesOfInstructor } = useSelectors()
  const { user, view } = useAuth()
  const [tab, setTab] = useState('overview')
  const [query, setQuery] = useState('')
  const [courseFilter, setCourseFilter] = useState('')

  const scopedCourses = view === 'instructor' ? coursesOfInstructor(user.id) : courses
  const scopedIds = scopedCourses.map((c) => c.id)
  const scopedEnrollments = enrollments.filter((e) => scopedIds.includes(e.courseId))

  const statusSegments = [
    {
      label: 'Completed',
      value: scopedEnrollments.filter((e) => e.status === 'completed').length,
      color: '#16a34a',
    },
    {
      label: 'In progress',
      value: scopedEnrollments.filter((e) => e.status === 'in_progress').length,
      color: '#1a56db',
    },
    {
      label: 'Not started',
      value: scopedEnrollments.filter((e) => e.status === 'not_started').length,
      color: '#cbd5e1',
    },
  ]

  const chartData = useMemo(() => {
    const buckets = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() - i)
      buckets.push({ date: d, logins: 0, completions: 0 })
    }
    const find = (iso) => buckets.find((b) => b.date.getTime() === new Date(iso).setHours(0, 0, 0, 0))
    events.forEach((ev) => {
      const b = find(ev.at)
      if (!b) return
      if (ev.type === 'login') b.logins += 1
      if (ev.type === 'completion') b.completions += 1
    })
    return buckets.map((b) => ({
      ...b,
      label: b.date.toLocaleDateString(undefined, { weekday: 'short' }),
      sublabel: b.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    }))
  }, [events])

  const courseRows = scopedCourses.map((c) => {
    const rows = enrollments.filter((e) => e.courseId === c.id)
    const completed = rows.filter((e) => e.status === 'completed').length
    const avg = rows.length ? rows.reduce((s, e) => s + progressOf(e), 0) / rows.length : 0
    const scores = rows.filter((e) => e.score != null).map((e) => e.score)
    return {
      id: c.id,
      course: c,
      enrolled: rows.length,
      completed,
      avgProgress: Math.round(avg),
      avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      minutes: rows.reduce((s, e) => s + (e.timeSpentMin || 0), 0),
    }
  })

  const userRows = users
    .filter((u) => (view === 'instructor' ? enrollments.some((e) => e.userId === u.id && scopedIds.includes(e.courseId)) : true))
    .filter((u) => fullName(u).toLowerCase().includes(query.trim().toLowerCase()))
    .map((u) => {
      const rows = enrollments.filter((e) => e.userId === u.id && (!courseFilter || e.courseId === courseFilter))
      const avg = rows.length ? rows.reduce((s, e) => s + progressOf(e), 0) / rows.length : 0
      return {
        id: u.id,
        user: u,
        courses: rows.length,
        completed: rows.filter((e) => e.status === 'completed').length,
        avgProgress: Math.round(avg),
        minutes: rows.reduce((s, e) => s + (e.timeSpentMin || 0), 0),
      }
    })

  return (
    <div>
      <PageHeader title="Reports" subtitle="Training activity across the portal.">
        <Button
          variant="ghost"
          icon="download"
          onClick={() => {
            if (tab === 'users') {
              download(
                'user-report.csv',
                toCSV(userRows, [
                  { label: 'User', value: (r) => fullName(r.user) },
                  { label: 'Email', value: (r) => r.user.email },
                  { label: 'Courses', value: (r) => r.courses },
                  { label: 'Completed', value: (r) => r.completed },
                  { label: 'Average progress %', value: (r) => r.avgProgress },
                  { label: 'Training time', value: (r) => duration(r.minutes) },
                ]),
              )
            } else {
              download(
                'course-report.csv',
                toCSV(courseRows, [
                  { label: 'Course', value: (r) => r.course.name },
                  { label: 'Enrolled', value: (r) => r.enrolled },
                  { label: 'Completed', value: (r) => r.completed },
                  { label: 'Average progress %', value: (r) => r.avgProgress },
                  { label: 'Average score %', value: (r) => r.avgScore ?? '' },
                ]),
              )
            }
          }}
        >
          Export CSV
        </Button>
      </PageHeader>

      <Tabs
        tabs={[
          { value: 'overview', label: 'Overview' },
          { value: 'courses', label: 'Course reports' },
          { value: 'users', label: 'User reports' },
          { value: 'timeline', label: 'Activity log' },
        ]}
        active={tab}
        onChange={setTab}
        className="mb-6"
      />

      {tab === 'overview' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section className="card card-pad">
            <h2 className="card-title mb-5">Enrollment status</h2>
            <DonutChart
              segments={statusSegments}
              centerValue={scopedEnrollments.length}
              centerLabel="enrollments"
            />
          </section>

          <section className="card card-pad">
            <h2 className="card-title mb-5">Activity this week</h2>
            <ActivityChart data={chartData} height={210} />
          </section>

          <section className="card card-pad">
            <h2 className="card-title mb-5">Training time by course</h2>
            <MiniBars
              data={courseRows.map((r) => ({
                label: r.course.name,
                value: r.minutes,
                display: duration(r.minutes),
              }))}
            />
          </section>

          <section className="card card-pad">
            <h2 className="card-title mb-5">Key figures</h2>
            <div className="grid grid-cols-2 gap-4">
              <Figure label="Learners" value={users.filter((u) => u.role === 'learner').length} icon="users" />
              <Figure label="Active courses" value={scopedCourses.filter((c) => c.status === 'active').length} icon="book" />
              <Figure
                label="Completion rate"
                value={`${scopedEnrollments.length ? Math.round((statusSegments[0].value / scopedEnrollments.length) * 100) : 0}%`}
                icon="checkCircle"
              />
              <Figure label="Pending grading" value={submissions.filter((s) => s.status === 'pending').length} icon="clipboard" />
            </div>
          </section>
        </div>
      )}

      {tab === 'courses' && (
        <DataTable
          rows={courseRows}
          columns={[
            { key: 'course', label: 'Course', sortValue: (r) => r.course.name, render: (r) => r.course.name },
            { key: 'enrolled', label: 'Enrolled' },
            { key: 'completed', label: 'Completed' },
            {
              key: 'avgProgress',
              label: 'Average progress',
              render: (r) => (
                <div className="flex items-center gap-3 w-[180px]">
                  <Progress value={r.avgProgress} className="flex-1" />
                  <span className="text-[13px] w-9">{r.avgProgress}%</span>
                </div>
              ),
            },
            { key: 'avgScore', label: 'Average score', render: (r) => (r.avgScore != null ? `${r.avgScore}%` : '-') },
            { key: 'minutes', label: 'Training time', render: (r) => duration(r.minutes) },
          ]}
        />
      )}

      {tab === 'users' && (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <SearchInput value={query} onChange={setQuery} className="w-[250px]" />
            <Select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="w-[260px]">
              <option value="">All courses</option>
              {scopedCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <DataTable
            rows={userRows}
            columns={[
              {
                key: 'user',
                label: 'User',
                sortValue: (r) => fullName(r.user),
                render: (r) => (
                  <span>
                    <span className="block">{fullName(r.user)}</span>
                    <span className="block text-[12.5px] text-ink-500">{r.user.userType}</span>
                  </span>
                ),
              },
              { key: 'courses', label: 'Courses' },
              { key: 'completed', label: 'Completed' },
              {
                key: 'avgProgress',
                label: 'Average progress',
                render: (r) => (
                  <div className="flex items-center gap-3 w-[180px]">
                    <Progress value={r.avgProgress} className="flex-1" />
                    <span className="text-[13px] w-9">{r.avgProgress}%</span>
                  </div>
                ),
              },
              { key: 'minutes', label: 'Training time', render: (r) => duration(r.minutes) },
              {
                key: 'lastLogin',
                label: 'Last login',
                sortValue: (r) => (r.user.lastLogin ? new Date(r.user.lastLogin).getTime() : 0),
                render: (r) => (r.user.lastLogin ? timeAgo(r.user.lastLogin) : '-'),
              },
            ]}
          />
        </>
      )}

      {tab === 'timeline' && (
        <div className="card card-pad">
          <ul className="divide-y divide-line/70">
            {events.map((ev) => (
              <li key={ev.id} className="flex items-start gap-3 py-3">
                <span
                  className={cx(
                    'w-2 h-2 rounded-full mt-2 shrink-0',
                    ev.type === 'completion' || ev.type === 'progress'
                      ? 'bg-emerald-500'
                      : ev.type === 'delete'
                        ? 'bg-red-500'
                        : 'bg-brand-700',
                  )}
                />
                <p className="flex-1 text-[13.5px]">
                  <span className="font-semibold">{shortName(userById(ev.actorId))}</span> {ev.text}
                </p>
                <span className="text-[12px] text-ink-400 whitespace-nowrap">{formatDate(ev.at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Figure({ label, value, icon }) {
  return (
    <div className="border border-line rounded-md px-4 py-4">
      <span className="w-9 h-9 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center mb-3">
        <Icon name={icon} className="w-[18px] h-[18px]" strokeWidth={1.6} />
      </span>
      <p className="text-[20px] font-semibold leading-none">{value}</p>
      <p className="hint mt-1.5">{label}</p>
    </div>
  )
}
