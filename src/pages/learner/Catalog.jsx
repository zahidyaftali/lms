import { useState } from 'react'
import { Badge, Button, EmptyState, Icon, Modal, PageHeader, SearchInput, Select } from '../../components/ui'
import CourseHero from '../../components/course/CourseHero'
import IntroVideo, { hasIntroVideo } from '../../components/course/IntroVideo'
import { useData, useSelectors } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { canSelfEnroll, isCourseFull, timeframeEnded } from '../../lib/courseAccess'
import { formatDate, money } from '../../lib/utils'

export default function Catalog() {
  const { courses, categories, users, enrollmentRequests, settings, actions } = useData()
  const { enrollment, enrollmentsIn } = useSelectors()
  const { user } = useAuth()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [preview, setPreview] = useState(null)

  const requestFor = (courseId) =>
    (enrollmentRequests || [])
      .filter((r) => r.userId === user.id && r.courseId === courseId)
      .sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt))[0] || null

  /**
   * Hidden courses never show. A full course, or one whose timeframe has
   * ended, stays visible only to learners already enrolled or waiting on a request.
   */
  const q = query.trim().toLowerCase()
  const rows = courses.filter((c) => {
    if (c.status !== 'active' || c.showInCatalog === false) return false
    if (q && !c.name.toLowerCase().includes(q)) return false
    if (category && c.categoryId !== category) return false
    const involved = !!enrollment(user.id, c.id) || requestFor(c.id)?.status === 'pending'
    if (!involved && (isCourseFull(c, enrollmentsIn(c.id).length) || timeframeEnded(c))) return false
    return true
  })

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

  function enrollNow(course) {
    actions.enroll([user.id], [course.id])
    actions.logEvent('user', `enrolled in ${course.name}`, user.id)
    toast('You are enrolled — the course is now in My courses.')
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
              <article key={course.id} className="card card-interactive overflow-hidden flex flex-col relative">
                <CourseHero course={course} size="sm" tags={[course.level]} />
                {hasIntroVideo(course.introVideo) && (
                  <button
                    onClick={() => setPreview(course)}
                    aria-label={`Watch the introduction to ${course.name}`}
                    title="Watch intro video"
                    className="absolute top-3.5 right-3.5 w-10 h-10 rounded-full bg-white/15 text-white border border-white/25 flex items-center justify-center hover:bg-white/25 transition"
                  >
                    <Icon name="play" className="w-4 h-4 ml-0.5" fill="currentColor" />
                  </button>
                )}
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="text-[15.5px] font-semibold leading-6 mb-2">{course.name}</h3>
                  <p className="hint line-clamp-3 mb-4">{course.description}</p>
                  {course.timeMode === 'timeframe' && (course.startDate || course.endDate) && (
                    <p className="hint -mt-2 mb-4 flex items-center gap-1.5">
                      <Icon name="calendar" className="w-4 h-4 shrink-0" />
                      {runsLabel(course)}
                    </p>
                  )}
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
                    ) : canSelfEnroll(course, settings) ? (
                      <Button size="sm" onClick={() => enrollNow(course)}>
                        Enroll
                      </Button>
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

      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.name} width="max-w-3xl">
        {preview && <IntroVideo video={preview.introVideo} title={`${preview.name} introduction`} />}
      </Modal>
    </div>
  )
}

function runsLabel(course) {
  const from = course.startDate ? formatDate(`${course.startDate}T00:00`) : null
  const to = course.endDate ? formatDate(`${course.endDate}T00:00`) : null
  if (from && to) return `Runs ${from} – ${to}`
  return from ? `Opens ${from}` : `Open until ${to}`
}
