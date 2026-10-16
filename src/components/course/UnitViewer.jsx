import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Button, Checkbox, Icon, Input, Radio, Textarea } from '../ui'
import { toEmbedURL, useFileURL } from './media'
import { isHtml } from './unitTypes'
import { cx, download, formatDate, formatDateTime, uid } from '../../lib/utils'
import { assignmentCompletesOn, assignmentDue, drawQuestions, iltCompletesOn, markTest, sessionSeats } from '../../lib/rules.js'
import { icsFile } from '../../lib/calendar'
import { hasLocalPackage, packageURL, packageWorker } from '../../lib/packages'
import { installScormApi } from '../../lib/scorm'

/**
 * One unit as a learner takes it. Everything past `unit` is optional, so the
 * public (guest) course page can show the same units without an account.
 */
export default function UnitViewer(props) {
  const { unit } = props
  if (!unit) return null

  switch (unit.type) {
    case 'content':
      return <ContentUnit {...props} />
    case 'webcontent':
      return <WebContentUnit {...props} />
    case 'video':
    case 'audio':
      return <MediaUnit {...props} />
    case 'document':
      return <DocumentUnit {...props} />
    case 'iframe':
      return <IframeUnit {...props} />
    case 'scorm':
      return <PackageUnit {...props} />
    case 'test':
      return <TestUnit {...props} />
    case 'survey':
      return <SurveyUnit {...props} />
    case 'assignment':
      return <AssignmentUnit {...props} />
    case 'ilt':
      return <IltUnit {...props} />
    default:
      return <p className="hint">This unit type cannot be displayed.</p>
  }
}

function CompleteBar({ onComplete, completed, label = 'Mark as complete' }) {
  if (completed) {
    return (
      <div className="flex items-center gap-2.5 mt-8 pt-6 border-t border-line text-emerald-700">
        <Icon name="checkCircle" className="w-5 h-5" />
        <span className="text-[14px] font-medium">Completed</span>
      </div>
    )
  }
  if (!onComplete) return null
  return (
    <div className="mt-8 pt-6 border-t border-line">
      <Button icon="check" onClick={() => onComplete()}>
        {label}
      </Button>
    </div>
  )
}

function Note({ tone = 'info', children, className }) {
  const tones = {
    info: 'bg-brand-50 border-brand-100 text-ink-700',
    warn: 'bg-amber-50 border-amber-100 text-amber-900',
    bad: 'bg-red-50 border-red-100 text-red-800',
    good: 'bg-emerald-50 border-emerald-100 text-emerald-800',
  }
  return (
    <p className={cx('flex gap-2.5 text-[13.5px] leading-5 border rounded-md px-3.5 py-2.5', tones[tone], className)}>
      <Icon name={tone === 'good' ? 'checkCircle' : tone === 'info' ? 'info' : 'alert'} className="w-[18px] h-[18px] shrink-0 mt-px" />
      <span>{children}</span>
    </p>
  )
}

function ContentUnit({ unit, onComplete, completed }) {
  return (
    <div>
      <div className="prose-unit text-[15px] leading-8 text-ink-900" dangerouslySetInnerHTML={{ __html: unit.data?.html || '' }} />
      <CompleteBar onComplete={onComplete} completed={completed} />
    </div>
  )
}

function WebContentUnit({ unit, onComplete, completed }) {
  const url = unit.data?.url
  return (
    <div>
      {url ? (
        <a
          href={url}
          target={unit.data?.openInNewTab ? '_blank' : '_self'}
          rel="noreferrer"
          className="flex items-center gap-3 border border-line rounded-md px-5 py-4 hover:bg-gray-50"
        >
          <Icon name="link" className="w-5 h-5 text-brand-700" />
          <span className="flex-1 text-[14.5px] text-brand-700 break-all">{url}</span>
          <Icon name="arrowRight" className="w-4 h-4 text-ink-500" />
        </a>
      ) : (
        <p className="hint">No web address has been set for this unit yet.</p>
      )}
      <CompleteBar onComplete={onComplete} completed={completed} />
    </div>
  )
}

function MediaUnit({ unit, onComplete, completed }) {
  const fileUrl = useFileURL(unit.data?.source === 'file' ? unit.data?.fileId : null)
  const src = unit.data?.source === 'file' ? fileUrl : unit.data?.url
  const isVideo = unit.type === 'video'
  const embed = useMemo(() => toEmbedURL(unit.data?.url), [unit.data?.url])

  return (
    <div>
      {!src && <p className="hint">No media has been attached to this unit yet.</p>}

      {src && unit.data?.source === 'url' && embed && (
        <div className="aspect-video w-full rounded-md overflow-hidden bg-black">
          <iframe src={embed} title={unit.name} className="w-full h-full" allowFullScreen />
        </div>
      )}

      {src && (!embed || unit.data?.source === 'file') && isVideo && (
        <video src={src} controls className="w-full rounded-md bg-black" onEnded={() => !completed && onComplete?.()}>
          {unit.data?.captionsUrl && <track kind="captions" src={unit.data.captionsUrl} srcLang="en" label="English" />}
        </video>
      )}

      {src && !isVideo && <audio src={src} controls className="w-full" onEnded={() => !completed && onComplete?.()} />}

      <CompleteBar onComplete={onComplete} completed={completed} />
    </div>
  )
}

