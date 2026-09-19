import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ActivityChart, MiniBars } from '../../components/charts/Charts'
import { Avatar, Badge, Button, Icon, Modal, Progress, Select, StatRow } from '../../components/ui'
import { useData, useSelectors } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { cx, duration, fullName, shortName, timeAgo } from '../../lib/utils'

const DOT = {
  login: 'bg-brand-700',
  user: 'bg-brand-700',
  course: 'bg-amber-500',
  progress: 'bg-emerald-500',
  completion: 'bg-emerald-500',
  delete: 'bg-red-500',
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { users, courses, groups, enrollments, events, submissions, enrollmentRequests, actions } = useData()
  const { userById, progressOf } = useSelectors()
  const toast = useToast()
  const [range, setRange] = useState('week')
  const [widgetsOpen, setWidgetsOpen] = useState(false)

  const chartData = useMemo(() => {
    const days = range === 'week' ? 7 : 30
    const buckets = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() - i)
      buckets.push({ date: d, logins: 0, completions: 0 })
    }
    const inBucket = (iso) => {
      const t = new Date(iso).setHours(0, 0, 0, 0)
      return buckets.find((b) => b.date.getTime() === t)
    }
    events.forEach((ev) => {
      const b = inBucket(ev.at)
      if (!b) return
      if (ev.type === 'login') b.logins += 1
      if (ev.type === 'completion') b.completions += 1
    })
    enrollments.forEach((en) => {
      if (!en.completedAt) return
      const b = inBucket(en.completedAt)
      if (b) b.completions += 1
    })

    // Every bar is drawn, but only every third gets an axis label so the
    // two-line date captions never collide.
    const show = range === 'week' ? buckets : buckets.filter((_, i) => i % 2 === 0)
    return show.map((b, i) => {
      const labelled = i % 3 === 0
      return {
        ...b,
        label: labelled
          ? b.date.toLocaleDateString(undefined, range === 'week' ? { weekday: 'long' } : { month: 'short' })
          : '',
        sublabel: labelled ? b.date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' }) : '',
      }
    })
  }, [events, enrollments, range])

  const activeUsers = users.filter((u) => u.active).length
  const assignedCourses = new Set(enrollments.map((e) => e.courseId)).size
  const trainingMinutes = enrollments.reduce((sum, e) => sum + (e.timeSpentMin || 0), 0)
  const completionRate = enrollments.length
    ? (enrollments.filter((e) => e.status === 'completed').length / enrollments.length) * 100
    : 0

  const topCourses = useMemo(
    () =>
      courses
        .filter((c) => c.status === 'active')
        .map((c) => ({
          label: c.name,
          value: enrollments.filter((e) => e.courseId === c.id).length,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5),
    [courses, enrollments],
  )

  const pending = submissions.filter((s) => s.status === 'pending')
  const pendingRequests = (enrollmentRequests || []).filter((r) => r.status === 'pending')

  const quickActions = [
    { icon: 'userPlus', label: 'Add user', to: '/users?new=1' },
    { icon: 'bookPlus', label: 'Add course', to: '/courses?new=1' },
    { icon: 'code', label: 'Portal settings', to: '/settings' },
    { icon: 'group', label: 'Add group', to: '/groups?new=1' },
    { icon: 'report', label: 'Custom reports', to: '/reports' },
  ]

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-7">
        <h1 className="page-title flex items-center gap-3">
          <span className="text-[22px]" aria-hidden="true">
            🎉
          </span>
          Welcome, {user.firstName.toLowerCase()}!
        </h1>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setWidgetsOpen(true)}>
            Add widgets
          </Button>
          <button
            onClick={() => setWidgetsOpen(true)}
            className="w-11 h-11 rounded-md border border-brand-700 text-brand-700 flex items-center justify-center hover:bg-brand-50"
            aria-label="Edit dashboard"
          >
            <Icon name="pencil" className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 lg:gap-6 stagger">
        <section className="card card-pad">
          <div className="flex items-center justify-between gap-4 mb-5">
            <h2 className="card-title">Portal activity</h2>
            <Select value={range} onChange={(e) => setRange(e.target.value)} className="w-[140px] h-10">
              <option value="week">Week</option>
              <option value="month">Month</option>
            </Select>
          </div>
          <ActivityChart data={chartData} />
        </section>

        <section className="card card-pad">
          <h2 className="card-title mb-5">Quick actions</h2>
          <ul>
            {quickActions.map((a) => (
              <li key={a.label}>
                <button
                  onClick={() => navigate(a.to)}
                  className="w-full flex items-center gap-4 py-3 text-left group"
                >
                  <span className="text-ink-700 group-hover:text-brand-700">
                    <Icon name={a.icon} className="w-[22px] h-[22px]" strokeWidth={1.5} />
                  </span>
                  <span className="text-[14px] leading-[22px] font-semibold text-ink-900 group-hover:text-brand-700">{a.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="card card-pad">
          <h2 className="card-title mb-3">Overview</h2>
          <div>
            <StatRow icon="users" label="Active users" value={activeUsers} />
            <StatRow icon="book" label="Assigned courses" value={assignedCourses} />
            <StatRow icon="group" label="Groups" value={groups.length} />
            <StatRow icon="clock" label="Training time" value={duration(trainingMinutes)} />
            <StatRow icon="report" label="Completion rate" value={`${completionRate.toFixed(2)}%`} />
          </div>
        </section>

        <section className="card card-pad">
          <button
            onClick={() => navigate('/reports')}
            className="flex items-center gap-2 mb-4 text-ink-900 hover:text-brand-700"
          >
            <h2 className="card-title">Timeline</h2>
            <Icon name="chevronRight" className="w-4 h-4" strokeWidth={2.2} />
          </button>
          <ul className="max-h-[260px] overflow-y-auto scroll-thin pr-2">
            {events.slice(0, 20).map((ev) => {
              const actor = userById(ev.actorId)
              return (
                <li key={ev.id} className="flex items-center gap-3 py-2">
                  <span className={cx('w-2 h-2 rounded-full shrink-0', DOT[ev.type] || 'bg-gray-400')} />
                  <p className="flex-1 min-w-0 truncate text-[14px] leading-[22px] text-ink-900">
                    <span className="font-semibold">
                      {actor?.id === user.id ? 'You' : shortName(actor)}
                    </span>{' '}
                    {ev.text}
                  </p>
                  <span className="text-[12.5px] text-ink-400 italic whitespace-nowrap shrink-0">{timeAgo(ev.at)}</span>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="card card-pad xl:col-span-2">
          <div className="flex items-center justify-between gap-4 mb-5">
            <h2 className="card-title">Enrollment requests</h2>
            {pendingRequests.length > 0 && <Badge tone="amber">{pendingRequests.length} waiting</Badge>}
          </div>

          {pendingRequests.length === 0 ? (
            <p className="hint">
              No requests waiting. Learners who ask to join a course from the catalog appear here for approval.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {pendingRequests.map((r) => {
                const learner = userById(r.userId)
                const course = courses.find((c) => c.id === r.courseId)
                return (
                  <li key={r.id} className="py-4 flex flex-wrap items-center gap-4 animate-fade-in">
                    <Avatar user={learner} size={38} />
                    <div className="flex-1 min-w-[180px]">
                      <p className="text-[14px]">
                        <span className="font-semibold">{fullName(learner)}</span> asked to join{' '}
                        <span className="font-semibold">{course?.name || 'a removed course'}</span>
                      </p>
                      <p className="hint mt-0.5">Requested {timeAgo(r.requestedAt)}</p>
                      {r.note && <p className="text-[13px] text-ink-700 mt-1.5 italic">“{r.note}”</p>}
                    </div>
                    <div className="flex gap-2.5 ml-auto">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          actions.resolveEnrollmentRequest(r.id, false)
                          toast('Request declined.', 'info')
                        }}
                      >
                        Decline
                      </Button>
                      <Button
                        size="sm"
                        icon="check"
                        onClick={() => {
                          actions.resolveEnrollmentRequest(r.id, true)
                          actions.logEvent(
                            'user',
                            `approved ${shortName(learner)} for ${course?.name || 'a course'}`,
                            user.id,
                          )
                          toast(`${shortName(learner)} enrolled in ${course?.name || 'the course'}.`)
                        }}
                      >
                        Approve
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="card card-pad">
          <h2 className="card-title mb-5">Course enrollment</h2>
          {topCourses.length ? (
            <MiniBars data={topCourses} />
          ) : (
            <p className="hint">No enrollments recorded yet.</p>
          )}
        </section>

        <section className="card card-pad">
          <h2 className="card-title mb-5">Needs your attention</h2>
          <ul className="space-y-4">
            <li className="flex items-center gap-4">
              <span className="w-9 h-9 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center">
                <Icon name="clipboard" className="w-[18px] h-[18px]" />
              </span>
              <span className="flex-1 text-[14px]">Assignments awaiting grading</span>
              <Badge tone={pending.length ? 'amber' : 'gray'}>{pending.length}</Badge>
            </li>
            <li className="flex items-center gap-4">
              <span className="w-9 h-9 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Icon name="userPlus" className="w-[18px] h-[18px]" />
              </span>
              <span className="flex-1 text-[14px]">Enrollment requests to review</span>
              <Badge tone={pendingRequests.length ? 'amber' : 'gray'}>{pendingRequests.length}</Badge>
            </li>
            <li className="flex items-center gap-4">
              <span className="w-9 h-9 rounded-md bg-red-50 text-red-600 flex items-center justify-center">
                <Icon name="user" className="w-[18px] h-[18px]" />
              </span>
              <span className="flex-1 text-[14px]">Inactive user accounts</span>
              <Badge tone={users.some((u) => !u.active) ? 'red' : 'gray'}>
                {users.filter((u) => !u.active).length}
              </Badge>
            </li>
            <li className="flex items-center gap-4">
              <span className="w-9 h-9 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center">
                <Icon name="book" className="w-[18px] h-[18px]" />
              </span>
              <span className="flex-1 text-[14px]">Unpublished courses</span>
              <Badge tone="blue">{courses.filter((c) => !c.published).length}</Badge>
            </li>
          </ul>

          <div className="mt-6 pt-5 border-t border-line">
            <p className="text-[13px] text-ink-500 mb-2">Overall learner progress</p>
            <Progress
              value={
                enrollments.length
                  ? enrollments.reduce((sum, e) => sum + progressOf(e), 0) / enrollments.length
                  : 0
              }
            />
          </div>
        </section>
      </div>

      <Modal
        open={widgetsOpen}
        onClose={() => setWidgetsOpen(false)}
        title="Dashboard widgets"
        subtitle="Choose what the portal home page shows."
        footer={<Button onClick={() => setWidgetsOpen(false)}>Done</Button>}
      >
        <ul className="space-y-3">
          {['Portal activity', 'Quick actions', 'Overview', 'Timeline', 'Course enrollment', 'Needs your attention'].map(
            (w) => (
              <li key={w} className="flex items-center justify-between rounded-md border border-line px-4 py-3">
                <span className="text-[14px]">{w}</span>
                <Badge tone="green">Shown</Badge>
              </li>
            ),
          )}
        </ul>
      </Modal>
    </div>
  )
}
