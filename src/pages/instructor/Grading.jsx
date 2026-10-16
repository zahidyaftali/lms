import { useMemo, useState } from 'react'
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Field,
  Icon,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  Tabs,
  Textarea,
} from '../../components/ui'
import { AttemptReview } from '../../components/course/UnitViewer'
import { useData, useSelectors } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { getFileURL } from '../../lib/fileStore'
import { assignmentCompletesOn, sessionSeats } from '../../lib/rules.js'
import { cx, formatDateTime, fullName, uid } from '../../lib/utils'

export default function Grading() {
  const data = useData()
  const { submissions, courses, users, enrollments, actions } = data
  const attempts = data.attempts || []
  const registrations = data.registrations || []
  const { userById, courseById, coursesOfInstructor } = useSelectors()
  const { user, view } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('pending')
  const [grading, setGrading] = useState(null)
  const [grade, setGrade] = useState('')
  const [feedback, setFeedback] = useState('')

  const myCourses = useMemo(() => (view === 'admin' ? courses : coursesOfInstructor(user.id)), [view, courses, coursesOfInstructor, user.id])
  const myCourseIds = useMemo(() => new Set(myCourses.map((c) => c.id)), [myCourses])
  const visible = useMemo(() => submissions.filter((s) => myCourseIds.has(s.courseId)), [submissions, myCourseIds])

  const rows = visible
    .filter((s) => (tab === 'pending' ? s.status === 'pending' : s.status === 'graded' || s.status === 'returned'))
    .sort((a, b) => (a.submittedAt < b.submittedAt ? (tab === 'pending' ? -1 : 1) : tab === 'pending' ? 1 : -1))

  function openGrader(s) {
    setGrading(s)
    setGrade(s.grade != null ? String(s.grade) : s.autoScore != null ? String(s.autoScore) : '')
    setFeedback(s.feedback || '')
  }

  async function openAttachment(fileId) {
    const url = await getFileURL(fileId)
    if (url) window.open(url, '_blank', 'noopener')
  }

  const gradingUnit = grading ? courseById(grading.courseId)?.units.find((u) => u.id === grading.unitId) : null
  const gradingAttempt = grading?.attemptId ? attempts.find((a) => a.id === grading.attemptId) : null
  const gradeNumber = Math.max(0, Math.min(100, Number(grade) || 0))
  const passMark = gradingUnit?.type === 'test' ? Number(gradingUnit.data?.passingScore) || 0 : assignmentCompletesOn(gradingUnit) === 'pass' ? Number(gradingUnit?.data?.passScore) || 0 : null

  return (
    <div>
      <PageHeader title="Grading" subtitle="Assignments, written test answers and attendance at instructor-led sessions." />

      <Tabs
        tabs={[
          { value: 'pending', label: 'Awaiting review', count: visible.filter((s) => s.status === 'pending').length },
          { value: 'graded', label: 'Graded', count: visible.filter((s) => s.status === 'graded' || s.status === 'returned').length },
          { value: 'sessions', label: 'Sessions & attendance' },
        ]}
        active={tab}
        onChange={setTab}
        className="mb-6"
      />

      {tab === 'sessions' ? (
        <Attendance courses={myCourses} users={users} enrollments={enrollments} registrations={registrations} actions={actions} me={user} toast={toast} />
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="clipboard"
            title={tab === 'pending' ? 'Nothing to grade' : 'No graded work yet'}
            message={tab === 'pending' ? 'Submitted assignments and written answers will appear here.' : 'Once you grade a submission it moves to this tab.'}
          />
        </div>
      ) : (
        <ul className="space-y-4">
          {rows.map((s) => {
            const learner = userById(s.userId)
            const course = courseById(s.courseId)
            const unit = course?.units.find((u) => u.id === s.unitId)
            return (
              <li key={s.id} className="card card-pad">
                <div className="flex flex-wrap items-start gap-4">
                  <Avatar user={learner} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium">{fullName(learner)}</p>
                    <p className="hint">
                      {unit?.name || 'Removed unit'} · {course?.name}
                    </p>
                    <p className="text-[12.5px] text-ink-500 mt-0.5 flex flex-wrap items-center gap-2">
                      <span>
                        {s.type === 'test' ? 'Test handed in' : 'Submitted'} {formatDateTime(s.submittedAt)}
                      </span>
                      {s.late && <Badge tone="red">Late</Badge>}
                    </p>

                    {s.type === 'test' ? (
                      <p className="text-[13.5px] text-ink-700 mt-3">Written answers to grade. Open the attempt to read every answer.</p>
                    ) : (
                      s.text && <p className="text-[14px] text-ink-700 leading-6 mt-3 whitespace-pre-line border-l-2 border-line pl-4">{s.text}</p>
                    )}

                    {s.fileId && (
                      <button onClick={() => openAttachment(s.fileId)} className="link text-[13.5px] mt-3 inline-flex items-center gap-1.5">
                        <Icon name="file" className="w-4 h-4" />
                        {s.fileName || 'Attachment'}
                      </button>
                    )}
                    {!s.fileId && s.fileName && (
                      <p className="text-[13px] text-ink-500 mt-3 inline-flex items-center gap-1.5">
                        <Icon name="file" className="w-4 h-4" />
                        {s.fileName}
                      </p>
                    )}

                    {s.status !== 'pending' && (
                      <p className="text-[14px] mt-3">
                        <span className="font-medium">Feedback: </span>
                        {s.feedback || '—'}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <Badge tone={s.status === 'graded' ? 'green' : s.status === 'returned' ? 'red' : 'amber'}>
                      {s.status === 'graded' ? `${s.grade}%` : s.status === 'returned' ? 'Returned' : s.autoScore != null ? `Auto score ${s.autoScore}%` : 'Pending'}
                    </Badge>
                    <Button size="sm" variant={s.status === 'pending' ? 'primary' : 'ghost'} onClick={() => openGrader(s)}>
                      {s.status === 'pending' ? 'Grade' : 'Edit grade'}
                    </Button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Modal
        open={!!grading}
        onClose={() => setGrading(null)}
        title={grading?.type === 'test' ? 'Grade test' : 'Grade assignment'}
        subtitle={grading ? `${fullName(userById(grading.userId))} · ${gradingUnit?.name || ''}` : ''}
        width={gradingAttempt ? 'max-w-2xl' : 'max-w-lg'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setGrading(null)}>
              Cancel
            </Button>
            {grading?.type === 'assignment' && (
              <Button
                variant="outline"
                onClick={() => {
                  actions.gradeSubmission(grading.id, null, feedback, { returned: true })
                  setGrading(null)
                  toast('Returned to the learner to hand in again.')
                }}
              >
                Return for resubmission
              </Button>
            )}
            <Button
              onClick={() => {
                actions.gradeSubmission(grading.id, gradeNumber, feedback)
                setGrading(null)
                toast('Grade saved and shared with the learner.')
              }}
            >
              Save grade
            </Button>
          </>
        }
      >
        {gradingAttempt && gradingUnit && (
          <div className="mb-5 max-h-[45vh] overflow-y-auto scroll-thin pr-1">
            <p className="hint mb-3">Questions marked automatically scored {grading.autoScore ?? gradingAttempt.score}%. Written answers are for you to judge.</p>
            <AttemptReview questions={gradingUnit.data?.questions || []} attempt={gradingAttempt} />
          </div>
        )}
        {!gradingAttempt && grading?.type === 'test' && grading.text && (
          <p className="text-[14px] text-ink-700 leading-6 mb-5 whitespace-pre-line border-l-2 border-line pl-4">{grading.text}</p>
        )}
        <Field
          label="Score (%)"
          required
          hint={
            passMark != null
              ? `Pass mark ${passMark}%. ${gradeNumber >= passMark ? 'This grade passes' : 'This grade does not pass'}${grading?.type === 'test' ? ' the test' : ' — the learner is asked to hand it in again'}.`
              : 'The grade counts towards the learner’s course score.'
          }
        >
          <Input type="number" min="0" max="100" value={grade} onChange={(e) => setGrade(e.target.value)} />
        </Field>
        <Field label="Feedback" hint="The learner sees this with their work.">
          <Textarea rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
        </Field>
      </Modal>
    </div>
  )
}

/* ------------------------------------------------------------- attendance */

function Attendance({ courses, users, enrollments, registrations, actions, me, toast }) {
  const [query, setQuery] = useState('')
  const [when, setWhen] = useState('upcoming')
  const [adding, setAdding] = useState(null)
  const [pick, setPick] = useState('')
  const now = Date.now()

  const sessions = useMemo(() => {
    const list = []
    for (const course of courses) {
      for (const unit of course.units || []) {
        if (unit.type !== 'ilt') continue
        for (const s of unit.data?.sessions || []) list.push({ course, unit, session: s })
      }
    }
    return list.sort((a, b) => ((a.session.start || '9') < (b.session.start || '9') ? -1 : 1))
  }, [courses])

  const q = query.trim().toLowerCase()
  const shown = sessions.filter(({ course, unit, session }) => {
    const ends = new Date(session.end || session.start || 0).getTime() || 0
    const past = session.start && ends + 3600000 < now
    if (when === 'upcoming' && past) return false
    if (when === 'past' && !past) return false
    return !q || `${course.name} ${unit.name} ${session.name} ${session.location}`.toLowerCase().includes(q)
  })
  if (when === 'past') shown.reverse()

  const mark = (r, attended) => {
    actions.registrations.update(r.id, { attended, markedBy: me.id, markedAt: new Date().toISOString() })
    toast(attended ? 'Marked present. The unit is completed for this learner.' : attended === false ? 'Marked absent.' : 'Attendance cleared.')
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <SearchInput value={query} onChange={setQuery} className="w-[250px]" />
        <Select value={when} onChange={(e) => setWhen(e.target.value)} className="w-[200px]">
          <option value="upcoming">Upcoming and today</option>
          <option value="past">Past sessions</option>
          <option value="all">All sessions</option>
        </Select>
      </div>

      {shown.length === 0 ? (
        <div className="card">
          <EmptyState icon="calendar" title="No sessions here" message="Sessions are added to instructor-led training units in the course builder." />
        </div>
      ) : (
        <ul className="space-y-4">
          {shown.map(({ course, unit, session }) => {
            const regs = registrations.filter((r) => r.sessionId === session.id)
            const seats = sessionSeats(session, regs.length)
            const enrolled = enrollments.filter((e) => e.courseId === course.id)
            const free = enrolled.filter((e) => !registrations.some((r) => r.userId === e.userId && r.unitId === unit.id && r.attended !== false))
            return (
              <li key={session.id} className="card">
                <div className="px-6 py-4 border-b border-line flex flex-wrap items-start gap-4">
                  <span className="w-10 h-10 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                    <Icon name="calendar" className="w-5 h-5" />
                  </span>
                  <div className="flex-1 min-w-[220px]">
                    <p className="text-[15px] font-medium">{session.name || unit.name}</p>
                    <p className="hint">
                      {course.name} · {unit.name}
                    </p>
                    <p className="text-[13px] text-ink-700 mt-1">
                      {session.start ? formatDateTime(session.start) : 'Date to be confirmed'}
                      {session.location ? ` · ${session.location}` : ''}
                    </p>
                  </div>
                  <Badge tone={seats.full ? 'red' : 'blue'}>{seats.capacity ? `${regs.length} / ${seats.capacity} registered` : `${regs.length} registered`}</Badge>
                  <Button size="sm" variant="ghost" icon="userPlus" disabled={!free.length || seats.full} onClick={() => { setAdding({ course, unit, session }); setPick('') }}>
                    Register a learner
                  </Button>
                </div>
                {regs.length === 0 ? (
                  <p className="hint px-6 py-5">Nobody has registered yet.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {regs.map((r) => {
                      const learner = users.find((u) => u.id === r.userId)
                      return (
                        <li key={r.id} className="px-6 py-3 flex flex-wrap items-center gap-3">
                          <Avatar user={learner} size={32} />
                          <span className="flex-1 min-w-[160px] text-[14px]">{fullName(learner)}</span>
                          <div className="flex rounded-md border border-line overflow-hidden text-[13px]">
                            {[
                              [true, 'Present'],
                              [false, 'Absent'],
                            ].map(([value, label]) => (
                              <button
                                key={label}
                                onClick={() => mark(r, r.attended === value ? null : value)}
                                className={cx(
                                  'h-9 px-3.5 transition',
                                  r.attended === value ? (value ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white') : 'bg-white text-ink-700 hover:bg-gray-50',
                                )}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => {
                              actions.registrations.remove(r.id)
                              toast('Registration removed.')
                            }}
                            className="p-1.5 text-ink-400 hover:text-red-600"
                            title="Remove registration"
                          >
                            <Icon name="x" className="w-4 h-4" />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <Modal
        open={!!adding}
        onClose={() => setAdding(null)}
        title="Register a learner"
        subtitle={adding ? `${adding.session.name || adding.unit.name} · ${adding.course.name}` : ''}
        width="max-w-md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(null)}>
              Cancel
            </Button>
            <Button
              disabled={!pick}
              onClick={() => {
                actions.registrations.add({ id: uid('rg'), userId: pick, courseId: adding.course.id, unitId: adding.unit.id, sessionId: adding.session.id, at: new Date().toISOString(), attended: null, addedBy: me.id })
                setAdding(null)
                toast('Learner registered.')
              }}
            >
              Register
            </Button>
          </>
        }
      >
        {adding && (
          <Field label="Learner" hint="Learners enrolled in the course who do not hold a seat in this unit yet.">
            <Select value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Choose a learner</option>
              {enrollments
                .filter((e) => e.courseId === adding.course.id && !registrations.some((r) => r.userId === e.userId && r.unitId === adding.unit.id && r.attended !== false))
                .map((e) => users.find((u) => u.id === e.userId))
                .filter(Boolean)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {fullName(u)}
                  </option>
                ))}
            </Select>
          </Field>
        )}
      </Modal>
    </div>
  )
}
