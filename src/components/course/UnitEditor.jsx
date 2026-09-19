import { useEffect, useState } from 'react'
import {
  Badge,
  Button,
  Checkbox,
  Drawer,
  Field,
  Icon,
  Input,
  Radio,
  Select,
  Textarea,
  Toggle,
} from '../ui'
import RichText from './RichText'
import { DEFAULT_UNIT_DATA, unitLabel } from './unitTypes'
import { putFile } from '../../lib/fileStore'
import { fileSize, uid } from '../../lib/utils'

export default function UnitEditor({ open, unit, onClose, onSave }) {
  const [name, setName] = useState('')
  const [data, setData] = useState({})

  useEffect(() => {
    if (!unit) return
    setName(unit.name || '')
    setData({ ...(DEFAULT_UNIT_DATA[unit.type] || {}), ...(unit.data || {}) })
  }, [unit])

  if (!unit) return null

  const set = (changes) => setData((d) => ({ ...d, ...changes }))

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Edit ${unitLabel(unit.type).toLowerCase()}`}
      subtitle="Changes are saved to the course when you click Save."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave({ name: name.trim() || 'Untitled unit', data })}>Save</Button>
        </>
      }
    >
      <Field label="Unit name" required>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>

      {unit.type === 'content' && (
        <Field label="Lesson content">
          <RichText value={data.html} onChange={(html) => set({ html })} />
        </Field>
      )}

      {unit.type === 'webcontent' && (
        <>
          <Field label="Web address" hint="Learners open this resource from inside the course.">
            <Input value={data.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://" />
          </Field>
          <Toggle
            checked={data.openInNewTab}
            onChange={(v) => set({ openInNewTab: v })}
            label="Open in a new tab"
          />
        </>
      )}

      {(unit.type === 'video' || unit.type === 'audio') && (
        <MediaFields type={unit.type} data={data} set={set} />
      )}

      {unit.type === 'document' && (
        <UploadField
          label="Presentation or document"
          hint="PDF, PowerPoint or Word. Learners read it inside the course."
          accept=".pdf,.ppt,.pptx,.doc,.docx"
          data={data}
          set={set}
        />
      )}

      {unit.type === 'scorm' && (
        <UploadField
          label="SCORM / xAPI / cmi5 package"
          hint="Upload the .zip export from your authoring tool."
          accept=".zip"
          data={data}
          set={set}
        />
      )}

      {unit.type === 'iframe' && (
        <>
          <Field label="Embed URL" hint="Any page that allows embedding, e.g. a virtual lab or a form.">
            <Input value={data.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://" />
          </Field>
          <Field label="Frame height (px)">
            <Input type="number" value={data.height} onChange={(e) => set({ height: Number(e.target.value) })} />
          </Field>
        </>
      )}

      {unit.type === 'test' && <TestEditor data={data} set={set} />}
      {unit.type === 'survey' && <SurveyEditor data={data} set={set} />}

      {unit.type === 'assignment' && (
        <>
          <Field label="Instructions">
            <Textarea rows={5} value={data.instructions} onChange={(e) => set({ instructions: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-x-5">
            <Field label="Due within (days)">
              <Input type="number" value={data.dueDays} onChange={(e) => set({ dueDays: Number(e.target.value) })} />
            </Field>
            <Field label="Maximum score">
              <Input type="number" value={data.maxScore} onChange={(e) => set({ maxScore: Number(e.target.value) })} />
            </Field>
          </div>
          <Toggle
            checked={data.allowFileUpload}
            onChange={(v) => set({ allowFileUpload: v })}
            label="Allow file upload"
            hint="Learners can attach a signed log, photo or document."
          />
        </>
      )}

      {unit.type === 'ilt' && <IltEditor data={data} set={set} />}

      {unit.type === 'section' && (
        <p className="hint">
          A section groups the units that follow it. Learners see it as a heading in the course outline.
        </p>
      )}
    </Drawer>
  )
}

function MediaFields({ type, data, set }) {
  const [busy, setBusy] = useState(false)
  return (
    <>
      <Field label="Source">
        <div className="flex gap-6">
          <Radio checked={data.source === 'url'} onChange={() => set({ source: 'url' })} label="Link (YouTube, Vimeo, direct URL)" />
          <Radio checked={data.source === 'file'} onChange={() => set({ source: 'file' })} label="Upload file" />
        </div>
      </Field>

      {data.source === 'url' ? (
        <Field label={`${type === 'video' ? 'Video' : 'Audio'} URL`}>
          <Input value={data.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://" />
        </Field>
      ) : (
        <Field label="File" hint={`Stored in this browser's local media library.${busy ? ' Uploading…' : ''}`}>
          <div className="flex items-center gap-3">
            <label className="btn-ghost cursor-pointer">
              <Icon name="upload" className="w-[18px] h-[18px]" />
              Choose {type} file
              <input
                type="file"
                accept={type === 'video' ? 'video/*' : 'audio/*'}
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setBusy(true)
                  const stored = await putFile(file)
                  set({ fileId: stored.id, fileName: stored.name, fileSize: stored.size })
                  setBusy(false)
                  e.target.value = ''
                }}
              />
            </label>
            {data.fileName && (
              <span className="text-[13px] text-ink-700">
                {data.fileName} {data.fileSize ? `(${fileSize(data.fileSize)})` : ''}
              </span>
            )}
          </div>
        </Field>
      )}

      {type === 'video' && (
        <Field label="Length (minutes)">
          <Input type="number" value={data.durationMin} onChange={(e) => set({ durationMin: Number(e.target.value) })} />
        </Field>
      )}
    </>
  )
}

