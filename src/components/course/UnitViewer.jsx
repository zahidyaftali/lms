import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Checkbox, Icon, Radio, Textarea } from '../ui'
import { getFileURL } from '../../lib/fileStore'
import { cx, formatDateTime, uid } from '../../lib/utils'

/** Resolves an IndexedDB file id into an object URL for the lifetime of the unit. */
function useFileURL(fileId) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let revoked = null
    let active = true
    if (fileId) {
      getFileURL(fileId).then((u) => {
        if (active) {
          setUrl(u)
          revoked = u
        } else if (u) URL.revokeObjectURL(u)
      })
    } else {
      setUrl(null)
    }
    return () => {
      active = false
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [fileId])
  return url
}

export default function UnitViewer({ unit, onComplete, completed, submission, onSubmitAssignment, onSubmitTest }) {
  if (!unit) return null

  switch (unit.type) {
    case 'content':
      return <ContentUnit unit={unit} onComplete={onComplete} completed={completed} />
    case 'webcontent':
      return <WebContentUnit unit={unit} onComplete={onComplete} completed={completed} />
    case 'video':
    case 'audio':
      return <MediaUnit unit={unit} onComplete={onComplete} completed={completed} />
    case 'document':
      return <DocumentUnit unit={unit} onComplete={onComplete} completed={completed} />
    case 'iframe':
      return <IframeUnit unit={unit} onComplete={onComplete} completed={completed} />
    case 'scorm':
      return <ScormUnit unit={unit} onComplete={onComplete} completed={completed} />
    case 'test':
      return <TestUnit unit={unit} onSubmitTest={onSubmitTest} completed={completed} />
    case 'survey':
      return <SurveyUnit unit={unit} onComplete={onComplete} completed={completed} />
    case 'assignment':
      return (
        <AssignmentUnit unit={unit} submission={submission} onSubmitAssignment={onSubmitAssignment} completed={completed} />
      )
    case 'ilt':
      return <IltUnit unit={unit} onComplete={onComplete} completed={completed} />
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
  return (
    <div className="mt-8 pt-6 border-t border-line">
      <Button icon="check" onClick={onComplete}>
        {label}
      </Button>
    </div>
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
        <video src={src} controls className="w-full rounded-md bg-black" onEnded={onComplete} />
      )}

      {src && !isVideo && <audio src={src} controls className="w-full" onEnded={onComplete} />}

      <CompleteBar onComplete={onComplete} completed={completed} />
    </div>
  )
}

function DocumentUnit({ unit, onComplete, completed }) {
  const url = useFileURL(unit.data?.fileId)
  const isPdf = (unit.data?.fileType || '').includes('pdf') || (unit.data?.fileName || '').endsWith('.pdf')

  return (
    <div>
      {!unit.data?.fileId && <p className="hint">No document has been uploaded for this unit yet.</p>}

      {url && isPdf && <iframe src={url} title={unit.name} className="w-full h-[70vh] rounded-md border border-line" />}

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
        <iframe
          src={unit.data.url}
          title={unit.name}
          style={{ height: unit.data.height || 520 }}
          className="w-full rounded-md border border-line"
        />
      ) : (
        <p className="hint">No embed URL has been set for this unit yet.</p>
      )}
      <CompleteBar onComplete={onComplete} completed={completed} />
    </div>
  )
}

function ScormUnit({ unit, onComplete, completed }) {
  return (
    <div>
      <div className="border border-line rounded-md px-5 py-6 text-center">
        <Icon name="package" className="w-8 h-8 mx-auto text-brand-700 mb-3" strokeWidth={1.4} />
        <p className="text-[14.5px] font-medium">{unit.data?.fileName || 'No package uploaded'}</p>
        <p className="hint mt-1.5">
          SCORM, xAPI and cmi5 packages are stored with the course. Launch them from a hosted player or mark the
          unit complete once finished.
        </p>
      </div>
      <CompleteBar onComplete={onComplete} completed={completed} />
    </div>
  )
}

