import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, Icon } from '../../components/ui'
import CourseHero from '../../components/course/CourseHero'
import UnitViewer from '../../components/course/UnitViewer'
import CourseOutline, { UnitPager } from '../../components/course/CourseOutline'
import { unitLabel } from '../../components/course/unitTypes'
import { useData, useSelectors } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { putFile } from '../../lib/fileStore'
import { accessWindow } from '../../lib/courseAccess'
import { formatDate } from '../../lib/utils'

export default function CoursePlayer() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const { courses, submissions, actions } = useData()
  const { enrollment } = useSelectors()
  const { user } = useAuth()
  const toast = useToast()

  const course = courses.find((c) => c.id === courseId)
  const record = enrollment(user.id, courseId)
  const contentUnits = useMemo(() => (course?.units || []).filter((u) => u.type !== 'section'), [course])
  const [activeId, setActiveId] = useState(() => {
    const next = contentUnits.find((u) => !record?.completedUnits.includes(u.id))
    return (next || contentUnits[0])?.id
  })

  if (!course || !record) {
    return (
      <div className="card card-pad">
        <p className="text-[14px]">You are not enrolled in this course.</p>
        <Button className="mt-4" variant="ghost" icon="arrowLeft" onClick={() => navigate('/my-courses')}>
          Back to my courses
        </Button>
      </div>
    )
  }

  const access = accessWindow(course, record)
  if (access.state !== 'open') {
    return (
      <div className="card card-pad max-w-xl">
        <span className="w-11 h-11 rounded-full bg-gray-100 text-ink-700 flex items-center justify-center mb-4">
          <Icon name="lock" className="w-5 h-5" />
        </span>
        <h2 className="card-title">{course.name}</h2>
        <p className="text-[14px] text-ink-700 mt-2">
          {access.state === 'upcoming'
            ? `This course opens on ${formatDate(access.starts)}. Come back then to start.`
            : `Your access to this course ended on ${formatDate(access.ends)}. Contact the program office if you need more time.`}
        </p>
        <Button className="mt-5" variant="ghost" icon="arrowLeft" onClick={() => navigate('/my-courses')}>
          Back to my courses
        </Button>
      </div>
    )
  }

  const active = course.units.find((u) => u.id === activeId) || contentUnits[0]
  const activeIndex = contentUnits.findIndex((u) => u.id === active?.id)
  const submission = submissions.find(
    (s) => s.userId === user.id && s.unitId === active?.id && s.courseId === course.id,
  )

  const complete = (extra = {}) => {
    if (!active) return
    const wasComplete = record.completedUnits.includes(active.id)
    actions.completeUnit(user.id, course.id, active.id, extra)
    if (!wasComplete) {
      actions.logEvent('progress', `completed unit ${active.name}`, user.id)
      const remaining = contentUnits.filter(
        (u) => u.id !== active.id && !record.completedUnits.includes(u.id),
      )
      if (remaining.length === 0) {
        actions.logEvent('completion', `completed course ${course.name}`, user.id)
        toast(`Course completed — your certificate is ready.`)
      } else {
        toast('Unit completed.')
        setActiveId(remaining[0].id)
      }
    }
  }

  return (
    <div>
      <button onClick={() => navigate('/my-courses')} className="link text-[13.5px] inline-flex items-center gap-1.5 mb-4">
        <Icon name="arrowLeft" className="w-4 h-4" />
        My courses
      </button>

      <CourseHero course={course} className="rounded-card mb-6" />

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
        <CourseOutline
          course={course}
          completedUnits={record.completedUnits}
          activeId={active?.id}
          onSelect={setActiveId}
        />

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
                {record.completedUnits.includes(active.id) && <Badge tone="green">Completed</Badge>}
              </div>

              <UnitViewer
                unit={active}
                completed={record.completedUnits.includes(active.id)}
                submission={submission}
                onComplete={() => complete()}
                onSubmitTest={(outcome) => {
                  if (outcome.openAnswers?.length) {
                    actions.submissions.add({
                      type: 'test',
                      courseId: course.id,
                      unitId: active.id,
                      userId: user.id,
                      submittedAt: new Date().toISOString(),
                      text: outcome.openAnswers.map((a) => `${a.question}\n${a.answer}`).join('\n\n'),
                      status: 'pending',
                      grade: null,
                      feedback: '',
                      autoScore: outcome.score,
                    })
                  }
                  if (outcome.passed) complete({ score: outcome.score, minutes: 10 })
                }}
                onSubmitAssignment={async ({ text, file }) => {
                  let stored = null
                  if (file) stored = await putFile(file)
                  actions.submissions.add({
                    type: 'assignment',
                    courseId: course.id,
                    unitId: active.id,
                    userId: user.id,
                    submittedAt: new Date().toISOString(),
                    text,
                    fileId: stored?.id || null,
                    fileName: stored?.name || '',
                    status: 'pending',
                    grade: null,
                    feedback: '',
                  })
                  complete({ minutes: 15 })
                  toast('Assignment submitted for review.')
                }}
              />

              <UnitPager units={contentUnits} index={activeIndex} onSelect={setActiveId} />
            </>
          ) : (
            <p className="hint">Your instructor has not added any content to this course yet.</p>
          )}
        </section>
      </div>
    </div>
  )
}
