import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, Icon, Tabs, Textarea } from '../../components/ui'
import CourseHero from '../../components/course/CourseHero'
import UnitViewer from '../../components/course/UnitViewer'
import CourseOutline, { UnitPager } from '../../components/course/CourseOutline'
import Discussion from '../../components/course/Discussion'
import IntroVideo, { hasIntroVideo } from '../../components/course/IntroVideo'
import { Stars } from '../../components/course/CatalogCourse'
import { customFieldText } from '../../components/users/CustomFieldInputs'
import { unitIcon, unitLabel } from '../../components/course/unitTypes'
import { useData, useSelectors } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { putFile } from '../../lib/fileStore'
import { accessWindow, resolveUnit } from '../../lib/courseAccess'
import {
  assignmentCompletesOn,
  courseIsComplete,
  prerequisitesMet,
  sequentialUnits,
  sessionSeats,
  testAttemptsLeft,
  unitLocked,
  contentUnits as unitsOf,
} from '../../lib/rules.js'
import { formatDay, fullName, plainText } from '../../lib/utils'
import { useT } from '../../lib/i18n'

const newestFirst = (a, b) => ((a.at || a.submittedAt) < (b.at || b.submittedAt) ? 1 : -1)

export default function CoursePlayer() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const data = useData()
  const { courses, submissions, users, ratings = [], settings, backend, actions, enrollments } = data
  const attempts = data.attempts || []
  const registrations = data.registrations || []
  const { enrollment } = useSelectors()
  const { user } = useAuth()
  const toast = useToast()
  const t = useT()

  const raw = courses.find((c) => c.id === courseId)
  // Units linked from another course show that course's current content.
  const course = useMemo(() => (raw ? { ...raw, units: raw.units.map((u) => resolveUnit(u, courses)) } : null), [raw, courses])
  const record = enrollment(user.id, courseId)
  const contentUnits = useMemo(() => unitsOf(course), [course])
  const sequential = sequentialUnits(course, settings)
  const options = settings.courses || {}
  const [activeId, setActiveId] = useState(() => {
    const next = contentUnits.find((u) => !record?.completedUnits.includes(u.id))
    return (next || contentUnits[0])?.id
  })
  // The summary page comes first for a course that has not been started.
  const [tab, setTab] = useState(() => (options.showSummary && record?.status === 'not_started' ? 'about' : 'course'))

  // Seats taken in each session. A learner on the shared database only sees their own
  // registrations, so the server sends the seats everyone else holds and their own are added here.
  const sessionCounts = useMemo(() => {
    const counts = { ...(data.sessionCounts || {}) }
    registrations.forEach((r) => (counts[r.sessionId] = (counts[r.sessionId] || 0) + 1))
    return counts
  }, [data.sessionCounts, registrations])

  if (!course || !record) {
    return (
      <div className="card card-pad">
        <p className="text-[14px]">{t('You are not enrolled in this course.')}</p>
        <Button className="mt-4" variant="ghost" icon="arrowLeft" onClick={() => navigate('/my-courses')}>
          {t('Back to my courses')}
        </Button>
      </div>
    )
  }

  const access = accessWindow(course, record)
  const prerequisites = prerequisitesMet(course, user.id, enrollments)
  if (access.state !== 'open' || !prerequisites.met) {
    return (
      <div className="card card-pad max-w-xl">
        <span className="w-11 h-11 rounded-full bg-gray-100 text-ink-700 flex items-center justify-center mb-4">
          <Icon name="lock" className="w-5 h-5" />
        </span>
        <h2 className="card-title">{course.name}</h2>
        {!prerequisites.met ? (
          <>
            <p className="text-[14px] text-ink-700 mt-2">{t('Complete these courses first:')}</p>
            <ul className="mt-3 space-y-2">
              {prerequisites.missing.map((id) => {
                const c = courses.find((x) => x.id === id)
                const mine = enrollment(user.id, id)
                return (
                  <li key={id} className="flex items-center gap-3 border border-line rounded-md px-4 py-2.5">
                    <Icon name="book" className="w-[18px] h-[18px] text-brand-700" />
                    <span className="flex-1 text-[14px]">{c?.name || 'A removed course'}</span>
                    {mine ? (
                      <button className="link text-[13px]" onClick={() => navigate(`/my-courses/${id}`)}>
                        {t('Open')}
                      </button>
                    ) : (
                      <button className="link text-[13px]" onClick={() => navigate('/catalog')}>
                        {t('Find in catalog')}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </>
        ) : (
          <p className="text-[14px] text-ink-700 mt-2">
            {access.state === 'upcoming'
              ? `This course opens on ${formatDay(access.starts)}. Come back then to start.`
              : `Your access to this course ended on ${formatDay(access.ends)}. Contact the program office if you need more time.`}
          </p>
        )}
        <Button className="mt-5" variant="ghost" icon="arrowLeft" onClick={() => navigate('/my-courses')}>
          {t('Back to my courses')}
        </Button>
      </div>
    )
  }

  const done = record.completedUnits
  const lockedIds = contentUnits.filter((u) => unitLocked(course, done, u.id, sequential)).map((u) => u.id)
  const wanted = course.units.find((u) => u.id === activeId) || contentUnits[0]
  // A locked unit falls back to the first one still open.
  const active = wanted && lockedIds.includes(wanted.id) ? contentUnits.find((u) => !lockedIds.includes(u.id) && !done.includes(u.id)) || contentUnits[0] : wanted
  const activeIndex = contentUnits.findIndex((u) => u.id === active?.id)
  const mineHere = (list) => list.filter((x) => x.userId === user.id && x.courseId === course.id && x.unitId === active?.id).sort(newestFirst)
  const unitSubmissions = mineHere(submissions.filter((s) => s.type !== 'test'))
  const unitAttempts = mineHere(attempts)
  const completed = record.status === 'completed'
  const byInstructor = course.completionRule === 'Instructor marks the course complete'
  const myRating = ratings.find((r) => r.courseId === course.id && r.userId === user.id)
  const instructors = users.filter((u) => (course.instructorIds || []).includes(u.id))
  const at = () => new Date().toISOString()

  const complete = (extra = {}) => {
    if (!active) return
    const wasComplete = done.includes(active.id)
    actions.completeUnit(user.id, course.id, active.id, extra)
    if (wasComplete) return
    actions.logEvent('progress', `completed unit ${active.name}`, user.id)
    const after = [...done, active.id]
    const remaining = contentUnits.filter((u) => !after.includes(u.id))
    if (courseIsComplete(course, after, record)) {
      actions.logEvent('completion', `completed course ${course.name}`, user.id)
      toast(course.certificate && options.certificateEnabled !== false ? t('Course completed — your certificate is ready.') : t('Course completed.'))
    } else {
      toast(remaining.length === 0 && byInstructor ? t('All units done. Your instructor will mark the course complete.') : t('Unit completed.'))
      // Units whose result is worth reading stay on screen.
      if (remaining.length && !['test', 'survey', 'scorm'].includes(active.type)) setActiveId(remaining[0].id)
    }
  }

  async function joinSession(session) {
    if (session.meetingProvider === 'bbb' && backend.mode === 'server') {
      const res = await actions.rpc('meeting.join', { courseId: course.id, unitId: active.id, sessionId: session.id }, { refresh: false })
      if (!res.ok) return toast(res.error, 'error')
      window.open(res.url, '_blank', 'noopener')
    } else if (session.meetingUrl) window.open(session.meetingUrl, '_blank', 'noopener')
  }

  function submitTest(outcome) {
    const attempt = {
      id: outcome.id,
      kind: 'test',
      userId: user.id,
      courseId: course.id,
      unitId: active.id,
      answers: outcome.answers,
      questionIds: outcome.questionIds,
      score: outcome.score,
      passed: outcome.passed,
      pending: outcome.pending,
      seconds: outcome.seconds,
      at: at(),
    }
    actions.attempts.add(attempt)
    const minutes = Math.max(1, Math.round(outcome.seconds / 60))
    if (outcome.pending) {
      // Written answers go to the instructor; the attempt counts and the unit waits for the grade.
      actions.submissions.add({
        type: 'test',
        attemptId: attempt.id,
        courseId: course.id,
        unitId: active.id,
        userId: user.id,
        submittedAt: at(),
        text: outcome.openAnswers.map((a) => `${a.question}\n${a.answer}`).join('\n\n'),
        status: 'pending',
        grade: null,
        feedback: '',
        autoScore: outcome.score,
      })
      actions.pendTest(user.id, course.id, active.id)
      actions.logEvent('progress', `handed in ${active.name} for grading`, user.id)
    } else if (outcome.passed) complete({ score: outcome.score, minutes, attempt: true })
    else {
      actions.failTest(user.id, course.id, active.id)
      actions.logEvent('progress', `did not pass ${active.name} (${outcome.score}%)`, user.id)
    }
  }

  async function submitAssignment({ text, file, late }) {
    let stored = null
    if (file) {
      try {
        stored = await putFile(file, 'submission')
      } catch (err) {
        toast(err.message, 'error')
        return false
      }
    }
    actions.submissions.add({
      type: 'assignment',
      courseId: course.id,
      unitId: active.id,
      userId: user.id,
      submittedAt: at(),
      text,
      fileId: stored?.id || null,
      fileName: stored?.name || '',
      late: !!late,
      status: 'pending',
      grade: null,
      feedback: '',
    })
    if (assignmentCompletesOn(active) === 'submit') complete({ minutes: 15 })
    toast(assignmentCompletesOn(active) === 'submit' ? t('Assignment submitted for review.') : t('Assignment handed in. The unit is completed once it is graded at the pass mark.'))
    return true
  }

  function register(session) {
    const taken = Number(sessionCounts[session.id]) || 0
    if (sessionSeats(session, taken).full) return toast(t('That session is full. Choose another one.'), 'error')
    actions.registrations.add({ userId: user.id, courseId: course.id, unitId: active.id, sessionId: session.id, at: at(), attended: null })
    actions.logEvent('progress', `registered for ${session.name || active.name}`, user.id)
    toast(t('You are registered for this session.'))
  }

  const tabs = [
    { value: 'course', label: t('Course') },
    ...(options.discussions ? [{ value: 'discussion', label: t('Discussion') }] : []),
    { value: 'about', label: t('About') },
  ]

  return (
    <div>
      <button onClick={() => navigate('/my-courses')} className="link text-[13.5px] inline-flex items-center gap-1.5 mb-4">
        <Icon name="arrowLeft" className="w-4 h-4" />
        {t('My courses')}
      </button>

      <CourseHero course={course} className="rounded-card mb-5" />

      {record.status === 'failed' && (
        <div className="flex items-start gap-2.5 rounded-md bg-red-50 border border-red-100 text-red-800 px-4 py-3 mb-5 text-[13.5px]">
          <Icon name="alert" className="w-[18px] h-[18px] mt-0.5 shrink-0" />
          {t('You have used every attempt on a test in this course. Contact your instructor to have it reset.')}
        </div>
      )}
      {byInstructor && !completed && (
        <div className="flex items-start gap-2.5 rounded-md bg-brand-50 border border-brand-100 px-4 py-3 mb-5 text-[13.5px]">
          <Icon name="info" className="w-[18px] h-[18px] mt-0.5 shrink-0 text-brand-700" />
          {t('Your instructor marks this course complete once you have finished the work.')}
        </div>
      )}

      <Tabs tabs={tabs} active={tab} onChange={setTab} className="mb-6" />

      {tab === 'about' && (
        <section className="card card-pad max-w-4xl">
          <h2 className="card-title mb-2">{course.name}</h2>
          {course.description && <p className="text-[14.5px] leading-7 text-ink-700 whitespace-pre-line mb-5">{plainText(course.description)}</p>}
          {hasIntroVideo(course.introVideo) && <IntroVideo video={course.introVideo} title={`${course.name} introduction`} className="mb-6" />}

          <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-[14px] mb-6">
            <Fact label={t('Units')} value={contentUnits.length} />
            <Fact label={t('Level')} value={course.level || 'All levels'} />
            <Fact label={t('To complete')} value={course.completionRule === 'A percentage of units must be completed' ? `${course.completionPercent || 100}% of the units` : course.completionRule || 'All units must be completed'} />
            <Fact label={t('Certificate')} value={course.certificate && options.certificateEnabled !== false ? t('Issued on completion') : t('None')} />
            {instructors.length > 0 && <Fact label={t('Instructors')} value={instructors.map(fullName).join(', ')} />}
            {access.ends && <Fact label={t('Access until')} value={formatDay(access.ends)} />}
            {(options.customFields || []).map((f) => {
              const value = customFieldText(f, course.custom?.[f.id])
              return value ? <Fact key={f.id} label={f.name} value={value} /> : null
            })}
          </dl>

          <h3 className="text-[13px] font-semibold tracking-[0.12em] uppercase text-ink-700 mb-3">{t('Course outline')}</h3>
          <ol className="border border-line rounded-md divide-y divide-line mb-6">
            {course.units.map((u) =>
              u.type === 'section' ? (
                <li key={u.id} className="px-4 py-2.5 bg-[#f7f8fa] text-[12px] font-semibold uppercase tracking-wide text-ink-500">
                  {u.name}
                </li>
              ) : (
                <li key={u.id} className="px-4 py-2.5 flex items-center gap-3 text-[14px]">
                  <Icon name={done.includes(u.id) ? 'checkCircle' : unitIcon(u.type)} className={done.includes(u.id) ? 'w-[18px] h-[18px] text-emerald-600' : 'w-[18px] h-[18px] text-ink-500'} />
                  <span className="flex-1 min-w-0 truncate">{u.name}</span>
                  <span className="hint whitespace-nowrap">{unitLabel(u.type)}</span>
                </li>
              ),
            )}
          </ol>
          <Button onClick={() => setTab('course')} disabled={!contentUnits.length}>
            {done.length === 0 ? t('Start course') : completed ? t('Review course') : t('Continue course')}
          </Button>
        </section>
      )}

      {tab === 'discussion' && (
        <section className="card card-pad max-w-4xl">
          <Discussion course={course} />
        </section>
      )}

      {tab === 'course' && (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
          <CourseOutline
            course={course}
            completedUnits={done}
            activeId={active?.id}
            onSelect={setActiveId}
            lockedIds={lockedIds}
            showProgress={options.showProgressBar !== false}
          />

          <div className="space-y-6 min-w-0">
            {completed && options.ratings && (
              <RatingCard
                rating={myRating}
                onSave={(stars, comment) => {
                  const when = at()
                  if (myRating) actions.ratings.update(myRating.id, { stars, comment, at: when })
                  else actions.ratings.add({ courseId: course.id, userId: user.id, stars, comment, at: when })
                  toast(t('Thank you for rating this course.'))
                }}
              />
            )}

            <section className="card card-pad min-h-[420px]">
              {active ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-5 border-b border-line">
                    <div>
                      <p className="hint">
                        {t('Unit')} {activeIndex + 1} / {contentUnits.length} · {unitLabel(active.type)}
                      </p>
                      <h2 className="text-[21px] font-semibold text-ink-900 mt-1">{active.name}</h2>
                    </div>
                    {done.includes(active.id) ? (
                      <Badge tone="green">{t('Completed')}</Badge>
                    ) : (record.pendingUnits || []).includes(active.id) ? (
                      <Badge tone="amber">{t('Waiting for grade')}</Badge>
                    ) : null}
                  </div>

                  <UnitViewer
                    key={active.id}
                    unit={active}
                    courseName={course.name}
                    completed={done.includes(active.id)}
                    enrollment={record}
                    learner={{ id: user.id, name: fullName(user), email: user.email }}
                    submissions={unitSubmissions}
                    attempts={unitAttempts}
                    attemptsLeft={testAttemptsLeft(active, record)}
                    bestScore={record.scores?.[active.id] ?? null}
                    registrations={registrations.filter((r) => r.userId === user.id && r.courseId === course.id)}
                    sessionCounts={sessionCounts}
                    onRegister={register}
                    onCancelRegistration={(reg) => {
                      actions.registrations.remove(reg.id)
                      toast(t('Your registration was cancelled.'))
                    }}
                    onJoinSession={joinSession}
                    onComplete={(extra) => complete(extra)}
                    onSubmitTest={submitTest}
                    onSubmitSurvey={(response) => {
                      actions.attempts.add({ ...response, userId: user.id, courseId: course.id, unitId: active.id })
                      complete({ minutes: 3 })
                    }}
                    onSubmitAssignment={submitAssignment}
                    onScormCommit={(scoId, saved) => actions.saveScorm(user.id, course.id, active.id, scoId, saved)}
                  />

                  <UnitPager
                    units={contentUnits}
                    index={activeIndex}
                    onSelect={setActiveId}
                    nextLocked={activeIndex < contentUnits.length - 1 && lockedIds.includes(contentUnits[activeIndex + 1].id)}
                  />
                  {sequential && <p className="hint mt-3 text-right">{t('Units in this course are taken in order.')}</p>}
                </>
              ) : (
                <p className="hint">{t('Your instructor has not added any content to this course yet.')}</p>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  )
}

function Fact({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line pb-2.5">
      <dt className="text-ink-500 shrink-0">{label}</dt>
      <dd className="text-ink-900 text-right">{value}</dd>
    </div>
  )
}

function RatingCard({ rating, onSave }) {
  const t = useT()
  const [stars, setStars] = useState(rating?.stars || 0)
  const [comment, setComment] = useState(rating?.comment || '')
  const [open, setOpen] = useState(!rating)
  if (!open) {
    return (
      <section className="card px-6 py-4 flex flex-wrap items-center gap-3">
        <span className="text-[14px]">{t('Your rating')}</span>
        <Stars value={rating.stars} />
        <button className="link text-[13.5px] ml-auto" onClick={() => setOpen(true)}>
          {t('Change')}
        </button>
      </section>
    )
  }
  return (
    <section className="card card-pad">
      <h2 className="card-title mb-1.5">{t('How was this course?')}</h2>
      <p className="hint mb-3">{t('Your rating helps other learners choose.')}</p>
      <Stars value={stars} onChange={setStars} size="w-7 h-7" />
      <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('Anything you would like to add? (optional)')} className="mt-3" />
      <Button
        size="sm"
        className="mt-3"
        disabled={!stars}
        onClick={() => {
          onSave(stars, comment.trim())
          setOpen(false)
        }}
      >
        {t('Save rating')}
      </Button>
    </section>
  )
}
