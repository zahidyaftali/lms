import { useMemo, useState } from 'react'
import { Badge, Button, EmptyState, Icon, PageHeader, SearchInput, Select } from '../../components/ui'
import CourseHero from '../../components/course/CourseHero'
import { useData, useSelectors } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { money } from '../../lib/utils'

export default function Catalog() {
  const { courses, categories, users, enrollmentRequests, actions } = useData()
  const { enrollment } = useSelectors()
  const { user } = useAuth()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return courses.filter((c) => {
      if (c.status !== 'active') return false
      if (q && !c.name.toLowerCase().includes(q)) return false
      if (category && c.categoryId !== category) return false
      return true
    })
  }, [courses, query, category])

  const requestFor = (courseId) =>
    (enrollmentRequests || [])
      .filter((r) => r.userId === user.id && r.courseId === courseId)
      .sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt))[0] || null

  function request(course) {
    actions.requestEnrollment(user.id, course.id)
    const admin = users.find((u) => u.role === 'superadmin') || users.find((u) => u.role === 'admin')
    if (admin) {
      actions.messages.add({
        fromId: user.id,
        toId: admin.id,
        subject: `Enrollment request: ${course.name}`,
        body: `${user.firstName} ${user.lastName} would like to be enrolled in ${course.name}.`,
        sentAt: new Date().toISOString(),
        read: false,
      })
    }
    actions.logEvent('user', `requested enrollment in ${course.name}`, user.id)
    toast('Request sent — the program office will review it.')
  }

  return (
    <div>
      <PageHeader
        title="Course catalog"
        subtitle="Everything GA Healthcare Training currently offers. Enrollment is handled by the program office."
      />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <SearchInput value={query} onChange={setQuery} className="w-[250px]" />
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-[220px]">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <EmptyState icon="store" title="No courses found" message="Try a different search or category." />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 stagger">
          {rows.map((course) => {
            const enrolled = !!enrollment(user.id, course.id)
            const pending = requestFor(course.id)
            return (
              <article key={course.id} className="card card-interactive overflow-hidden flex flex-col">
                <CourseHero course={course} size="sm" tags={[course.level]} />
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="text-[15.5px] font-semibold leading-6 mb-2">{course.name}</h3>
                  <p className="hint line-clamp-3 mb-4">{course.description}</p>
                  <div className="mt-auto flex items-center justify-between gap-3">
                    <span className="text-[15px] font-semibold">
                      {course.price ? money(course.price) : 'Included'}
                    </span>
                    {enrolled ? (
                      <Badge tone="green">
                        <Icon name="check" className="w-3.5 h-3.5 mr-1" strokeWidth={3} />
                        Enrolled
                      </Badge>
                    ) : pending?.status === 'pending' ? (
                      <Badge tone="amber">
                        <Icon name="clock" className="w-3.5 h-3.5 mr-1" />
                        Awaiting approval
                      </Badge>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => request(course)}>
                        {pending?.status === 'declined' ? 'Request again' : 'Request enrollment'}
                      </Button>
                    )}
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
