import { useNavigate } from 'react-router-dom'
import { Badge, Button, Icon, Progress } from '../../components/ui'
import { MiniBars } from '../../components/charts/Charts'
import { useData, useSelectors } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { formatDateTime, shortName, timeAgo } from '../../lib/utils'

export default function InstructorHome() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { enrollments, submissions } = useData()
  const { coursesOfInstructor, progressOf, userById } = useSelectors()

  const courses = coursesOfInstructor(user.id)
  const courseIds = courses.map((c) => c.id)
  const myEnrollments = enrollments.filter((e) => courseIds.includes(e.courseId))
  const learners = new Set(myEnrollments.map((e) => e.userId))
  const pending = submissions.filter((s) => courseIds.includes(s.courseId) && s.status === 'pending')

  const sessions = courses.flatMap((c) =>
    c.units
      .filter((u) => u.type === 'ilt')
      .flatMap((u) => (u.data?.sessions || []).map((s) => ({ ...s, course: c.name }))),
  )

  return (
    <div>
      <h1 className="page-title mb-1">Welcome, {user.firstName}!</h1>
      <p className="hint mb-7">Here is what is happening across the courses you teach.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Tile icon="book" label="My courses" value={courses.length} />
        <Tile icon="users" label="Learners" value={learners.size} />
        <Tile icon="clipboard" label="Awaiting grading" value={pending.length} />
        <Tile
          icon="checkCircle"
          label="Completions"
          value={myEnrollments.filter((e) => e.status === 'completed').length}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <section className="card card-pad">
          <div className="flex items-center justify-between gap-4 mb-5">
            <h2 className="card-title">My courses</h2>
            <button onClick={() => navigate('/courses')} className="link text-[13.5px]">
              Manage
            </button>
          </div>
          {courses.length === 0 ? (
            <p className="hint">No courses have been assigned to you yet.</p>
          ) : (
            <ul className="space-y-4">
              {courses.map((c) => {
                const rows = myEnrollments.filter((e) => e.courseId === c.id)
                const avg = rows.length ? rows.reduce((s, e) => s + progressOf(e), 0) / rows.length : 0
                return (
                  <li key={c.id} className="border border-line rounded-md p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex-1 min-w-0">
                        <button onClick={() => navigate(`/courses/${c.id}`)} className="link text-[14.5px] font-medium truncate block">
                          {c.name}
                        </button>
                        <span className="hint">{rows.length} learners enrolled</span>
                      </span>
                      <Badge tone={c.published ? 'green' : 'gray'}>{c.published ? 'Published' : 'Draft'}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      <Progress value={avg} className="flex-1" />
                      <span className="text-[12.5px] text-ink-700 w-20 text-right">{Math.round(avg)}% average</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          <section className="card card-pad">
            <div className="flex items-center justify-between gap-4 mb-5">
              <h2 className="card-title">Awaiting grading</h2>
              <button onClick={() => navigate('/grading')} className="link text-[13.5px]">
                Open grading
              </button>
            </div>
            {pending.length === 0 ? (
              <p className="hint">Nothing waiting for review — you are all caught up.</p>
            ) : (
              <ul className="space-y-3.5">
                {pending.slice(0, 5).map((s) => (
                  <li key={s.id} className="flex items-center gap-3">
                    <Icon name="clipboard" className="w-[18px] h-[18px] text-amber-600 shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13.5px] truncate">{shortName(userById(s.userId))}</span>
                      <span className="block hint">Submitted {timeAgo(s.submittedAt)}</span>
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => navigate('/grading')}>
                      Review
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card card-pad">
            <h2 className="card-title mb-5">Upcoming sessions</h2>
            {sessions.length === 0 ? (
              <p className="hint">No instructor-led sessions scheduled.</p>
            ) : (
              <ul className="space-y-4">
                {sessions.map((s) => (
                  <li key={s.id} className="flex items-start gap-3">
                    <Icon name="calendar" className="w-[18px] h-[18px] text-brand-700 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-medium truncate">{s.name}</p>
                      <p className="hint">
                        {s.start ? formatDateTime(s.start) : 'Date to be confirmed'} · {s.course}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card card-pad">
            <h2 className="card-title mb-5">Enrollment by course</h2>
            <MiniBars
              data={courses.map((c) => ({
                label: c.name,
                value: myEnrollments.filter((e) => e.courseId === c.id).length,
              }))}
            />
          </section>
        </div>
      </div>
    </div>
  )
}

function Tile({ icon, label, value }) {
  return (
    <div className="card px-5 py-4">
      <span className="w-9 h-9 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center mb-3">
        <Icon name={icon} className="w-[18px] h-[18px]" strokeWidth={1.6} />
      </span>
      <p className="text-[22px] font-semibold leading-none">{value}</p>
      <p className="hint mt-1.5">{label}</p>
    </div>
  )
}
