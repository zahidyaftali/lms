import { useNavigate } from 'react-router-dom'
import { Badge, Button, EmptyState, Icon, PageHeader, Progress } from '../../components/ui'
import { useData } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { pathProgress } from '../../lib/rules.js'
import { cx, formatDate, plural } from '../../lib/utils'
import { useT } from '../../lib/i18n'

/** The learning paths a learner is on: each course in order, what is open and what comes next. */
export default function MyPaths() {
  const data = useData()
  const { learningPaths = [], certificates, settings } = data
  const { user } = useAuth()
  const navigate = useNavigate()
  const t = useT()

  const mine = learningPaths.filter((p) => p.status === 'active' && (p.userIds || []).includes(user.id))
  const showBar = settings.courses?.showProgressBar !== false

  return (
    <div>
      <PageHeader title={t('Learning paths')} subtitle={t('Courses lined up for you, step by step.')} />

      {mine.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="route"
            title={t('You are not on a learning path yet')}
            message={t('When the program office adds you to a path, or you join one from the catalog, it appears here.')}
            action={<Button onClick={() => navigate('/catalog')}>{t('Course catalog')}</Button>}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {mine.map((path) => {
            const p = pathProgress(path, user.id, data)
            const certificate = certificates.find((c) => c.userId === user.id && c.pathId === path.id)
            const percent = p.total ? Math.round((p.done / p.total) * 100) : 0
            return (
              <section key={path.id} className="card">
                <div className="p-6 border-b border-line">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="flex-1 min-w-[220px]">
                      <h2 className="text-[18px] font-bold leading-6">{path.name}</h2>
                      {path.description && <p className="hint mt-1.5 max-w-2xl whitespace-pre-line">{path.description}</p>}
                    </div>
                    {p.completed ? (
                      <Badge tone="green">{t('Completed')}</Badge>
                    ) : p.expired ? (
                      <Badge tone="red">{t('Time limit passed')}</Badge>
                    ) : (
                      p.expiresAt && <Badge tone="amber">{`${t('Finish by')} ${formatDate(p.expiresAt)}`}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-4">
                    {showBar && <Progress value={percent} className="flex-1 max-w-md" tone={p.completed ? 'green' : 'brand'} />}
                    <span className="text-[13px] text-ink-700">
                      {p.done} / {plural(p.total, 'course')}
                      {path.completionRule === 'Only the last course must be completed' ? ` · ${t('the last course completes the path')}` : ''}
                    </span>
                  </div>
                  {certificate && (
                    <p className="mt-3 text-[13.5px] text-emerald-700 flex items-center gap-2">
                      <Icon name="certificate" className="w-[18px] h-[18px]" />
                      {t('Certificate issued')} · {certificate.code}
                    </p>
                  )}
                </div>

                <ol className="divide-y divide-line">
                  {p.steps.map((step, index) => (
                    <li key={step.courseId} className="px-6 py-4 flex flex-wrap items-center gap-4">
                      <span
                        className={cx(
                          'w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold shrink-0',
                          step.state === 'completed' ? 'bg-emerald-500 text-white' : step.state === 'locked' ? 'bg-gray-100 text-ink-400' : 'bg-brand-50 text-brand-700',
                        )}
                      >
                        {step.state === 'completed' ? <Icon name="check" className="w-4 h-4" strokeWidth={2.6} /> : step.state === 'locked' ? <Icon name="lock" className="w-4 h-4" /> : index + 1}
                      </span>
                      <span className="flex-1 min-w-[180px]">
                        <span className={cx('block text-[14.5px]', step.state === 'locked' && 'text-ink-500')}>{step.course.name}</span>
                        <span className="block hint">
                          {step.state === 'completed'
                            ? `${t('Completed')} ${formatDate(step.enrollment.completedAt)}`
                            : step.state === 'locked'
                              ? t('Opens when the course before it is completed')
                              : step.enrollment
                                ? step.enrollment.status === 'not_started'
                                  ? t('Ready to start')
                                  : t('In progress')
                                : t('Waiting for enrollment')}
                        </span>
                      </span>
                      {step.enrollment && step.state !== 'locked' && (
                        <Button size="sm" variant={step.state === 'completed' ? 'ghost' : 'primary'} onClick={() => navigate(`/my-courses/${step.courseId}`)}>
                          {step.state === 'completed' ? t('Review') : step.enrollment.status === 'not_started' ? t('Start') : t('Continue')}
                        </Button>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
