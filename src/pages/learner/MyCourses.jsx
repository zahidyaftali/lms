import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, EmptyState, Icon, PageHeader, Progress, SearchInput, Tabs } from '../../components/ui'
import CourseHero from '../../components/course/CourseHero'
import { useSelectors } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { formatDate } from '../../lib/utils'

export default function MyCourses() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { coursesOfLearner, progressOf } = useSelectors()
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')

  const items = coursesOfLearner(user.id)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter(({ course, enrollment }) => {
      if (q && !course.name.toLowerCase().includes(q)) return false
      if (tab === 'progress' && enrollment.status !== 'in_progress') return false
      if (tab === 'completed' && enrollment.status !== 'completed') return false
      if (tab === 'notstarted' && enrollment.status !== 'not_started') return false
      return true
    })
  }, [items, tab, query])

  return (
    <div>
      <PageHeader title="My courses" subtitle="Courses assigned to you by GA Healthcare Training." />

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <Tabs
          tabs={[
            { value: 'all', label: 'All', count: items.length },
            { value: 'progress', label: 'In progress', count: items.filter((i) => i.enrollment.status === 'in_progress').length },
            { value: 'notstarted', label: 'Not started', count: items.filter((i) => i.enrollment.status === 'not_started').length },
            { value: 'completed', label: 'Completed', count: items.filter((i) => i.enrollment.status === 'completed').length },
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
            title="No courses here yet"
            message="When your program office assigns a course, it will appear on this page."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 lg:gap-6 stagger">
          {filtered.map(({ course, enrollment }) => {
            const value = progressOf(enrollment)
            return (
              <article key={course.id} className="card card-interactive overflow-hidden flex flex-col">
                <CourseHero course={course} size="sm" tags={[course.level]} />
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-start gap-3 mb-2">
                    <h3 className="text-[15.5px] font-semibold leading-6 flex-1">{course.name}</h3>
                    <Badge tone={enrollment.status === 'completed' ? 'green' : enrollment.status === 'in_progress' ? 'blue' : 'gray'}>
                      {enrollment.status === 'completed' ? 'Completed' : enrollment.status === 'in_progress' ? 'In progress' : 'Not started'}
                    </Badge>
                  </div>
                  <p className="hint line-clamp-2 mb-4">{course.description}</p>

                  <div className="mt-auto">
                    <div className="flex items-center gap-3 mb-4">
                      <Progress value={value} className="flex-1" tone={value === 100 ? 'green' : 'brand'} />
                      <span className="text-[12.5px] text-ink-700 w-9">{value}%</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="hint flex items-center gap-1.5">
                        <Icon name="calendar" className="w-4 h-4" />
                        Enrolled {formatDate(enrollment.enrolledAt)}
                      </span>
                      <Button size="sm" onClick={() => navigate(`/my-courses/${course.id}`)}>
                        {value === 0 ? 'Start' : value === 100 ? 'Review' : 'Continue'}
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