function UploadField({ label, hint, accept, data, set }) {
  const [busy, setBusy] = useState(false)
  return (
    <Field label={label} hint={busy ? 'Uploading…' : hint}>
      <div className="flex items-center gap-3 flex-wrap">
        <label className="btn-ghost cursor-pointer">
          <Icon name="upload" className="w-[18px] h-[18px]" />
          Choose file
          <input
            type="file"
            accept={accept}
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              setBusy(true)
              const stored = await putFile(file)
              set({ fileId: stored.id, fileName: stored.name, fileType: stored.type, fileSize: stored.size })
              setBusy(false)
              e.target.value = ''
            }}
          />
        </label>
        {data.fileName && (
          <span className="inline-flex items-center gap-2 text-[13px] text-ink-700">
            <Icon name="file" className="w-4 h-4" />
            {data.fileName} {data.fileSize ? `· ${fileSize(data.fileSize)}` : ''}
          </span>
        )}
      </div>
    </Field>
  )
}

function TestEditor({ data, set }) {
  const questions = data.questions || []

  const addQuestion = (type) =>
    set({
      questions: [
        ...questions,
        {
          id: uid('q'),
          type,
          text: '',
          points: 1,
          options:
            type === 'truefalse'
              ? [
                  { id: uid('o'), text: 'True', correct: true },
                  { id: uid('o'), text: 'False', correct: false },
                ]
              : type === 'text'
                ? []
                : [
                    { id: uid('o'), text: '', correct: true },
                    { id: uid('o'), text: '', correct: false },
                  ],
        },
      ],
    })

  const updateQuestion = (id, changes) =>
    set({ questions: questions.map((q) => (q.id === id ? { ...q, ...changes } : q)) })

  const removeQuestion = (id) => set({ questions: questions.filter((q) => q.id !== id) })

  return (
    <>
      <div className="grid grid-cols-2 gap-x-5">
        <Field label="Passing score (%)">
          <Input type="number" value={data.passingScore} onChange={(e) => set({ passingScore: Number(e.target.value) })} />
        </Field>
        <Field label="Time limit (minutes)" hint="0 = no limit">
          <Input type="number" value={data.timeLimitMin} onChange={(e) => set({ timeLimitMin: Number(e.target.value) })} />
        </Field>
        <Field label="Maximum attempts" hint="0 = unlimited">
          <Input type="number" value={data.maxAttempts} onChange={(e) => set({ maxAttempts: Number(e.target.value) })} />
        </Field>
        <Field label="Question order">
          <Select value={data.shuffle ? 'shuffle' : 'fixed'} onChange={(e) => set({ shuffle: e.target.value === 'shuffle' })}>
            <option value="fixed">As listed</option>
            <option value="shuffle">Shuffle for each attempt</option>
          </Select>
        </Field>
      </div>

      <div className="flex items-center justify-between gap-4 mb-3 mt-2">
        <h4 className="text-[15px] font-semibold">Questions ({questions.length})</h4>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="ghost" onClick={() => addQuestion('single')}>
            + Single choice
          </Button>
          <Button size="sm" variant="ghost" onClick={() => addQuestion('multiple')}>
            + Multiple
          </Button>
          <Button size="sm" variant="ghost" onClick={() => addQuestion('truefalse')}>
            + True/False
          </Button>
          <Button size="sm" variant="ghost" onClick={() => addQuestion('text')}>
            + Free text
          </Button>
        </div>
      </div>

      {questions.length === 0 && (
        <p className="hint border border-dashed border-line rounded-md px-4 py-6 text-center">
          No questions yet — add one above.
        </p>
      )}

      <ol className="space-y-4">
        {questions.map((q, index) => (
          <li key={q.id} className="border border-line rounded-md p-4">
            <div className="flex items-start gap-3 mb-3">
              <span className="w-7 h-7 rounded-full bg-brand-50 text-brand-700 text-[13px] font-semibold flex items-center justify-center shrink-0">
                {index + 1}
              </span>
              <Badge tone="blue">
                {q.type === 'single'
                  ? 'Single choice'
                  : q.type === 'multiple'
                    ? 'Multiple choice'
                    : q.type === 'truefalse'
                      ? 'True / False'
                      : 'Free text'}
              </Badge>
              <span className="flex-1" />
              <button onClick={() => removeQuestion(q.id)} className="text-ink-400 hover:text-red-600">
                <Icon name="trash" className="w-[18px] h-[18px]" />
              </button>
            </div>

            <Textarea
              rows={2}
              value={q.text}
              placeholder="Question text"
              onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
              className="mb-3"
            />

            {q.type !== 'text' && (
              <div className="space-y-2.5">
                {q.options.map((o) => (
                  <div key={o.id} className="flex items-center gap-3">
                    <Checkbox
                      checked={o.correct}
                      onChange={(checked) =>
                        updateQuestion(q.id, {
                          options: q.options.map((x) =>
                            x.id === o.id
                              ? { ...x, correct: checked }
                              : q.type === 'single' || q.type === 'truefalse'
                                ? { ...x, correct: false }
                                : x,
                          ),
                        })
                      }
                    />
                    <Input
                      value={o.text}
                      placeholder="Answer option"
                      onChange={(e) =>
                        updateQuestion(q.id, {
                          options: q.options.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)),
                        })
                      }
                      className="h-10"
                    />
                    {q.type !== 'truefalse' && q.options.length > 2 && (
                      <button
                        onClick={() => updateQuestion(q.id, { options: q.options.filter((x) => x.id !== o.id) })}
                        className="text-ink-400 hover:text-red-600 shrink-0"
                      >
                        <Icon name="x" className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                {q.type !== 'truefalse' && (
                  <button
                    onClick={() =>
                      updateQuestion(q.id, { options: [...q.options, { id: uid('o'), text: '', correct: false }] })
                    }
                    className="link text-[13px]"
                  >
                    + Add option
                  </button>
                )}
                <p className="hint pt-1">Tick the option(s) that count as correct.</p>
              </div>
            )}

            {q.type === 'text' && (
              <p className="hint">Free-text answers are reviewed by the instructor from the Grading page.</p>
            )}

            <div className="mt-3 flex items-center gap-3">
              <span className="text-[13px] text-ink-500">Points</span>
              <Input
                type="number"
                min="0"
                value={q.points}
                onChange={(e) => updateQuestion(q.id, { points: Number(e.target.value) })}
                className="h-9 w-24"
              />
            </div>
          </li>
        ))}
      </ol>
    </>
  )
}

function SurveyEditor({ data, set }) {
  const questions = data.questions || []
  const update = (id, changes) =>
    set({ questions: questions.map((q) => (q.id === id ? { ...q, ...changes } : q)) })

  return (
    <>
      <div className="flex items-center justify-between gap-4 mb-3">
        <h4 className="text-[15px] font-semibold">Survey questions ({questions.length})</h4>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              set({
                questions: [
                  ...questions,
                  { id: uid('sq'), type: 'single', text: '', options: [{ id: uid('o'), text: '' }] },
                ],
              })
            }
          >
            + Choice
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => set({ questions: [...questions, { id: uid('sq'), type: 'text', text: '', options: [] }] })}
          >
            + Open answer
          </Button>
        </div>
      </div>

      <ol className="space-y-4">
        {questions.map((q, i) => (
          <li key={q.id} className="border border-line rounded-md p-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[13px] text-ink-500">Question {i + 1}</span>
              <Badge>{q.type === 'text' ? 'Open answer' : 'Choice'}</Badge>
              <span className="flex-1" />
              <button
                onClick={() => set({ questions: questions.filter((x) => x.id !== q.id) })}
                className="text-ink-400 hover:text-red-600"
              >
                <Icon name="trash" className="w-[18px] h-[18px]" />
              </button>
            </div>
            <Input
              value={q.text}
              placeholder="Question text"
              onChange={(e) => update(q.id, { text: e.target.value })}
              className="mb-3"
            />
            {q.type === 'single' && (
              <div className="space-y-2.5">
                {q.options.map((o) => (
                  <Input
                    key={o.id}
                    value={o.text}
                    placeholder="Option"
                    className="h-10"
                    onChange={(e) =>
                      update(q.id, { options: q.options.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)) })
                    }
                  />
                ))}
                <button
                  onClick={() => update(q.id, { options: [...q.options, { id: uid('o'), text: '' }] })}
                  className="link text-[13px]"
                >
                  + Add option
                </button>
              </div>
            )}
          </li>
        ))}
      </ol>
    </>
  )
}

