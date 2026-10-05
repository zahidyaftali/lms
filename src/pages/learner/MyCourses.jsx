import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, EmptyState, Icon, PageHeader, Progress, SearchInput, Tabs } from '../../components/ui'
import CourseHero from '../../components/course/CourseHero'
import { useData, useSelectors } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { accessWindow } from '../../lib/courseAccess'
import { statusLabel, statusTone } from '../../lib/rules.js'
import { formatDate, formatDay } from '../../lib/utils'
import { useT } from '../../lib/i18n'

export default function MyCourses() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { coursesOfLearner, progressOf } = useSelectors()
  const { settings } = useData()
  const t = useT()
  const showBar = settings.courses?.showProgressBar !== false
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')

  const items = coursesOfLearner(user.id)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter(({ course, enrollment }) => {
      if (q && !course.name.toLowerCase().includes(q)) return false
      if (tab === 'progress' && enrollment.status !== 'in_progress' && enrollment.status !== 'failed') return false
      if (tab === 'completed' && enrollment.status !== 'completed') return false
      if (tab === 'notstarted' && enrollment.status !== 'not_started') return false
      return true
    })
  }, [items, tab, query])

  return (
    <div>
      <PageHeader title={t('My courses')} subtitle={t('Courses assigned to you by GA Healthcare Training.')} />

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <Tabs
          tabs={[
            { value: 'all', label: t('All'), count: items.length },
            { value: 'progress', label: t('In progress'), count: items.filter((i) => i.enrollment.status === 'in_progress' || i.enrollment.status === 'failed').length },
            { value: 'notstarted', label: t('Not started'), count: items.filter((i) => i.enrollment.status === 'not_started').length },
            { value: 'completed', label: t('Completed'), count: items.filter((i) => i.enrollment.status === 'completed').length },
          ]}
          active={tab}
          onChange={setTab}
          className="border-b-0"
        />
        <SearchInput value={query} onChange={setQuery} className="w-[250px]" />
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="book"
            title={t('No courses here yet')}
            message={t('When your program office assigns a course, it will appear on this page.')}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 lg:gap-6 stagger">
          {filtered.map(({ course, enrollment }) => {
            const value = progressOf(enrollment)
            const access = accessWindow(course, enrollment)
            return (
              <article key={course.id} className="card card-interactive overflow-hidden flex flex-col">
                <CourseHero course={course} size="sm" tags={[course.level]} />
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-start gap-3 mb-2">
                    <h3 className="text-[15.5px] font-semibold leading-6 flex-1">{course.name}</h3>
                    <Badge tone={statusTone(enrollment.status)}>{t(statusLabel(enrollment.status))}</Badge>
                  </div>
                  <p className="hint line-clamp-2 mb-4">{course.description}</p>

                  <div className="mt-auto">
                    {showBar && (
                      <div className="flex items-center gap-3 mb-4">
                        <Progress value={value} className="flex-1" tone={value === 100 ? 'green' : 'brand'} />
                        <span className="text-[12.5px] text-ink-700 w-9">{value}%</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-3">
                      {access.state === 'open' ? (
                        <span className="hint flex items-center gap-1.5">
                          <Icon name={access.ends ? 'clock' : 'calendar'} className="w-4 h-4" />
                          {access.ends
                            ? `${t('Access until')} ${formatDay(access.ends)}`
                            : `${t('Enrolled')} ${formatDate(enrollment.enrolledAt)}`}
                        </span>
                      ) : (
                        <span className="hint flex items-center gap-1.5">
                          <Icon name="lock" className="w-4 h-4" />
                          {access.state === 'upcoming'
                            ? `${t('Opens')} ${formatDay(access.starts)}`
                            : `${t('Access ended')} ${formatDay(access.ends)}`}
                        </span>
                      )}
                      <Button
                        size="sm"
                        disabled={access.state !== 'open'}
                        onClick={() => navigate(`/my-courses/${course.id}`)}
                      >
                        {t(
                          access.state === 'upcoming'
                            ? 'Not open yet'
                            : access.state === 'expired'
                              ? 'Expired'
                              : enrollment.status === 'not_started'
                                ? 'Start'
                                : enrollment.status === 'completed'
                                  ? 'Review'
                                  : 'Continue',
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
