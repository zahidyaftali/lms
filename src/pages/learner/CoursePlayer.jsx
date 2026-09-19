import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, Icon, Progress } from '../../components/ui'
import CourseHero from '../../components/course/CourseHero'
import UnitViewer from '../../components/course/UnitViewer'
import { unitIcon, unitLabel } from '../../components/course/unitTypes'
import { useData, useSelectors } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { putFile } from '../../lib/fileStore'
import { cx } from '../../lib/utils'

export default function CoursePlayer() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const { courses, submissions, actions } = useData()
  const { enrollment, progressOf } = useSelectors()
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

  const active = course.units.find((u) => u.id === activeId) || contentUnits[0]
  const progress = progressOf(record)
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
        <aside className="card">
          <div className="p-5 border-b border-line">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] text-ink-500">Your progress</span>
              <span className="text-[13px] font-semibold">{progress}%</span>
            </div>
            <Progress value={progress} tone={progress === 100 ? 'green' : 'brand'} />
            <p className="hint mt-2.5">
              {record.completedUnits.length} of {contentUnits.length} units completed
            </p>
          </div>

          <ul className="py-2 max-h-[560px] overflow-y-auto scroll-thin">
            {course.units.map((unit) => {
              if (unit.type === 'section') {
                return (
                  <li key={unit.id} className="px-5 pt-4 pb-2">
                    <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-500">
                      {unit.name}
                    </span>
                  </li>
                )
              }
              const done = record.completedUnits.includes(unit.id)
              return (
                <li key={unit.id}>
                  <button
                    onClick={() => setActiveId(unit.id)}
                    className={cx(
                      'w-full flex items-center gap-3 px-5 py-3 text-left transition',
                      unit.id === active?.id ? 'bg-brand-50' : 'hover:bg-gray-50',
                    )}
                  >
                    <span
                      className={cx(
                        'w-7 h-7 rounded-full flex items-center justify-center shrink-0',
                        done ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-ink-700',
                      )}
                    >
                      <Icon name={done ? 'check' : unitIcon(unit.type)} className="w-3.5 h-3.5" strokeWidth={2.2} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span
                        className={cx(
                          'block text-[13.5px] truncate',
                          unit.id === active?.id ? 'text-brand-700 font-medium' : 'text-ink-900',
                        )}
                      >
                        {unit.name}
                      </span>
                      <span className="block text-[11.5px] text-ink-500">{unitLabel(unit.type)}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

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

              <div className="flex justify-between gap-3 mt-8 pt-6 border-t border-line">
                <Button
                  variant="ghost"
                  icon="arrowLeft"
                  disabled={activeIndex <= 0}
                  onClick={() => setActiveId(contentUnits[activeIndex - 1].id)}
                >
                  Previous
                </Button>
                <Button
                  variant="ghost"
                  disabled={activeIndex >= contentUnits.length - 1}
                  onClick={() => setActiveId(contentUnits[activeIndex + 1].id)}
                >
                  Next unit
                  <Icon name="arrowRight" className="w-[18px] h-[18px]" />
                </Button>
              </div>
            </>
          ) : (
            <p className="hint">Your instructor has not added any content to this course yet.</p>
          )}
        </section>
      </div>
    </div>
  )
}
