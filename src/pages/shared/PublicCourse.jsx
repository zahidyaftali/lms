import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge, Icon } from '../../components/ui'
import Logo from '../../components/layout/Logo'
import CourseHero from '../../components/course/CourseHero'
import CourseOutline, { UnitPager } from '../../components/course/CourseOutline'
import IntroVideo, { hasIntroVideo } from '../../components/course/IntroVideo'
import UnitViewer from '../../components/course/UnitViewer'
import { unitLabel } from '../../components/course/unitTypes'
import { useData } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { isPubliclyShared } from '../../lib/courseAccess'

/** Guest progress is keyed by course and never leaves this browser. */
const GUEST_KEY = 'ga_lms_guest_progress_v1'

function readGuestProgress(courseId) {
  try {
    const all = JSON.parse(localStorage.getItem(GUEST_KEY) || '{}')
    return Array.isArray(all[courseId]) ? all[courseId] : []
  } catch {
    return []
  }
}

function writeGuestProgress(courseId, unitIds) {
  try {
    const all = JSON.parse(localStorage.getItem(GUEST_KEY) || '{}')
    localStorage.setItem(GUEST_KEY, JSON.stringify({ ...all, [courseId]: unitIds }))
  } catch {
    // Storage blocked (private window): progress simply lasts for this visit.
  }
}

/**
 * /share/:courseId — a course with "Public sharing" switched on, open to
 * anyone with the link and no account.
 */
export default function PublicCourse() {
  const { courseId } = useParams()
  const { courses } = useData()
  const { isAuthenticated } = useAuth()
  const toast = useToast()

  const course = courses.find((c) => c.id === courseId)
  const contentUnits = useMemo(() => (course?.units || []).filter((u) => u.type !== 'section'), [course])
  const [completed, setCompleted] = useState(() => readGuestProgress(courseId))
  const [activeId, setActiveId] = useState(
    () => (contentUnits.find((u) => !completed.includes(u.id)) || contentUnits[0])?.id,
  )

  const header = (
    <header className="h-16 bg-white border-b border-line flex items-center justify-between gap-4 px-4 sm:px-8">
      <Logo boxed={false} size="sm" />
      <Link to={isAuthenticated ? '/' : '/login'} className="btn-outline btn-sm">
        {isAuthenticated ? 'Go to portal' : 'Sign in'}
      </Link>
    </header>
  )

  if (!isPubliclyShared(course)) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        {header}
        <main className="px-4 py-16">
          <div className="card card-pad max-w-md mx-auto text-center">
            <Icon name="lock" className="w-8 h-8 mx-auto text-ink-400 mb-3" strokeWidth={1.4} />
            <h1 className="card-title">This course isn’t available</h1>
            <p className="hint mt-2">
              The link may have been switched off, or the course is no longer active. Sign in to see the courses
              assigned to you.
            </p>
          </div>
        </main>
      </div>
    )
  }

  const active = course.units.find((u) => u.id === activeId) || contentUnits[0]
  const activeIndex = contentUnits.findIndex((u) => u.id === active?.id)

  function complete() {
    if (!active || completed.includes(active.id)) return
    const next = [...completed, active.id]
    setCompleted(next)
    writeGuestProgress(course.id, next)
    const remaining = contentUnits.filter((u) => !next.includes(u.id))
    if (remaining.length === 0) {
      toast('Course completed — well done.')
    } else {
      toast('Unit completed.')
      setActiveId(remaining[0].id)
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      {header}
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 animate-fade-in">
        <CourseHero course={course} className="rounded-card mb-4" />

        <p className="mb-6 flex items-start gap-2.5 text-[13.5px] leading-5 text-ink-700 bg-white border border-line rounded-card px-4 py-3">
          <Icon name="info" className="w-[18px] h-[18px] shrink-0 text-brand-700" />
          <span>
            You are taking this course as a guest. Your progress is saved in this browser only — sign in with a
            portal account to keep it on your record.
          </span>
        </p>

        {hasIntroVideo(course.introVideo) && (
          <div className="card p-4 sm:p-5 mb-6">
            <IntroVideo video={course.introVideo} title={`${course.name} introduction`} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
          <CourseOutline course={course} completedUnits={completed} activeId={active?.id} onSelect={setActiveId} />

          <section className="card card-pad min-h-[420px]">
            {active ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-5 border-b border-line">
                  <div>
                    <p className="hint">
                      Unit {activeIndex + 1} of {contentUnits.length} · {unitLabel(active.type)}
                    </p>
                    <h2 className="text-[21px] font-semibold text-ink-900 mt-1">{active.name}</h2>
                  </div>
                  {completed.includes(active.id) && <Badge tone="green">Completed</Badge>}
                </div>

                <UnitViewer
                  key={active.id}
                  unit={active}
                  completed={completed.includes(active.id)}
                  onComplete={complete}
                  onSubmitTest={(outcome) => outcome.passed && complete()}
                  onSubmitAssignment={() => toast('Sign in to submit assignments — guests can read them only.')}
                />

                <UnitPager units={contentUnits} index={activeIndex} onSelect={setActiveId} />
              </>
            ) : (
              <p className="hint">This course has no content yet.</p>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
