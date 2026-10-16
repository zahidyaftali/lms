import { useMemo, useState } from 'react'
import { Avatar, Badge, EmptyState, Icon, Progress } from '../ui'
import { AttemptReview, surveyAnswerText } from './UnitViewer'
import { useData } from '../../context/DataContext'
import { markTest, sessionSeats } from '../../lib/rules.js'
import { cx, download, duration, formatDateTime, fullName, toCSV } from '../../lib/utils'

const newestFirst = (a, b) => ((a.at || a.submittedAt) < (b.at || b.submittedAt) ? 1 : -1)
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0)

/** What learners did in one unit: attempts, answers, progress or attendance. */
export default function UnitResults({ course, unit }) {
  if (!course || !unit) return null
  if (unit.type === 'test') return <TestResults course={course} unit={unit} />
  if (unit.type === 'survey') return <SurveyResults course={course} unit={unit} />
  if (unit.type === 'scorm') return <PackageResults course={course} unit={unit} />
  if (unit.type === 'assignment') return <AssignmentResults course={course} unit={unit} />
  if (unit.type === 'ilt') return <SessionResults course={course} unit={unit} />
  return <CompletionResults course={course} unit={unit} />
}

function Figure({ label, value }) {
  return (
    <div className="border border-line rounded-md px-4 py-3">
      <p className="text-[19px] font-semibold leading-none">{value}</p>
      <p className="hint mt-1.5">{label}</p>
    </div>
  )
}

function ExportButton({ onClick }) {
  return (
    <button onClick={onClick} className="link text-[13px] inline-flex items-center gap-1.5">
      <Icon name="download" className="w-4 h-4" />
      Export CSV
    </button>
  )
}

/* ------------------------------------------------------------------ tests */