function IltEditor({ data, set }) {
  const sessions = data.sessions || []
  const update = (id, changes) =>
    set({ sessions: sessions.map((s) => (s.id === id ? { ...s, ...changes } : s)) })

  return (
    <>
      <div className="flex items-center justify-between gap-4 mb-3">
        <h4 className="text-[15px] font-semibold">Sessions ({sessions.length})</h4>
        <Button
          size="sm"
          variant="ghost"
          icon="plus"
          onClick={() =>
            set({
              sessions: [
                ...sessions,
                { id: uid('s'), name: '', start: '', end: '', location: '', capacity: 12, instructor: '' },
              ],
            })
          }
        >
          Add session
        </Button>
      </div>

      {sessions.length === 0 && (
        <p className="hint border border-dashed border-line rounded-md px-4 py-6 text-center">
          Add the classroom or clinical sessions learners must attend.
        </p>
      )}

      <ul className="space-y-4">
        {sessions.map((s) => (
          <li key={s.id} className="border border-line rounded-md p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] text-ink-500">Session</span>
              <button
                onClick={() => set({ sessions: sessions.filter((x) => x.id !== s.id) })}
                className="text-ink-400 hover:text-red-600"
              >
                <Icon name="trash" className="w-[18px] h-[18px]" />
              </button>
            </div>
            <Field label="Name">
              <Input value={s.name} onChange={(e) => update(s.id, { name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-x-5">
              <Field label="Starts">
                <Input
                  type="datetime-local"
                  value={toLocalInput(s.start)}
                  onChange={(e) => update(s.id, { start: e.target.value })}
                />
              </Field>
              <Field label="Ends">
                <Input
                  type="datetime-local"
                  value={toLocalInput(s.end)}
                  onChange={(e) => update(s.id, { end: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Location">
              <Input value={s.location} onChange={(e) => update(s.id, { location: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-x-5">
              <Field label="Capacity">
                <Input type="number" value={s.capacity} onChange={(e) => update(s.id, { capacity: Number(e.target.value) })} />
              </Field>
              <Field label="Instructor">
                <Input value={s.instructor} onChange={(e) => update(s.id, { instructor: e.target.value })} />
              </Field>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

function toLocalInput(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
