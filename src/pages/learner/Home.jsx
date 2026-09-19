import { useNavigate } from 'react-router-dom'
import { Badge, Button, Icon, Progress } from '../../components/ui'
import { useData, useSelectors } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { duration, formatDateTime } from '../../lib/utils'

export default function LearnerHome() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { certificates } = useData()
  const { coursesOfLearner, progressOf } = useSelectors()

  const items = coursesOfLearner(user.id)
  const inProgress = items.filter((i) => i.enrollment.status !== 'completed')
  const completed = items.filter((i) => i.enrollment.status === 'completed')
  const minutes = items.reduce((sum, i) => sum + (i.enrollment.timeSpentMin || 0), 0)
  const myCertificates = certificates.filter((c) => c.userId === user.id)

  const sessions = items.flatMap((i) =>
    i.course.units
      .filter((u) => u.type === 'ilt')
      .flatMap((u) => (u.data?.sessions || []).map((s) => ({ ...s, course: i.course.name }))),
  )

  const next = inProgress[0]

  return (
    <div>
      <h1 className="page-title mb-1">Welcome back, {user.firstName}!</h1>
      <p className="hint mb-7">Pick up where you left off, or review what you have already completed.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 stagger">
        <Tile icon="book" label="Courses in progress" value={inProgress.length} />
        <Tile icon="checkCircle" label="Completed" value={completed.length} />
        <Tile icon="clock" label="Training time" value={duration(minutes)} />
        <Tile icon="certificate" label="Certificates" value={myCertificates.length} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-6 items-start">
        <section className="card card-pad">
          <div className="flex items-center justify-between gap-4 mb-5">
            <h2 className="card-title">Continue learning</h2>
            <button onClick={() => navigate('/my-courses')} className="link text-[13.5px]">
              View all
            </button>
          </div>

          {items.length === 0 ? (
            <p className="hint">
              You have no courses yet. Your program office will assign them to your account.
            </p>
          ) : (
            <ul className="space-y-4">
              {items.slice(0, 4).map(({ course, enrollment }) => {
                const value = progressOf(enrollment)
                return (
                  <li key={course.id} className="border border-line rounded-md p-4">
                    <div className="flex items-start gap-4">
                      <span className="w-10 h-10 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                        <Icon name="book" className="w-5 h-5" strokeWidth={1.6} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14.5px] font-medium truncate">{course.name}</p>
                        <p className="hint mt-0.5">
                          {course.units.filter((u) => u.type !== 'section').length} units
                          {course.code ? ` · ${course.code}` : ''}
                        </p>
                        <div className="flex items-center gap-3 mt-3">
                          <Progress value={value} className="flex-1" tone={value === 100 ? 'green' : 'brand'} />
                          <span className="text-[12.5px] text-ink-700 w-9">{value}%</span>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => navigate(`/my-courses/${course.id}`)}>
                        {value === 0 ? 'Start' : value === 100 ? 'Review' : 'Continue'}
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          {next && (
            <section className="card card-pad">
              <h2 className="card-title mb-3">Up next</h2>
              <p className="text-[15px] font-medium">{next.course.name}</p>
              <p className="hint mt-1 mb-4">
                {next.enrollment.completedUnits.length} of{' '}
                {next.course.units.filter((u) => u.type !== 'section').length} units done
              </p>
              <Button onClick={() => navigate(`/my-courses/${next.course.id}`)}>Resume course</Button>
            </section>
          )}

          <section className="card card-pad">
            <h2 className="card-title mb-4">Scheduled sessions</h2>
            {sessions.length === 0 ? (
              <p className="hint">No classroom or clinical sessions scheduled.</p>
            ) : (
              <ul className="space-y-4">
                {sessions.slice(0, 4).map((s) => (
                  <li key={s.id} className="flex items-start gap-3">
                    <Icon name="calendar" className="w-[18px] h-[18px] text-brand-700 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-medium truncate">{s.name}</p>
                      <p className="hint">{s.start ? formatDateTime(s.start) : 'Date to be confirmed'}</p>
                      {s.location && <p className="text-[12.5px] text-ink-500 mt-0.5">{s.location}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {myCertificates.length > 0 && (
            <section className="card card-pad">
              <h2 className="card-title mb-4">Latest certificate</h2>
              <div className="flex items-center gap-3">
                <Icon name="certificate" className="w-7 h-7 text-gold-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium truncate">
                    {items.find((i) => i.course.id === myCertificates[0].courseId)?.course.name || 'Course'}
                  </p>
                  <p className="hint">{myCertificates[0].code}</p>
                </div>
                <Badge tone="green">Issued</Badge>
              </div>
              <Button variant="ghost" className="mt-4" onClick={() => navigate('/certificates')}>
                View certificates
              </Button>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function Tile({ icon, label, value }) {
  return (
    <div className="card card-interactive px-5 py-4">
      <span className="w-9 h-9 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center mb-3">
        <Icon name={icon} className="w-[18px] h-[18px]" strokeWidth={1.6} />
      </span>
      <p className="text-[22px] font-semibold leading-none">{value}</p>
      <p className="hint mt-1.5">{label}</p>
    </div>
  )
}