/** A document is either uploaded (`fileId`) or served with the portal (`url`). */
function DocumentUnit({ unit, onComplete, completed }) {
  const fileUrl = useFileURL(unit.data?.url ? null : unit.data?.fileId)
  const url = unit.data?.url || fileUrl
  const isPdf = (unit.data?.fileType || '').includes('pdf') || (unit.data?.fileName || '').endsWith('.pdf')

  return (
    <div>
      {unit.data?.description && (
        <div className="prose-unit text-[15px] leading-7 text-ink-900 mb-5" dangerouslySetInnerHTML={{ __html: unit.data.description }} />
      )}

      {!unit.data?.url && !unit.data?.fileId && <p className="hint">No document has been uploaded for this unit yet.</p>}

      {url && isPdf && (
        <>
          <iframe src={url} title={unit.name} className="w-full h-[70vh] rounded-md border border-line" />
          {/* Phone browsers often won't draw a PDF inside a page, so the file is always one tap away. */}
          <a href={url} target="_blank" rel="noreferrer" className="link text-[13.5px] inline-flex items-center gap-1.5 mt-3">
            <Icon name="download" className="w-4 h-4" />
            Open or download the PDF
          </a>
        </>
      )}

      {url && !isPdf && (
        <a href={url} download={unit.data.fileName} className="btn-outline">
          <Icon name="download" className="w-[18px] h-[18px]" />
          Download {unit.data.fileName}
        </a>
      )}

      <CompleteBar onComplete={onComplete} completed={completed} />
    </div>
  )
}

function IframeUnit({ unit, onComplete, completed }) {
  return (
    <div>
      {unit.data?.url ? (
        <iframe src={unit.data.url} title={unit.name} style={{ height: unit.data.height || 520 }} className="w-full rounded-md border border-line" />
      ) : (
        <p className="hint">No embed URL has been set for this unit yet.</p>
      )}
      <CompleteBar onComplete={onComplete} completed={completed} />
    </div>
  )
}

/* ------------------------------------------------------------- SCORM / xAPI */

const XAPI_VERB = 'http://adlnet.gov/expapi/verbs/'

/** A stable registration id (UUID shape) for one learner's run of one package, so xAPI state resumes. */
function registrationFor(...parts) {
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  const s = parts.join('|')
  for (let i = 0; i < s.length; i++) {
    h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619) >>> 0
    h2 = Math.imul(h2 + s.charCodeAt(i), 2246822519) >>> 0
  }
  const hex = (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).repeat(2)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

/** Whether what a package reported finishes the unit, under the unit's own rule. */
const finishes = (unit, outcome) => !!outcome && (unit.data?.completeOn === 'passed' ? outcome.passed : outcome.completed)