function TestResults({ course, unit }) {
  const { users, attempts = [] } = useData()
  const [open, setOpen] = useState(null)
  const list = attempts.filter((a) => a.kind === 'test' && a.courseId === course.id && a.unitId === unit.id).sort(newestFirst)
  const marked = list.filter((a) => !a.pending)
  const learners = new Set(list.map((a) => a.userId))
  const passedBy = new Set(list.filter((a) => a.passed).map((a) => a.userId))
  const questions = unit.data?.questions || []
  const userOf = (id) => users.find((u) => u.id === id)

  // How often each question was answered correctly.
  const analysis = useMemo(
    () =>
      questions.map((q) => {
        const asked = list.filter((a) => (a.questionIds || []).includes(q.id))
        const results = asked.map((a) => markTest([q], a.answers || {}).results[q.id])
        return { q, asked: asked.length, right: results.filter((r) => r === true).length, open: q.type === 'text' }
      }),
    [questions, list],
  )

  if (!list.length) return <EmptyState icon="clipboard" title="No attempts yet" message="Attempts appear here as learners take this test." />

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Figure label="Attempts" value={list.length} />
        <Figure label="Learners" value={learners.size} />
        <Figure label="Average score" value={marked.length ? `${Math.round(marked.reduce((s, a) => s + (Number(a.score) || 0), 0) / marked.length)}%` : '-'} />
        <Figure label="Learners who passed" value={`${pct(passedBy.size, learners.size)}%`} />
      </div>

      <div className="flex items-center justify-between mb-2.5">
        <h4 className="text-[14px] font-semibold">Questions</h4>
      </div>
      <ul className="border border-line rounded-md divide-y divide-line mb-6">
        {analysis.map(({ q, asked, right, open: written }, i) => (
          <li key={q.id} className="px-4 py-2.5 flex items-center gap-3 text-[13.5px]">
            <span className="w-6 text-ink-500">{i + 1}.</span>
            <span className="flex-1 min-w-0 truncate" title={q.text}>
              {q.text || 'Untitled question'}
            </span>
            {written ? (
              <span className="hint">Graded by hand</span>
            ) : (
              <>
                <span className="w-24">
                  <Progress value={pct(right, asked)} tone={pct(right, asked) >= 70 ? 'green' : 'brand'} />
                </span>
                <span className="w-24 text-right text-ink-700">{asked ? `${pct(right, asked)}% right` : 'Not asked'}</span>
              </>
            )}
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between mb-2.5">
        <h4 className="text-[14px] font-semibold">Attempts</h4>
        <ExportButton
          onClick={() =>
            download(
              `${unit.name}-attempts.csv`,
              toCSV(list, [
                { label: 'Learner', value: (a) => fullName(userOf(a.userId)) },
                { label: 'Email', value: (a) => userOf(a.userId)?.email || '' },
                { label: 'Date', value: (a) => formatDateTime(a.at) },
                { label: 'Score %', value: (a) => (a.pending ? '' : a.score) },
                { label: 'Result', value: (a) => (a.pending ? 'Waiting for grade' : a.passed ? 'Passed' : 'Not passed') },
                { label: 'Time taken', value: (a) => duration(Math.round((a.seconds || 0) / 60)) },
              ]),
            )
          }
        />
      </div>
      <ul className="border border-line rounded-md divide-y divide-line">
        {list.map((a) => (
          <li key={a.id}>
            <button onClick={() => setOpen(open === a.id ? null : a.id)} className="w-full px-4 py-2.5 flex flex-wrap items-center gap-3 text-left hover:bg-gray-50">
              <Avatar user={userOf(a.userId)} size={28} />
              <span className="flex-1 min-w-[140px] text-[14px]">{fullName(userOf(a.userId))}</span>
              <span className="hint">{formatDateTime(a.at)}</span>
              {a.pending ? <Badge tone="amber">Waiting for grade</Badge> : <Badge tone={a.passed ? 'green' : 'red'}>{a.score}%</Badge>}
              <Icon name={open === a.id ? 'chevronUp' : 'chevronDown'} className="w-4 h-4 text-ink-500" />
            </button>
            {open === a.id && (
              <div className="px-4 pb-4">
                <AttemptReview questions={questions} attempt={a} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ---------------------------------------------------------------- surveys */

export function SurveyResults({ course, unit }) {
  const { users, attempts = [] } = useData()
  const list = attempts.filter((a) => a.kind === 'survey' && a.courseId === course.id && a.unitId === unit.id).sort(newestFirst)
  const questions = unit.data?.questions || []
  const anonymous = !!unit.data?.anonymous
  const nameOf = (a) => (anonymous || !a.userId ? 'Anonymous' : fullName(users.find((u) => u.id === a.userId)))

  if (!list.length) return <EmptyState icon="checkSquare" title="No answers yet" message="Answers appear here as learners complete this survey." />

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[14px] text-ink-700">
          {list.length} response{list.length === 1 ? '' : 's'}
          {anonymous ? ' · anonymous' : ''}
        </p>
        <ExportButton
          onClick={() =>
            download(
              `${unit.name}-answers.csv`,
              toCSV(list, [
                { label: 'Learner', value: nameOf },
                { label: 'Date', value: (a) => formatDateTime(a.at) },
                ...questions.map((q) => ({ label: q.text || 'Question', value: (a) => surveyAnswerText(q, a.answers?.[q.id]) })),
              ]),
            )
          }
        />
      </div>
      <ol className="space-y-5">
        {questions.map((q, i) => {
          const given = list.map((a) => a.answers?.[q.id]).filter((v) => v != null && v !== '' && !(Array.isArray(v) && !v.length))
          return (
            <li key={q.id} className="border border-line rounded-md px-4 py-4">
              <p className="text-[14px] font-medium mb-3">
                {i + 1}. {q.text}
                <span className="hint font-normal"> · {given.length} answer{given.length === 1 ? '' : 's'}</span>
              </p>
              {q.type === 'text' ? (
                <ul className="space-y-2 max-h-[260px] overflow-y-auto scroll-thin">
                  {list
                    .filter((a) => a.answers?.[q.id])
                    .map((a) => (
                      <li key={a.id} className="text-[13.5px] text-ink-700 border-l-2 border-line pl-3">
                        <span className="whitespace-pre-line">{a.answers[q.id]}</span>
                        <span className="hint block mt-0.5">{nameOf(a)}</span>
                      </li>
                    ))}
                </ul>
              ) : q.type === 'rating' ? (
                <Bars
                  rows={[5, 4, 3, 2, 1].map((n) => ({ label: `${n}${n === 5 && q.high ? ` · ${q.high}` : n === 1 && q.low ? ` · ${q.low}` : ''}`, count: given.filter((v) => Number(v) === n).length }))}
                  total={given.length}
                  footer={given.length ? `Average ${(given.reduce((s, v) => s + Number(v), 0) / given.length).toFixed(1)} / 5` : ''}
                />
              ) : (
                <Bars
                  rows={(q.options || []).map((o) => ({ label: o.text || 'Option', count: given.filter((v) => (Array.isArray(v) ? v.includes(o.id) : v === o.id)).length }))}
                  total={given.length}
                />
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function Bars({ rows, total, footer }) {
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3 text-[13.5px]">
          <span className="w-40 sm:w-56 shrink-0 truncate" title={r.label}>
            {r.label}
          </span>
          <span className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
            <span className="block h-full bg-brand-700 rounded-full" style={{ width: `${pct(r.count, total)}%` }} />
          </span>
          <span className="w-20 text-right text-ink-700">
            {r.count} · {pct(r.count, total)}%
          </span>
        </div>
      ))}
      {footer && <p className="hint pt-1">{footer}</p>}
    </div>
  )
}

/* --------------------------------------------------------------- packages */

function PackageResults({ course, unit }) {
  const { users, enrollments } = useData()
  const rows = enrollments.filter((e) => e.courseId === course.id)
  const scos = unit.data?.scos || []
  if (!rows.length) return <EmptyState icon="package" title="Nobody is enrolled yet" />
  return (
    <ul className="border border-line rounded-md divide-y divide-line">
      {rows.map((e) => {
        const learner = users.find((u) => u.id === e.userId)
        const saved = e.scorm?.[unit.id] || {}
        const outcomes = scos.map((s) => saved[s.id]?.outcome).filter(Boolean)
        const done = (e.completedUnits || []).includes(unit.id)
        const scores = outcomes.map((o) => o.score).filter((n) => n != null)
        const seconds = Object.values(saved).reduce((s, x) => s + (Number(x?.seconds) || 0), 0)
        return (
          <li key={e.id} className="px-4 py-2.5 flex flex-wrap items-center gap-3">
            <Avatar user={learner} size={28} />
            <span className="flex-1 min-w-[140px] text-[14px]">{fullName(learner)}</span>
            {seconds > 0 && <span className="hint">{duration(Math.round(seconds / 60))}</span>}
            {scores.length > 0 && <span className="text-[13px] text-ink-700">{Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)}%</span>}
            <Badge tone={done ? 'green' : outcomes.some((o) => o.failed) ? 'red' : outcomes.length ? 'amber' : 'gray'}>
              {done ? 'Completed' : outcomes.some((o) => o.failed) ? 'Not passed' : outcomes.length ? 'In progress' : 'Not started'}
            </Badge>
          </li>
        )
      })}
    </ul>
  )
}

/* ------------------------------------------------------------ assignments */

function AssignmentResults({ course, unit }) {
  const { users, enrollments, submissions } = useData()
  const rows = enrollments.filter((e) => e.courseId === course.id)
  if (!rows.length) return <EmptyState icon="pencil" title="Nobody is enrolled yet" />
  return (
    <>
      <p className="hint mb-3">Grade submissions on the Grading page.</p>
      <ul className="border border-line rounded-md divide-y divide-line">
        {rows.map((e) => {
          const learner = users.find((u) => u.id === e.userId)
          const latest = submissions.filter((s) => s.userId === e.userId && s.unitId === unit.id && s.courseId === course.id).sort(newestFirst)[0]
          return (
            <li key={e.id} className="px-4 py-2.5 flex flex-wrap items-center gap-3">
              <Avatar user={learner} size={28} />
              <span className="flex-1 min-w-[140px] text-[14px]">{fullName(learner)}</span>
              {latest && <span className="hint">{formatDateTime(latest.submittedAt)}</span>}
              {latest?.late && <Badge tone="red">Late</Badge>}
              <Badge tone={!latest ? 'gray' : latest.status === 'graded' ? 'green' : latest.status === 'returned' ? 'red' : 'amber'}>
                {!latest ? 'Not handed in' : latest.status === 'graded' ? `Graded ${latest.grade}%` : latest.status === 'returned' ? 'Returned' : 'Waiting for grade'}
              </Badge>
            </li>
          )
        })}
      </ul>
    </>
  )
}

/* --------------------------------------------------------------- sessions */

function SessionResults({ course, unit }) {
  const { users, registrations = [] } = useData()
  const sessions = unit.data?.sessions || []
  if (!sessions.length) return <EmptyState icon="calendar" title="No sessions yet" message="Add sessions to this unit in the editor." />
  return (
    <>
      <p className="hint mb-3">Record attendance on the Grading page → Sessions &amp; attendance.</p>
      <ul className="space-y-3">
        {sessions.map((s) => {
          const regs = registrations.filter((r) => r.sessionId === s.id)
          const seats = sessionSeats(s, regs.length)
          return (
            <li key={s.id} className="border border-line rounded-md">
              <div className="px-4 py-3 flex flex-wrap items-center gap-3 border-b border-line">
                <span className="flex-1 min-w-[160px] text-[14px] font-medium">{s.name || 'Session'}</span>
                <span className="hint">{s.start ? formatDateTime(s.start) : 'Date to be confirmed'}</span>
                <Badge tone={seats.full ? 'red' : 'blue'}>{seats.capacity ? `${regs.length} / ${seats.capacity}` : `${regs.length} registered`}</Badge>
              </div>
              {regs.length === 0 ? (
                <p className="hint px-4 py-3">No registrations yet.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {regs.map((r) => (
                    <li key={r.id} className="px-4 py-2 flex items-center gap-3 text-[13.5px]">
                      <span className="flex-1">{fullName(users.find((u) => u.id === r.userId))}</span>
                      <Badge tone={r.attended === true ? 'green' : r.attended === false ? 'red' : 'gray'}>{r.attended === true ? 'Present' : r.attended === false ? 'Absent' : 'Registered'}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}

/* ---------------------------------------------------------- other units */

function CompletionResults({ course, unit }) {
  const { users, enrollments } = useData()
  const rows = enrollments.filter((e) => e.courseId === course.id)
  const done = rows.filter((e) => (e.completedUnits || []).includes(unit.id))
  if (!rows.length) return <EmptyState icon="book" title="Nobody is enrolled yet" />
  return (
    <>
      <p className="text-[14px] text-ink-700 mb-3">
        {done.length} of {rows.length} learners completed this unit ({pct(done.length, rows.length)}%).
      </p>
      <ul className="border border-line rounded-md divide-y divide-line">
        {rows.map((e) => (
          <li key={e.id} className="px-4 py-2 flex items-center gap-3 text-[13.5px]">
            <span className="flex-1">{fullName(users.find((u) => u.id === e.userId))}</span>
            <Icon name={(e.completedUnits || []).includes(unit.id) ? 'checkCircle' : 'clock'} className={cx('w-[18px] h-[18px]', (e.completedUnits || []).includes(unit.id) ? 'text-emerald-600' : 'text-ink-400')} />
          </li>
        ))}
      </ul>
    </>
  )
}