function TestUnit({ unit, onSubmitTest, completed }) {
  const questions = unit.data?.questions || []
  const [started, setStarted] = useState(false)
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [secondsLeft, setSecondsLeft] = useState(null)

  const limit = unit.data?.timeLimitMin || 0

  useEffect(() => {
    if (!started || !limit) return undefined
    setSecondsLeft(limit * 60)
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timer)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [started, limit])

  const ordered = useMemo(() => {
    if (!unit.data?.shuffle) return questions
    return [...questions].sort(() => Math.random() - 0.5)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit.id, started])

  function grade() {
    let earned = 0
    let possible = 0
    const openAnswers = []

    questions.forEach((q) => {
      const points = q.points || 1
      if (q.type === 'text') {
        openAnswers.push({ question: q.text, answer: answers[q.id] || '' })
        return
      }
      possible += points
      const correctIds = q.options.filter((o) => o.correct).map((o) => o.id)
      const given = answers[q.id]
      const givenIds = Array.isArray(given) ? given : given ? [given] : []
      const exact =
        correctIds.length === givenIds.length && correctIds.every((id) => givenIds.includes(id))
      if (exact) earned += points
    })

    const score = possible ? Math.round((earned / possible) * 100) : 100
    const passed = score >= (unit.data?.passingScore || 0)
    const outcome = { score, passed, openAnswers }
    setResult(outcome)
    onSubmitTest?.(outcome)
  }

  if (result) {
    return (
      <div className="text-center py-8">
        <span
          className={cx(
            'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4',
            result.passed ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600',
          )}
        >
          <Icon name={result.passed ? 'checkCircle' : 'alert'} className="w-8 h-8" />
        </span>
        <p className="text-[22px] font-semibold">{result.score}%</p>
        <p className={cx('text-[14px] mt-1', result.passed ? 'text-emerald-700' : 'text-red-600')}>
          {result.passed
            ? 'Passed — well done.'
            : `Not passed. You need ${unit.data?.passingScore}% to pass this test.`}
        </p>
        {result.openAnswers.length > 0 && (
          <p className="hint mt-3">
            Your written answers have been sent to your instructor for review.
          </p>
        )}
        {!result.passed && (
          <Button
            className="mt-6"
            variant="outline"
            onClick={() => {
              setResult(null)
              setAnswers({})
              setStarted(false)
            }}
          >
            Try again
          </Button>
        )}
      </div>
    )
  }

  if (!started) {
    return (
      <div className="border border-line rounded-md px-6 py-8 text-center">
        <Icon name="clipboard" className="w-8 h-8 mx-auto text-brand-700 mb-3" strokeWidth={1.4} />
        <p className="text-[16px] font-semibold">{unit.name}</p>
        <ul className="hint mt-3 space-y-1">
          <li>{questions.length} questions</li>
          <li>Pass mark {unit.data?.passingScore || 0}%</li>
          <li>{limit ? `${limit} minute time limit` : 'No time limit'}</li>
          <li>{unit.data?.maxAttempts ? `${unit.data.maxAttempts} attempts allowed` : 'Unlimited attempts'}</li>
        </ul>
        <Button className="mt-6" disabled={!questions.length} onClick={() => setStarted(true)}>
          {completed ? 'Retake test' : 'Start test'}
        </Button>
        {!questions.length && <p className="hint mt-3">This test has no questions yet.</p>}
      </div>
    )
  }

  return (
    <div>
      {limit > 0 && (
        <div className="flex items-center gap-2 mb-5 text-[13.5px] text-ink-700">
          <Icon name="clock" className="w-[18px] h-[18px]" />
          Time remaining: {Math.floor((secondsLeft || 0) / 60)}:{String((secondsLeft || 0) % 60).padStart(2, '0')}
        </div>
      )}

      <ol className="space-y-7">
        {ordered.map((q, i) => (
          <li key={q.id}>
            <p className="text-[15px] font-medium mb-3">
              {i + 1}. {q.text}
              {q.type === 'multiple' && <span className="text-ink-500 font-normal"> (select all that apply)</span>}
            </p>

            {q.type === 'text' ? (
              <Textarea
                rows={3}
                value={answers[q.id] || ''}
                onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                placeholder="Type your answer"
              />
            ) : (
              <div className="space-y-2.5">
                {q.options.map((o) => {
                  const given = answers[q.id]
                  const checked = q.type === 'multiple' ? (given || []).includes(o.id) : given === o.id
                  return (
                    <label
                      key={o.id}
                      className={cx(
                        'flex items-center gap-3 border rounded-md px-4 py-3 cursor-pointer transition',
                        checked ? 'border-brand-700 bg-brand-50/60' : 'border-line hover:bg-gray-50',
                      )}
                    >
                      {q.type === 'multiple' ? (
                        <Checkbox
                          checked={checked}
                          onChange={(v) =>
                            setAnswers({
                              ...answers,
                              [q.id]: v
                                ? [...(given || []), o.id]
                                : (given || []).filter((id) => id !== o.id),
                            })
                          }
                        />
                      ) : (
                        <Radio checked={checked} onChange={() => setAnswers({ ...answers, [q.id]: o.id })} />
                      )}
                      <span className="text-[14px]">{o.text}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </li>
        ))}
      </ol>

      <div className="mt-8 pt-6 border-t border-line flex gap-3">
        <Button onClick={grade}>Submit test</Button>
        <Button variant="ghost" onClick={() => setStarted(false)}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

function SurveyUnit({ unit, onComplete, completed }) {
  const [answers, setAnswers] = useState({})
  const [sent, setSent] = useState(false)
  const questions = unit.data?.questions || []

  if (sent || completed) {
    return (
      <div className="text-center py-10">
        <Icon name="checkCircle" className="w-10 h-10 mx-auto text-emerald-600 mb-3" />
        <p className="text-[15px] font-medium">Thank you — your feedback has been recorded.</p>
      </div>
    )
  }

  return (
    <div>
      <ol className="space-y-7">
        {questions.map((q, i) => (
          <li key={q.id}>
            <p className="text-[15px] font-medium mb-3">
              {i + 1}. {q.text}
            </p>
            {q.type === 'text' ? (
              <Textarea
                rows={3}
                value={answers[q.id] || ''}
                onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
              />
            ) : (
              <div className="space-y-2.5">
                {q.options.map((o) => (
                  <label
                    key={o.id}
                    className={cx(
                      'flex items-center gap-3 border rounded-md px-4 py-3 cursor-pointer',
                      answers[q.id] === o.id ? 'border-brand-700 bg-brand-50/60' : 'border-line hover:bg-gray-50',
                    )}
                  >
                    <Radio checked={answers[q.id] === o.id} onChange={() => setAnswers({ ...answers, [q.id]: o.id })} />
                    <span className="text-[14px]">{o.text}</span>
                  </label>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
      {questions.length === 0 && <p className="hint">This survey has no questions yet.</p>}
      <div className="mt-8 pt-6 border-t border-line">
        <Button
          onClick={() => {
            setSent(true)
            onComplete()
          }}
        >
          Submit feedback
        </Button>
      </div>
    </div>
  )
}

function AssignmentUnit({ unit, submission, onSubmitAssignment, completed }) {
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)

  return (
    <div>
      <div className="prose-unit text-[15px] leading-7 text-ink-900 whitespace-pre-line">
        {unit.data?.instructions || 'No instructions have been added yet.'}
      </div>

      <div className="flex flex-wrap gap-4 mt-5 text-[13px] text-ink-500">
        <span>Due within {unit.data?.dueDays || 0} days</span>
        <span>Maximum score {unit.data?.maxScore || 100}</span>
      </div>

      {submission ? (
        <div className="mt-7 border border-line rounded-md p-5">
          <div className="flex items-center gap-3 mb-3">
            <Badge tone={submission.status === 'graded' ? 'green' : 'amber'}>
              {submission.status === 'graded' ? `Graded — ${submission.grade}%` : 'Awaiting instructor review'}
            </Badge>
            <span className="hint">Submitted {formatDateTime(submission.submittedAt)}</span>
          </div>
          {submission.text && <p className="text-[14px] text-ink-700 leading-6">{submission.text}</p>}
          {submission.fileName && (
            <p className="text-[13px] text-ink-500 mt-2 flex items-center gap-2">
              <Icon name="file" className="w-4 h-4" />
              {submission.fileName}
            </p>
          )}
          {submission.feedback && (
            <p className="mt-4 pt-4 border-t border-line text-[14px] text-ink-700">
              <span className="font-medium">Instructor feedback: </span>
              {submission.feedback}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-7">
          <Textarea
            rows={4}
            value={text}
            placeholder="Write your response"
            onChange={(e) => setText(e.target.value)}
          />
          {unit.data?.allowFileUpload && (
            <div className="flex items-center gap-3 mt-3">
              <label className="btn-ghost cursor-pointer">
                <Icon name="upload" className="w-[18px] h-[18px]" />
                Attach file
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
              {file && <span className="text-[13px] text-ink-700">{file.name}</span>}
            </div>
          )}
          <Button
            className="mt-5"
            disabled={!text.trim() && !file}
            onClick={() => onSubmitAssignment({ id: uid('sub'), text, file })}
          >
            Submit assignment
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

function IltUnit({ unit, onComplete, completed }) {
  const sessions = unit.data?.sessions || []
  return (
    <div>
      {sessions.length === 0 && <p className="hint">No sessions have been scheduled yet.</p>}
      <ul className="space-y-4">
        {sessions.map((s) => (
          <li key={s.id} className="border border-line rounded-md p-5">
            <div className="flex items-start gap-4">
              <span className="w-10 h-10 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                <Icon name="calendar" className="w-5 h-5" />
              </span>
              <div className="flex-1">
                <p className="text-[15px] font-medium">{s.name || 'Session'}</p>
                <p className="hint mt-1">{s.start ? formatDateTime(s.start) : 'Date to be confirmed'}</p>
                {s.location && (
                  <p className="text-[13.5px] text-ink-700 mt-2 flex items-center gap-2">
                    <Icon name="building" className="w-4 h-4" />
                    {s.location}
                  </p>
                )}
                {s.instructor && <p className="text-[13px] text-ink-500 mt-1">Instructor: {s.instructor}</p>}
              </div>
              <Badge tone="blue">{s.capacity ? `${s.capacity} seats` : 'Open'}</Badge>
            </div>
          </li>
        ))}
      </ul>
      <CompleteBar onComplete={onComplete} completed={completed} label="Mark attendance complete" />
    </div>
  )
}

function toEmbedURL(url) {
  if (!url) return null
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  const vimeo = url.match(/vimeo\.com\/(\d+)/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`
  return null
}