function PackageUnit({ unit, completed, onComplete, enrollment, learner, onScormCommit }) {
  const data = unit.data || {}
  const scos = data.scos || []
  const saved = enrollment?.scorm?.[unit.id] || {}
  const [scoId, setScoId] = useState(() => (scos.find((s) => !finishes(unit, saved[s.id]?.outcome)) || scos[0])?.id)
  const [ready, setReady] = useState(false)
  const [problem, setProblem] = useState('')
  const [running, setRunning] = useState(false)
  const frameRef = useRef(null)
  const boxRef = useRef(null)
  const savedRef = useRef(saved)
  savedRef.current = saved
  const sco = scos.find((s) => s.id === scoId) || scos[0]

  // A package uploaded before the portal could play them has no manifest on record.
  const legacy = !data.packageId

  useEffect(() => {
    if (legacy || !sco) return undefined
    let cancelled = false
    setReady(false)
    setProblem('')
    ;(async () => {
      try {
        await packageWorker()
        if (!data.shared && !/^https?:/i.test(sco.href) && !(await hasLocalPackage(data.packageId, sco.href.split('?')[0]))) {
          throw new Error('This package is stored in the browser it was uploaded from, so it cannot be opened here. Ask your instructor to upload it again once the shared database is connected.')
        }
        if (!cancelled) setReady(true)
      } catch (err) {
        if (!cancelled) setProblem(err.message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [legacy, data.packageId, data.shared, sco])

  /** Saves what a SCO reported and completes the unit once every SCO is done. */
  const record = (id, state) => {
    onScormCommit?.(id, state)
    const all = { ...savedRef.current, [id]: state }
    if (!completed && scos.every((s) => finishes(unit, all[s.id]?.outcome))) {
      const scores = scos.map((s) => all[s.id]?.outcome?.score).filter((n) => n != null)
      onComplete?.({ score: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : undefined, minutes: Math.round((state.seconds || 0) / 60) })
    }
  }
  const recordRef = useRef(record)
  recordRef.current = record

  // SCORM 1.2 and 2004 talk to window.API / window.API_1484_11.
  useEffect(() => {
    if (!running || !sco || !['scorm12', 'scorm2004'].includes(data.kind)) return undefined
    const remove = installScormApi({
      kind: data.kind,
      saved: savedRef.current[sco.id] || {},
      learner: { id: learner?.id || 'guest', name: learner?.name || 'Guest' },
      sco,
      onCommit: (state) => recordRef.current(sco.id, { ...state, at: new Date().toISOString() }),
    })
    return remove
  }, [running, sco, data.kind, learner?.id, learner?.name])

  // xAPI and cmi5 send statements, which the service worker passes on.
  const registration = registrationFor(enrollment?.id || learner?.id || 'guest', unit.id, sco?.id || '')
  useEffect(() => {
    if (!running || !sco || !['xapi', 'cmi5'].includes(data.kind) || !('serviceWorker' in navigator)) return undefined
    const onMessage = (event) => {
      if (event.data?.type !== 'xapi-statements') return
      for (const st of event.data.statements || []) {
        if (st.context?.registration && st.context.registration !== registration) continue
        const verb = String(st.verb?.id || '')
        const passed = verb === `${XAPI_VERB}passed`
        const failed = verb === `${XAPI_VERB}failed`
        const done = verb === `${XAPI_VERB}completed` || passed || st.result?.completion === true
        if (!done && !failed && st.result?.success == null) continue
        const r = st.result?.score || {}
        const score = r.scaled != null ? Math.round(r.scaled * 100) : r.raw != null ? Math.round(r.max ? (r.raw / r.max) * 100 : r.raw) : null
        const before = savedRef.current[sco.id]?.outcome || {}
        const outcome = {
          completed: !!(before.completed || done),
          passed: !!(before.passed || passed || st.result?.success === true),
          failed: !(before.passed || passed) && (failed || st.result?.success === false),
          score: score ?? before.score ?? null,
        }
        recordRef.current(sco.id, { outcome, seconds: Number(savedRef.current[sco.id]?.seconds) || 0, at: new Date().toISOString() })
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [running, sco, data.kind, registration])

  const src = useMemo(() => {
    if (!sco || !data.packageId) return ''
    const base = /^https?:/i.test(sco.href) ? sco.href : packageURL(data.packageId, sco.href)
    if (!['xapi', 'cmi5'].includes(data.kind)) return base
    const origin = window.location.origin
    const actor =
      data.kind === 'cmi5'
        ? { objectType: 'Agent', account: { homePage: origin, name: learner?.id || 'guest' }, name: learner?.name || 'Guest' }
        : { objectType: 'Agent', name: learner?.name || 'Guest', mbox: `mailto:${learner?.email || `${learner?.id || 'guest'}@learners.invalid`}` }
    const params = new URLSearchParams({
      endpoint: `${origin}/xapi/`,
      actor: JSON.stringify(actor),
      registration,
      activityId: sco.activityId || data.activityId || `${origin}/units/${unit.id}`,
      activity_id: sco.activityId || data.activityId || `${origin}/units/${unit.id}`,
      auth: `Basic ${btoa('lms:lms')}`,
    })
    if (data.kind === 'cmi5') params.set('fetch', `${origin}/xapi/fetch`)
    return `${base}${base.includes('?') ? '&' : '?'}${params.toString()}`
  }, [sco, data.packageId, data.kind, data.activityId, learner, registration, unit.id])

  if (legacy) {
    return (
      <div>
        <Note tone="warn">
          {data.fileName ? `${data.fileName} was uploaded before the portal could play packages.` : 'No package has been uploaded to this unit yet.'} Your instructor needs to
          upload it again in the course builder.
        </Note>
        {data.fileName && <CompleteBar onComplete={onComplete} completed={completed} />}
      </div>
    )
  }

  const outcomeOf = (id) => saved[id]?.outcome

  return (
    <div>
      {scos.length > 1 && (
        <ol className="mb-4 border border-line rounded-md divide-y divide-line">
          {scos.map((s, i) => {
            const out = outcomeOf(s.id)
            return (
              <li key={s.id}>
                <button
                  onClick={() => {
                    setRunning(false)
                    setScoId(s.id)
                  }}
                  className={cx('w-full flex items-center gap-3 px-4 py-2.5 text-left text-[14px]', s.id === sco?.id ? 'bg-brand-50' : 'hover:bg-gray-50')}
                >
                  <span className="w-6 text-ink-500">{i + 1}.</span>
                  <span className="flex-1 min-w-0 truncate">{s.title}</span>
                  {finishes(unit, out) ? (
                    <Badge tone="green">{out.passed ? 'Passed' : 'Completed'}</Badge>
                  ) : out?.failed ? (
                    <Badge tone="red">Not passed</Badge>
                  ) : out ? (
                    <Badge tone="amber">In progress</Badge>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ol>
      )}

      {problem ? (
        <Note tone="bad">{problem}</Note>
      ) : !running ? (
        <div className="border border-line rounded-md px-6 py-8 text-center">
          <Icon name="package" className="w-8 h-8 mx-auto text-brand-700 mb-3" strokeWidth={1.4} />
          <p className="text-[15px] font-semibold">{sco?.title || data.title || unit.name}</p>
          {outcomeOf(sco?.id) ? (
            <p className="hint mt-1.5">
              {finishes(unit, outcomeOf(sco.id)) ? 'Completed' : outcomeOf(sco.id).failed ? 'Not passed yet' : 'In progress — it opens where you left off'}
              {outcomeOf(sco.id).score != null ? ` · score ${outcomeOf(sco.id).score}%` : ''}
            </p>
          ) : (
            <p className="hint mt-1.5">{data.kind === 'scorm2004' ? 'SCORM 2004' : data.kind === 'scorm12' ? 'SCORM 1.2' : data.kind === 'cmi5' ? 'cmi5' : 'xAPI'} lesson</p>
          )}
          <Button className="mt-5" icon="play" disabled={!ready} onClick={() => setRunning(true)}>
            {ready ? (outcomeOf(sco?.id) ? 'Continue' : 'Start') : 'Preparing…'}
          </Button>
        </div>
      ) : (
        <div ref={boxRef} className="bg-white">
          <iframe ref={frameRef} key={`${sco.id}`} src={src} title={sco.title} allow="fullscreen; autoplay; microphone; camera" className="w-full h-[75vh] min-h-[480px] rounded-md border border-line bg-white" />
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <Button size="sm" variant="ghost" icon="monitor" onClick={() => boxRef.current?.requestFullscreen?.()}>
              Full screen
            </Button>
            <Button size="sm" variant="ghost" icon="x" onClick={() => setRunning(false)}>
              Close lesson
            </Button>
            <span className="hint">Your progress is saved as you go.</span>
          </div>
        </div>
      )}

      {completed && (
        <div className="flex items-center gap-2.5 mt-6 text-emerald-700">
          <Icon name="checkCircle" className="w-5 h-5" />
          <span className="text-[14px] font-medium">Completed</span>
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------- tests */

const QUESTION_LABEL = { single: 'Single choice', truefalse: 'True / False', multiple: 'Multiple choice', gap: 'Fill in the blank', ordering: 'Put in order', text: 'Written answer' }

function answerText(q, given) {
  if (given == null || (Array.isArray(given) && !given.length) || given === '') return '—'
  if (q.type === 'gap' || q.type === 'text') return String(given)
  const ids = Array.isArray(given) ? given : [given]
  return ids.map((id) => q.options?.find((o) => o.id === id)?.text || '?').join(q.type === 'ordering' ? ' → ' : ', ')
}

function correctText(q) {
  if (q.type === 'gap') return String(q.answer || '').split('|').map((a) => a.trim()).filter(Boolean).join(' or ')
  if (q.type === 'ordering') return (q.options || []).map((o) => o.text).join(' → ')
  if (q.type === 'text') return 'Graded by your instructor'
  return (q.options || []).filter((o) => o.correct).map((o) => o.text).join(', ')
}

/** Questions and answers of one attempt, marked right or wrong. */
export function AttemptReview({ questions, attempt, showCorrect = true }) {
  const byId = new Map((questions || []).map((q) => [q.id, q]))
  const shown = (attempt.questionIds || Object.keys(attempt.answers || {})).map((id) => byId.get(id)).filter(Boolean)
  const results = markTest(shown, attempt.answers || {}).results
  return (
    <ol className="space-y-4 text-left">
      {shown.map((q, i) => {
        const right = results[q.id]
        return (
          <li key={q.id} className="border border-line rounded-md px-4 py-3.5">
            <div className="flex items-start gap-3">
              <span className={cx('mt-0.5 shrink-0', right === true ? 'text-emerald-600' : right === false ? 'text-red-600' : 'text-ink-400')}>
                <Icon name={right === true ? 'checkCircle' : right === false ? 'x' : 'clock'} className="w-[18px] h-[18px]" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium">
                  {i + 1}. {q.text}
                </p>
                <p className="text-[13.5px] text-ink-700 mt-1.5">
                  <span className="text-ink-500">Answer: </span>
                  <span className="whitespace-pre-line">{answerText(q, attempt.answers?.[q.id])}</span>
                </p>
                {showCorrect && right === false && (
                  <p className="text-[13.5px] text-emerald-800 mt-1">
                    <span className="text-ink-500">Correct: </span>
                    {correctText(q)}
                  </p>
                )}
                {q.explanation && showCorrect && <p className="hint mt-1.5">{q.explanation}</p>}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** Fisher–Yates, for the order items of an ordering question start in. */
function shuffled(list) {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  // Never start an ordering question already in the right order.
  if (out.length > 1 && out.every((x, i) => x === list[i])) out.push(out.shift())
  return out
}

function TestUnit({ unit, onSubmitTest, completed, attemptsLeft = Infinity, bestScore = null, attempts = [], enrollment }) {
  const data = unit.data || {}
  const questions = data.questions || []
  const passMark = Number(data.passingScore) || 0
  const [drawn, setDrawn] = useState(null)
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [secondsLeft, setSecondsLeft] = useState(null)
  const [review, setReview] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const startedAt = useRef(0)
  const limit = Number(data.timeLimitMin) || 0
  const pending = (enrollment?.pendingUnits || []).includes(unit.id)
  const everPassed = attempts.some((a) => a.passed) || completed
  const mayReview = (a) => data.showAnswers === 'after' || (data.showAnswers === 'passed' && (a.passed || everPassed))
  const answersRef = useRef(answers)
  answersRef.current = answers

  function start() {
    let set = drawQuestions(questions, data.poolSize)
    if (data.shuffle && !(Number(data.poolSize) > 0 && Number(data.poolSize) < questions.length)) set = shuffled(set)
    // Ordering questions start shuffled; the learner puts them back in order.
    const initial = {}
    for (const q of set) if (q.type === 'ordering') initial[q.id] = shuffled((q.options || []).map((o) => o.id))
    setAnswers(initial)
    setDrawn(set)
    setResult(null)
    setConfirming(false)
    startedAt.current = Date.now()
    if (limit) setSecondsLeft(limit * 60)
  }

  function submit(given = answersRef.current) {
    if (!drawn) return
    const marked = markTest(drawn, given)
    const outcome = {
      id: uid('at'),
      score: marked.score,
      passed: !marked.pending && marked.score >= passMark,
      pending: marked.pending,
      answers: given,
      questionIds: drawn.map((q) => q.id),
      results: marked.results,
      seconds: Math.round((Date.now() - startedAt.current) / 1000),
      openAnswers: drawn.filter((q) => q.type === 'text').map((q) => ({ question: q.text, answer: given[q.id] || '' })),
    }
    setResult(outcome)
    setDrawn(null)
    setSecondsLeft(null)
    onSubmitTest?.(outcome)
  }
  const submitRef = useRef(submit)
  submitRef.current = submit

  // The clock runs out: the test is handed in as it stands.
  useEffect(() => {
    if (!drawn || !limit) return undefined
    const timer = setInterval(() => {
      const left = limit * 60 - Math.floor((Date.now() - startedAt.current) / 1000)
      setSecondsLeft(Math.max(0, left))
      if (left <= 0) {
        clearInterval(timer)
        submitRef.current()
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [drawn, limit])

  if (result) {
    return (
      <div className="py-6">
        <div className="text-center">
          <span
            className={cx(
              'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4',
              result.pending ? 'bg-amber-50 text-amber-600' : result.passed ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600',
            )}
          >
            <Icon name={result.pending ? 'clock' : result.passed ? 'checkCircle' : 'alert'} className="w-8 h-8" />
          </span>
          {result.pending ? (
            <>
              <p className="text-[18px] font-semibold">Handed in</p>
              <p className="text-[14px] mt-1 text-ink-700">
                Your written answers go to your instructor. The test is marked once they grade it
                {result.openAnswers.length < result.questionIds.length ? ` (the other questions scored ${result.score}%)` : ''}.
              </p>
            </>
          ) : (
            <>
              <p className="text-[22px] font-semibold">{result.score}%</p>
              <p className={cx('text-[14px] mt-1', result.passed ? 'text-emerald-700' : 'text-red-600')}>
                {result.passed ? 'Passed — well done.' : `Not passed. You need ${passMark}% to pass this test.`}
              </p>
            </>
          )}
          {!result.pending && !result.passed && attemptsLeft === 0 && (
            <p className="hint mt-3">You have used every attempt this test allows. Contact your instructor if you need another.</p>
          )}
          {!result.pending && !result.passed && attemptsLeft > 0 && (
            <Button className="mt-6" variant="outline" onClick={start}>
              Try again
            </Button>
          )}
        </div>
        {mayReview(result) && (
          <div className="mt-8">
            <h3 className="text-[15px] font-semibold mb-3">Your answers</h3>
            <AttemptReview questions={questions} attempt={result} />
          </div>
        )}
      </div>
    )
  }

  if (!drawn) {
    const count = Number(data.poolSize) > 0 ? Math.min(Number(data.poolSize), questions.length) : questions.length
    return (
      <div>
        <div className="border border-line rounded-md px-6 py-8 text-center">
          <Icon name="clipboard" className="w-8 h-8 mx-auto text-brand-700 mb-3" strokeWidth={1.4} />
          <p className="text-[16px] font-semibold">{unit.name}</p>
          {data.description && (
            <div className="prose-unit text-left text-[14px] leading-6 text-ink-700 mt-4 max-w-2xl mx-auto" dangerouslySetInnerHTML={{ __html: data.description }} />
          )}
          <ul className="hint mt-3 space-y-1">
            <li>
              {count} question{count === 1 ? '' : 's'}
              {count < questions.length ? ` drawn from ${questions.length}` : ''}
            </li>
            <li>Pass mark {passMark}%</li>
            <li>{limit ? `${limit} minute time limit — the test is handed in when time runs out` : 'No time limit'}</li>
            <li>{data.maxAttempts ? `${data.maxAttempts} attempts allowed · ${Number.isFinite(attemptsLeft) ? attemptsLeft : data.maxAttempts} left` : 'Unlimited attempts'}</li>
            {bestScore != null && <li>Your best score so far: {bestScore}%</li>}
          </ul>
          {pending ? (
            <Note tone="warn" className="mt-5 text-left max-w-xl mx-auto">
              Your last attempt has written answers waiting for your instructor. You can take the test again once it is graded.
            </Note>
          ) : (
            <Button className="mt-6" disabled={!questions.length || attemptsLeft === 0} onClick={start}>
              {completed ? 'Retake test' : attempts.length ? 'Try again' : 'Start test'}
            </Button>
          )}
          {attemptsLeft === 0 && !completed && !pending && <p className="hint mt-3">No attempts left. Contact your instructor if you need another.</p>}
          {!questions.length && <p className="hint mt-3">This test has no questions yet.</p>}
        </div>

        {attempts.length > 0 && (
          <div className="mt-6">
            <h3 className="text-[13px] font-semibold tracking-[0.12em] uppercase text-ink-700 mb-2.5">Your attempts</h3>
            <ul className="border border-line rounded-md divide-y divide-line">
              {attempts.map((a, i) => (
                <li key={a.id}>
                  <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[14px]">
                    <span className="text-ink-500 w-20">Attempt {attempts.length - i}</span>
                    <span className="flex-1 min-w-0 text-ink-700">{formatDateTime(a.at)}</span>
                    {a.pending ? <Badge tone="amber">Waiting for grade</Badge> : <Badge tone={a.passed ? 'green' : 'red'}>{a.score}%</Badge>}
                    {mayReview(a) && !a.pending && (
                      <button className="link text-[13px]" onClick={() => setReview(review === a.id ? null : a.id)}>
                        {review === a.id ? 'Hide' : 'Review'}
                      </button>
                    )}
                  </div>
                  {review === a.id && (
                    <div className="px-4 pb-4">
                      <AttemptReview questions={questions} attempt={a} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  const unanswered = drawn.filter((q) => {
    const v = answers[q.id]
    return q.type !== 'ordering' && (v == null || v === '' || (Array.isArray(v) && !v.length))
  }).length

  return (
    <div>
      {limit > 0 && (
        <div className={cx('sticky top-0 z-10 flex items-center gap-2 mb-5 py-2 text-[13.5px] bg-white', secondsLeft < 60 ? 'text-red-600 font-semibold' : 'text-ink-700')}>
          <Icon name="clock" className="w-[18px] h-[18px]" />
          Time remaining: {Math.floor((secondsLeft || 0) / 60)}:{String((secondsLeft || 0) % 60).padStart(2, '0')}
        </div>
      )}

      <ol className="space-y-7">
        {drawn.map((q, i) => (
          <li key={q.id}>
            <p className="text-[15px] font-medium mb-1 whitespace-pre-line">
              {i + 1}. {q.text}
            </p>
            <p className="hint mb-3">
              {QUESTION_LABEL[q.type] || ''}
              {q.type === 'multiple' ? ' · select all that apply' : ''}
              {q.type === 'ordering' ? ' · use the arrows to put the items in the right order' : ''}
            </p>
            <QuestionInput q={q} value={answers[q.id]} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />
          </li>
        ))}
      </ol>

      <div className="mt-8 pt-6 border-t border-line flex flex-wrap items-center gap-3">
        {confirming ? (
          <>
            <span className="text-[13.5px] text-amber-800">
              {unanswered} question{unanswered === 1 ? ' is' : 's are'} not answered. Hand in anyway?
            </span>
            <Button onClick={() => submit()}>Hand in</Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Keep working
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => (unanswered ? setConfirming(true) : submit())}>Submit test</Button>
            <Button variant="ghost" onClick={() => setDrawn(null)}>
              Cancel
            </Button>
            <span className="hint">Cancelling does not use an attempt.</span>
          </>
        )}
      </div>
    </div>
  )
}

function QuestionInput({ q, value, onChange }) {
  if (q.type === 'text') return <Textarea rows={4} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="Type your answer" />
  if (q.type === 'gap') return <Input value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="Your answer" className="max-w-md" />
  if (q.type === 'ordering') {
    const order = value || []
    const move = (i, d) => {
      const next = [...order]
      ;[next[i], next[i + d]] = [next[i + d], next[i]]
      onChange(next)
    }
    return (
      <ol className="space-y-2">
        {order.map((id, i) => (
          <li key={id} className="flex items-center gap-3 border border-line rounded-md px-3 py-2.5 bg-white">
            <span className="w-6 text-[13px] text-ink-500">{i + 1}.</span>
            <span className="flex-1 text-[14px]">{q.options.find((o) => o.id === id)?.text}</span>
            <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="p-1 rounded text-ink-500 hover:text-ink-900 disabled:opacity-30" aria-label="Move up">
              <Icon name="chevronUp" className="w-4 h-4" strokeWidth={2.2} />
            </button>
            <button type="button" disabled={i === order.length - 1} onClick={() => move(i, 1)} className="p-1 rounded text-ink-500 hover:text-ink-900 disabled:opacity-30" aria-label="Move down">
              <Icon name="chevronDown" className="w-4 h-4" strokeWidth={2.2} />
            </button>
          </li>
        ))}
      </ol>
    )
  }
  return (
    <div className="space-y-2.5">
      {(q.options || []).map((o) => {
        const checked = q.type === 'multiple' ? (value || []).includes(o.id) : value === o.id
        return (
          <label
            key={o.id}
            className={cx('flex items-center gap-3 border rounded-md px-4 py-3 cursor-pointer transition', checked ? 'border-brand-700 bg-brand-50/60' : 'border-line hover:bg-gray-50')}
          >
            {q.type === 'multiple' ? (
              <Checkbox checked={checked} onChange={(v) => onChange(v ? [...(value || []), o.id] : (value || []).filter((id) => id !== o.id))} />
            ) : (
              <Radio checked={checked} onChange={() => onChange(o.id)} />
            )}
            <span className="text-[14px]">{o.text}</span>
          </label>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ surveys */

const SCALE = [1, 2, 3, 4, 5]

function SurveyUnit({ unit, onComplete, onSubmitSurvey, completed, attempts = [] }) {
  const questions = unit.data?.questions || []
  const [answers, setAnswers] = useState({})
  const [missing, setMissing] = useState([])
  const mine = attempts.find((a) => a.kind === 'survey')
  const [sent, setSent] = useState(null)
  const given = sent || mine

  if (given || completed) {
    return (
      <div className="py-6">
        <div className="text-center">
          <Icon name="checkCircle" className="w-10 h-10 mx-auto text-emerald-600 mb-3" />
          <p className="text-[15px] font-medium">Thank you — your answers have been recorded.</p>
          {unit.data?.anonymous && <p className="hint mt-1">This survey is anonymous: instructors see the answers without your name.</p>}
        </div>
        {given && (
          <dl className="mt-6 space-y-3 max-w-2xl mx-auto">
            {questions.map((q) => (
              <div key={q.id} className="border border-line rounded-md px-4 py-3">
                <dt className="text-[13.5px] text-ink-500">{q.text}</dt>
                <dd className="text-[14px] mt-1 whitespace-pre-line">{surveyAnswerText(q, given.answers?.[q.id])}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    )
  }

  function send() {
    const gaps = questions.filter((q) => q.type !== 'text' && q.required !== false && (answers[q.id] == null || (Array.isArray(answers[q.id]) && !answers[q.id].length))).map((q) => q.id)
    setMissing(gaps)
    if (gaps.length) return
    const record = { id: uid('at'), kind: 'survey', answers, questionIds: questions.map((q) => q.id), at: new Date().toISOString() }
    setSent(record)
    if (onSubmitSurvey) onSubmitSurvey(record)
    else onComplete?.()
  }

  return (
    <div>
      {unit.data?.description && <div className="prose-unit text-[14.5px] leading-7 text-ink-700 mb-6" dangerouslySetInnerHTML={{ __html: unit.data.description }} />}
      {unit.data?.anonymous && <Note className="mb-6">This survey is anonymous: instructors see the answers without your name.</Note>}
      <ol className="space-y-7">
        {questions.map((q, i) => (
          <li key={q.id}>
            <p className={cx('text-[15px] font-medium mb-3', missing.includes(q.id) && 'text-red-700')}>
              {i + 1}. {q.text}
              {missing.includes(q.id) && <span className="font-normal text-[13px]"> — please answer this question</span>}
            </p>
            {q.type === 'text' ? (
              <Textarea rows={3} value={answers[q.id] || ''} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
            ) : q.type === 'rating' ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="hint mr-1">{q.low || 'Poor'}</span>
                {SCALE.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setAnswers({ ...answers, [q.id]: n })}
                    className={cx('w-11 h-11 rounded-md border text-[14px] font-medium transition', answers[q.id] === n ? 'bg-brand-700 border-brand-700 text-white' : 'border-line hover:bg-gray-50')}
                  >
                    {n}
                  </button>
                ))}
                <span className="hint ml-1">{q.high || 'Excellent'}</span>
              </div>
            ) : (
              <QuestionInput q={{ ...q, type: q.type === 'multiple' ? 'multiple' : 'single' }} value={answers[q.id]} onChange={(v) => setAnswers({ ...answers, [q.id]: v })} />
            )}
          </li>
        ))}
      </ol>
      {questions.length === 0 && <p className="hint">This survey has no questions yet.</p>}
      <div className="mt-8 pt-6 border-t border-line">
        <Button onClick={send} disabled={!questions.length && !onComplete}>
          Submit answers
        </Button>
      </div>
    </div>
  )
}

export function surveyAnswerText(q, value) {
  if (value == null || value === '' || (Array.isArray(value) && !value.length)) return '—'
  if (q.type === 'rating') return `${value} / 5`
  if (q.type === 'text') return String(value)
  const ids = Array.isArray(value) ? value : [value]
  return ids.map((id) => q.options?.find((o) => o.id === id)?.text || '?').join(', ')
}

/* -------------------------------------------------------------- assignments */

function AssignmentUnit({ unit, submissions = [], onSubmitAssignment, completed, enrollment }) {
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const latest = submissions[0] || null
  const due = assignmentDue(unit, enrollment)
  const onPass = assignmentCompletesOn(unit) === 'pass'
  const canHandIn = !latest || latest.status === 'returned'
  const late = due && Date.now() > due

  return (
    <div>
      {isHtml(unit.data?.instructions) ? (
        <div className="prose-unit text-[15px] leading-7 text-ink-900" dangerouslySetInnerHTML={{ __html: unit.data.instructions }} />
      ) : (
        <div className="prose-unit text-[15px] leading-7 text-ink-900 whitespace-pre-line">{unit.data?.instructions || 'No instructions have been added yet.'}</div>
      )}

      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-5 text-[13px] text-ink-500">
        {due ? (
          <span className={cx(late && !completed && 'text-red-700 font-medium')}>
            Due {formatDate(due)}
            {late && !completed ? ' — overdue' : ''}
          </span>
        ) : unit.data?.dueDays > 0 ? (
          <span>Due within {unit.data.dueDays} days of enrolling</span>
        ) : null}
        {onPass && <span>Pass mark {Number(unit.data?.passScore) || 0}% — completed once graded at or above it</span>}
        {!onPass && <span>Completed when you hand it in; your instructor grades it afterwards</span>}
      </div>

      {submissions.length > 0 && (
        <ul className="mt-7 space-y-3">
          {submissions.map((s, i) => (
            <li key={s.id} className="border border-line rounded-md p-5">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <Badge tone={s.status === 'graded' ? 'green' : s.status === 'returned' ? 'red' : 'amber'}>
                  {s.status === 'graded' ? `Graded — ${s.grade}%` : s.status === 'returned' ? 'Returned to you' : 'Awaiting instructor review'}
                </Badge>
                {s.late && <Badge tone="red">Handed in late</Badge>}
                <span className="hint">
                  {i === 0 ? 'Handed in' : 'Earlier version'} {formatDateTime(s.submittedAt)}
                </span>
              </div>
              {s.text && <p className="text-[14px] text-ink-700 leading-6 whitespace-pre-line">{s.text}</p>}
              {s.fileName && (
                <p className="text-[13px] text-ink-500 mt-2 flex items-center gap-2">
                  <Icon name="file" className="w-4 h-4" />
                  {s.fileName}
                </p>
              )}
              {s.feedback && (
                <p className="mt-4 pt-4 border-t border-line text-[14px] text-ink-700 whitespace-pre-line">
                  <span className="font-medium">Instructor feedback: </span>
                  {s.feedback}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {canHandIn && onSubmitAssignment && (
        <div className="mt-7">
          {latest?.status === 'returned' && <Note tone="warn" className="mb-4">Your instructor returned this assignment. Read the feedback above and hand it in again.</Note>}
          <Textarea rows={5} value={text} placeholder="Write your response" onChange={(e) => setText(e.target.value)} />
          {unit.data?.allowFileUpload && (
            <div className="flex items-center gap-3 mt-3">
              <label className="btn-ghost cursor-pointer">
                <Icon name="upload" className="w-[18px] h-[18px]" />
                Attach file
                <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </label>
              {file && <span className="text-[13px] text-ink-700">{file.name}</span>}
            </div>
          )}
          <Button
            className="mt-5"
            disabled={busy || (!text.trim() && !file)}
            onClick={async () => {
              setBusy(true)
              const ok = await onSubmitAssignment({ id: uid('sub'), text, file, late: !!late })
              setBusy(false)
              if (ok !== false) {
                setText('')
                setFile(null)
              }
            }}
          >
            {busy ? 'Handing in…' : latest ? 'Hand in again' : 'Submit assignment'}
          </Button>
        </div>
      )}

      {completed && (
        <p className="mt-6 text-[13.5px] text-emerald-700 flex items-center gap-2">
          <Icon name="checkCircle" className="w-[18px] h-[18px]" />
          Unit completed
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------ instructor-led training */

function sessionWhen(s) {
  if (!s.start) return 'Date to be confirmed'
  const start = formatDateTime(s.start)
  if (!s.end) return start
  const sameDay = new Date(s.start).toDateString() === new Date(s.end).toDateString()
  return `${start} – ${sameDay ? new Date(s.end).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : formatDateTime(s.end)}`
}

function IltUnit({ unit, completed, onJoinSession, registrations = [], sessionCounts = {}, onRegister, onCancelRegistration, courseName = '' }) {
  const sessions = [...(unit.data?.sessions || [])].sort((a, b) => (a.start || '9') < (b.start || '9') ? -1 : 1)
  const mine = registrations.filter((r) => r.unitId === unit.id)
  const holding = mine.find((r) => r.attended !== false) || null
  const onRegistration = iltCompletesOn(unit) === 'registration'
  const now = Date.now()

  return (
    <div>
      {unit.data?.description && <div className="prose-unit text-[14.5px] leading-7 text-ink-700 mb-5" dangerouslySetInnerHTML={{ __html: unit.data.description }} />}
      {onRegister && (
        <Note className="mb-5">
          {onRegistration
            ? 'Register for one of the sessions below. Registering completes this unit.'
            : 'Register for one of the sessions below. Your instructor records attendance, and the unit is completed once you are marked present.'}
        </Note>
      )}
      {sessions.length === 0 && <p className="hint">No sessions have been scheduled yet.</p>}
      <ul className="space-y-4">
        {sessions.map((s) => {
          const reg = mine.find((r) => r.sessionId === s.id)
          const seats = sessionSeats(s, Number(sessionCounts[s.id]) || 0)
          const started = s.start && new Date(s.start).getTime() <= now
          const online = !!(s.meetingUrl || s.meetingId)
          return (
            <li key={s.id} className={cx('border rounded-md p-5', reg && reg.attended !== false ? 'border-brand-700 bg-brand-50/40' : 'border-line')}>
              <div className="flex flex-wrap items-start gap-4">
                <span className="w-10 h-10 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                  <Icon name="calendar" className="w-5 h-5" />
                </span>
                <div className="flex-1 min-w-[200px]">
                  <p className="text-[15px] font-medium">{s.name || 'Session'}</p>
                  <p className="hint mt-1">{sessionWhen(s)}</p>
                  {s.location && (
                    <p className="text-[13.5px] text-ink-700 mt-2 flex items-center gap-2">
                      <Icon name="building" className="w-4 h-4" />
                      {s.location}
                    </p>
                  )}
                  {online && <p className="text-[13.5px] text-ink-700 mt-1.5 flex items-center gap-2"><Icon name="video" className="w-4 h-4" />Online</p>}
                  {s.instructor && <p className="text-[13px] text-ink-500 mt-1">Instructor: {s.instructor}</p>}

                  <div className="flex flex-wrap items-center gap-2.5 mt-3">
                    {reg?.attended === true && <Badge tone="green">Attended</Badge>}
                    {reg?.attended === false && <Badge tone="red">Marked absent</Badge>}
                    {reg && reg.attended == null && <Badge tone="blue">You are registered</Badge>}
                    {online && (reg || !onRegister) && onJoinSession && reg?.attended !== false && (
                      <Button size="sm" icon="video" onClick={() => onJoinSession(s)}>
                        Join online session
                      </Button>
                    )}
                    {reg && reg.attended == null && s.start && (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon="calendar"
                        onClick={() =>
                          download(
                            `${(s.name || 'session').replace(/[^\w-]+/g, '-')}.ics`,
                            icsFile([{ id: s.id, title: s.name || unit.name, subtitle: courseName, start: s.start, end: s.end, location: s.location, meetingUrl: s.meetingUrl }], { name: courseName }),
                            'text/calendar;charset=utf-8',
                          )
                        }
                      >
                        Add to my calendar
                      </Button>
                    )}
                    {reg && reg.attended == null && !started && onCancelRegistration && (
                      <Button size="sm" variant="ghost" onClick={() => onCancelRegistration(reg)}>
                        Cancel registration
                      </Button>
                    )}
                    {!reg && onRegister && !holding && !started && !seats.full && (
                      <Button size="sm" onClick={() => onRegister(s)}>
                        Register
                      </Button>
                    )}
                    {!reg && onRegister && !holding && started && <span className="hint">This session has started.</span>}
                  </div>
                </div>
                <Badge tone={seats.full ? 'red' : 'blue'}>{seats.capacity ? (seats.full ? 'Full' : `${seats.left} of ${seats.capacity} seats left`) : 'Open'}</Badge>
              </div>
            </li>
          )
        })}
      </ul>
      {!onRegister && sessions.length > 0 && <p className="hint mt-4">Sign in to register for a session.</p>}
      {completed && (
        <p className="mt-6 text-[13.5px] text-emerald-700 flex items-center gap-2">
          <Icon name="checkCircle" className="w-[18px] h-[18px]" />
          Unit completed
        </p>
      )}
    </div>
  )
}
