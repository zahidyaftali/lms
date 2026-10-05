import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Icon, Progress } from '../../components/ui'
import { useData, useSelectors } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { allStats, scoreOf } from '../../lib/gamification.js'
import { pathProgress } from '../../lib/rules.js'
import { duration, formatDateTime } from '../../lib/utils'
import { useT } from '../../lib/i18n'

export default function LearnerHome() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const data = useData()
  const { certificates, learningPaths = [], settings } = data
  const { coursesOfLearner, progressOf } = useSelectors()
  const t = useT()

  const items = coursesOfLearner(user.id)
  const inProgress = items.filter((i) => i.enrollment.status !== 'completed')
  const completed = items.filter((i) => i.enrollment.status === 'completed')
  const minutes = items.reduce((sum, i) => sum + (i.enrollment.timeSpentMin || 0), 0)
  const myCertificates = certificates.filter((c) => c.userId === user.id).sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : -1))
  const showBar = settings.courses?.showProgressBar !== false
  const g = settings.gamification
  const score = useMemo(() => (g?.enabled ? scoreOf(allStats(data).get(user.id), g) : null), [data, g, user.id])
  const paths = learningPaths.filter((p) => p.status === 'active' && (p.userIds || []).includes(user.id))

  const sessions = items
    .flatMap((i) =>
      i.course.units
        .filter((u) => u.type === 'ilt')
        .flatMap((u) => (u.data?.sessions || []).map((s) => ({ ...s, course: i.course.name, courseId: i.course.id }))),
    )
    .filter((s) => !s.start || new Date(s.end || s.start).getTime() > Date.now() - 3600000)
    .sort((a, b) => new Date(a.start || 8.64e15) - new Date(b.start || 8.64e15))

  const next = inProgress[0]

  return (
    <div>
      <h1 className="page-title mb-1">
        {t('Welcome back')}, {user.firstName}!
      </h1>
      <p className="hint mb-7">{t('Pick up where you left off, or review what you have already completed.')}</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 stagger">
        <Tile icon="book" label={t('Courses in progress')} value={inProgress.length} />
        <Tile icon="checkCircle" label={t('Completed')} value={completed.length} />
        <Tile icon="clock" label={t('Training time')} value={duration(minutes)} />
        <Tile icon="certificate" label={t('Certificates')} value={myCertificates.length} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-6 items-start">
        <section className="card card-pad">
          <div className="flex items-center justify-between gap-4 mb-5">
            <h2 className="card-title">{t('Continue learning')}</h2>
            <button onClick={() => navigate('/my-courses')} className="link text-[13.5px]">
              {t('View all')}
            </button>
          </div>

          {items.length === 0 ? (
            <p className="hint">{t('You have no courses yet. Your program office will assign them to your account.')}</p>
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
                          {course.units.filter((u) => u.type !== 'section').length} {t('units')}
                          {course.code ? ` · ${course.code}` : ''}
                        </p>
                        {showBar && (
                          <div className="flex items-center gap-3 mt-3">
                            <Progress value={value} className="flex-1" tone={value === 100 ? 'green' : 'brand'} />
                            <span className="text-[12.5px] text-ink-700 w-9">{value}%</span>
                          </div>
                        )}
                      </div>
                      <Button size="sm" onClick={() => navigate(`/my-courses/${course.id}`)}>
                        {enrollment.status === 'not_started' ? t('Start') : enrollment.status === 'completed' ? t('Review') : t('Continue')}
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          {score && (
            <section className="card card-pad">
              <div className="flex items-center justify-between gap-4 mb-4">
                <h2 className="card-title">{t('Achievements')}</h2>
                <button onClick={() => navigate('/achievements')} className="link text-[13.5px]">
                  {t('View all')}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                {g.points.enabled && <Stat value={score.points.toLocaleString('en-US')} label={t('Points')} />}
                {g.levels.enabled && <Stat value={score.level} label={t('Level')} />}
                {g.badges.enabled && <Stat value={score.badges.length} label={t('Badges')} />}
              </div>
            </section>
          )}

          {paths.length > 0 && (
            <section className="card card-pad">
              <div className="flex items-center justify-between gap-4 mb-4">
                <h2 className="card-title">{t('Learning paths')}</h2>
                <button onClick={() => navigate('/my-paths')} className="link text-[13.5px]">
                  {t('View all')}
                </button>
              </div>
              <ul className="space-y-4">
                {paths.slice(0, 3).map((path) => {
                  const p = pathProgress(path, user.id, data)
                  return (
                    <li key={path.id}>
                      <div className="flex justify-between gap-3 text-[13.5px] mb-1.5">
                        <span className="truncate">{path.name}</span>
                        <span className="text-ink-500 whitespace-nowrap">
                          {p.done} / {p.total}
                        </span>
                      </div>
                      <Progress value={p.total ? (p.done / p.total) * 100 : 0} tone={p.completed ? 'green' : 'brand'} />
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {next && (
            <section className="card card-pad">
              <h2 className="card-title mb-3">{t('Up next')}</h2>
              <p className="text-[15px] font-medium">{next.course.name}</p>
              <p className="hint mt-1 mb-4">
                {next.enrollment.completedUnits.length} / {next.course.units.filter((u) => u.type !== 'section').length} {t('units done')}
              </p>
              <Button onClick={() => navigate(`/my-courses/${next.course.id}`)}>{t('Resume course')}</Button>
            </section>
          )}

          <section className="card card-pad">
            <h2 className="card-title mb-4">{t('Scheduled sessions')}</h2>
            {sessions.length === 0 ? (
              <p className="hint">{t('No classroom or clinical sessions scheduled.')}</p>
            ) : (
              <ul className="space-y-4">
                {sessions.slice(0, 4).map((s) => (
                  <li key={s.id} className="flex items-start gap-3">
                    <Icon name="calendar" className="w-[18px] h-[18px] text-brand-700 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-medium truncate">{s.name || s.course}</p>
                      <p className="hint">{s.start ? formatDateTime(s.start) : t('Date to be confirmed')}</p>
                      {s.location && <p className="text-[12.5px] text-ink-500 mt-0.5">{s.location}</p>}
                      {(s.meetingUrl || s.meetingId) && (
                        <button className="link text-[12.5px] mt-0.5" onClick={() => navigate(`/my-courses/${s.courseId}`)}>
                          {t('Online session — open the course to join')}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {myCertificates.length > 0 && (
            <section className="card card-pad">
              <h2 className="card-title mb-4">{t('Latest certificate')}</h2>
              <div className="flex items-center gap-3">
                <Icon name="certificate" className="w-7 h-7 text-gold-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium truncate">
                    {items.find((i) => i.course.id === myCertificates[0].courseId)?.course.name ||
                      learningPaths.find((p) => p.id === myCertificates[0].pathId)?.name ||
                      t('Course')}
                  </p>
                  <p className="hint">{myCertificates[0].code}</p>
                </div>
                <Badge tone="green">{t('Issued')}</Badge>
              </div>
              <Button variant="ghost" className="mt-4" onClick={() => navigate('/certificates')}>
                {t('View certificates')}
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

function Stat({ value, label }) {
  return (
    <div className="border border-line rounded-md py-3">
      <p className="text-[19px] font-bold leading-none">{value}</p>
      <p className="hint mt-1">{label}</p>
    </div>
  )
}
