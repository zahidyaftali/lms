import { useEffect, useRef, useState } from 'react'
import { Button, Checkbox, Drawer, Icon, Input, OptionList, Select, Tabs, Toggle } from '../ui'
import CertificateView, { CERTIFICATE_TYPES } from './CertificateView'
import IntroVideo, { hasIntroVideo } from './IntroVideo'
import { toEmbedURL } from './media'
import { putFile } from '../../lib/fileStore'
import { publicCourseURL } from '../../lib/courseAccess'
import CustomFieldInputs, { customFieldErrors } from '../users/CustomFieldInputs'
import { COMPLETION_RULES } from '../../lib/rules.js'
import { sellsCourses } from '../../lib/commerce.js'
import { currencySymbol, cx, fileSize, fullName } from '../../lib/utils'

const TABS = [
  { value: 'info', label: 'Info' },
  { value: 'availability', label: 'Availability' },
  { value: 'limits', label: 'Limits' },
  { value: 'completion', label: 'Completion' },
]

const EMPTY_VIDEO = { source: 'youtube', url: '', fileId: null, fileName: '', fileSize: 0 }

/** Numbers are held as strings while editing so "0." or an empty box can be typed. */
function toDraft(course) {
  const text = (n) => (Number(n) > 0 ? String(n) : '')
  return {
    status: course.status === 'active' ? 'active' : 'inactive',
    code: course.code || '',
    categoryId: course.categoryId || '',
    introVideo: course.introVideo || null,
    price: text(course.price),
    instructorIds: course.instructorIds || [],
    level: course.level || 'All levels',
    cover: course.cover || 'default',
    showInCatalog: course.showInCatalog !== false,
    capacity: text(course.capacity),
    publicSharing: !!course.publicSharing,
    enrollmentRequest: course.enrollmentRequest !== false,
    timeMode: course.timeMode === 'timeframe' ? 'timeframe' : 'days',
    timeLimitDays: text(course.timeLimitDays),
    startDate: course.startDate || '',
    endDate: course.endDate || '',
    retainAccess: !!course.retainAccess,
    completionRule: course.completionRule || 'All units must be completed',
    certificateType: course.certificate ? course.certificateType || 'classic' : '',
    custom: course.custom || {},
  }
}

/**
 * Glancing at the other video tab must not lose the video: if the chosen
 * source is empty but the other one is filled in, the filled one is kept.
 */
function settleVideo(video) {
  if (!video) return null
  const url = video.url?.trim() || ''
  const hasFile = !!(video.fileId || video.src)
  if (!url && !hasFile) return null
  const source = video.source === 'file' ? (hasFile ? 'file' : 'youtube') : url ? 'youtube' : 'file'
  return { ...video, url, source }
}

/** Only the fields this panel owns go back to the course — never units or the name. */
function fromDraft(d) {
  const whole = (v) => Math.max(0, Math.floor(Number(v) || 0))
  return {
    status: d.status,
    published: d.status === 'active',
    code: d.code.trim(),
    categoryId: d.categoryId || null,
    introVideo: settleVideo(d.introVideo),
    price: Math.max(0, Math.round((Number(d.price) || 0) * 100) / 100),
    instructorIds: d.instructorIds,
    level: d.level,
    cover: d.cover,
    showInCatalog: d.showInCatalog,
    capacity: whole(d.capacity),
    publicSharing: d.publicSharing,
    enrollmentRequest: d.enrollmentRequest,
    timeMode: d.timeMode,
    timeLimitDays: whole(d.timeLimitDays),
    startDate: d.startDate,
    endDate: d.endDate,
    retainAccess: d.retainAccess,
    completionRule: d.completionRule,
    certificate: !!d.certificateType,
    certificateType: d.certificateType || null,
    custom: d.custom,
  }
}

function findProblems(d, takenCodes, customFields = []) {
  const problems = {}
  const missing = Object.entries(customFieldErrors(customFields, d.custom))[0]
  if (missing) problems.custom = { tab: 'info', message: missing[1], fields: customFieldErrors(customFields, d.custom) }
  const code = d.code.trim().toLowerCase()
  if (code && takenCodes.includes(code)) problems.code = { tab: 'info', message: 'Another course already uses this code.' }
  const video = d.introVideo
  if (video?.source === 'youtube' && video.url?.trim() && !toEmbedURL(video.url.trim())) {
    problems.video = { tab: 'info', message: 'That link isn’t a YouTube or Vimeo video.' }
  }
  if (d.timeMode === 'timeframe' && d.startDate && d.endDate && d.endDate < d.startDate) {
    problems.endDate = { tab: 'limits', message: 'The end date must be on or after the start date.' }
  }
  return problems
}

/**
 * "Course options" slide-over opened from the builder's settings button.
 * Mounted only while open, so every opening starts from the saved course.
 */
export default function CourseOptions({ open, ...props }) {
  if (!open) return null
  return <CourseOptionsDrawer {...props} />
}

function CourseOptionsDrawer({
  course,
  categories,
  instructors,
  enrolledCount,
  takenCodes = [],
  settings,
  onClose,
  onSave,
}) {
  const [tab, setTab] = useState('info')
  const [draft, setDraft] = useState(() => toDraft(course))
  const set = (changes) => setDraft((d) => ({ ...d, ...changes }))
  const problems = findProblems(draft, takenCodes, settings?.courses?.customFields)

  function save() {
    const first = Object.values(problems)[0]
    if (first) {
      setTab(first.tab)
      return
    }
    onSave(fromDraft(draft))
  }

  const shared = { draft, set, problems, course, settings }

  return (
    <Drawer
      open
      onClose={onClose}
      title="Course options"
      subtitle={course.name}
      width="max-w-[560px]"
      toolbar={<Tabs tabs={TABS} active={tab} onChange={setTab} />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save</Button>
        </>
      }
    >
      <div key={tab} className="animate-fade-in">
        {tab === 'info' && <InfoTab {...shared} categories={categories} instructors={instructors} />}
        {tab === 'availability' && <AvailabilityTab {...shared} enrolledCount={enrolledCount} />}
        {tab === 'limits' && <LimitsTab {...shared} />}
        {tab === 'completion' && <CompletionTab {...shared} />}
      </div>
    </Drawer>
  )
}

/* ------------------------------------------------------------------ tabs */

function InfoTab({ draft, set, problems, categories, instructors, settings }) {
  const selling = sellsCourses(settings)
  const video = draft.introVideo || EMPTY_VIDEO
  const setVideo = (changes) => set({ introVideo: { ...video, ...changes } })
  const hasVideo = !!(video.url || video.fileId || video.src)

  return (
    <>
      <Section icon="checkCircle" title="Activation status" hint="Activate the course to publish it and let learners take it.">
        <Toggle
          checked={draft.status === 'active'}
          onChange={(v) => set({ status: v ? 'active' : 'inactive' })}
          label="Activate course"
        />
      </Section>

      <Section icon="barcode" title="Code" hint="A unique identifier for the course. It also appears in certificate numbers.">
        <div className="max-w-[320px]">
          <Input
            value={draft.code}
            placeholder="Insert code"
            aria-label="Course code"
            onChange={(e) => set({ code: e.target.value })}
            className={cx(problems.code && 'border-red-400 focus:border-red-500 focus:ring-red-500/15')}
          />
        </div>
        <FieldError problem={problems.code} />
      </Section>

      <Section icon="list" title="Category" hint="Group the course with similar ones, e.g. Compliance or NCLEX Review.">
        <div className="max-w-[320px]">
          <Select value={draft.categoryId} aria-label="Category" onChange={(e) => set({ categoryId: e.target.value })}>
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </Section>

      <Section
        icon="play"
        title="Intro video"
        hint="Show a short preview video alongside the course description."
        action={
          hasVideo && (
            <button
              type="button"
              onClick={() => set({ introVideo: null })}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-700 hover:text-brand-800"
            >
              <Icon name="trash" className="w-4 h-4" />
              Clear
            </button>
          )
        }
      >
        <Segmented
          label="Video source"
          value={video.source}
          onChange={(source) => setVideo({ source })}
          options={[
            { value: 'youtube', label: 'YouTube video' },
            { value: 'file', label: 'Custom video' },
          ]}
        />

        <div className="mt-4">
          {video.source === 'youtube' ? (
            <>
              <Input
                value={video.url}
                placeholder="https://www.youtube.com/watch?v=…"
                aria-label="YouTube or Vimeo link"
                onChange={(e) => setVideo({ url: e.target.value })}
                className={cx(problems.video && 'border-red-400 focus:border-red-500 focus:ring-red-500/15')}
              />
              {problems.video ? (
                <FieldError problem={problems.video} />
              ) : (
                <p className="hint mt-1.5">Paste a YouTube or Vimeo link.</p>
              )}
            </>
          ) : (
            <VideoDropZone
              fileName={video.fileName}
              size={video.fileSize}
              onUploaded={(stored) =>
                setVideo({ fileId: stored.id, src: '', fileName: stored.name, fileSize: stored.size })
              }
            />
          )}
        </div>

        {hasIntroVideo(draft.introVideo) && <IntroVideo video={draft.introVideo} className="mt-4" />}
      </Section>

      <Section
        icon="banknote"
        title="Price"
        hint={
          selling
            ? 'Learners buy the course from the catalog at this price, less any discount or coupon. Leave empty for a free course.'
            : 'Shown to learners in the catalog. No way to pay is switched on yet (Account & Settings → E-commerce), so learners request the course and you enroll them.'
        }
      >
        <div className="flex max-w-[220px]">
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={draft.price}
            placeholder="0"
            aria-label="Price"
            onChange={(e) => set({ price: e.target.value })}
            className="field rounded-r-none"
          />
          <span className="h-11 px-3.5 flex items-center border border-l-0 border-[#d9dce2] rounded-r-md bg-gray-50 text-[14px] text-ink-700">
            {currencySymbol()}
          </span>
        </div>
      </Section>

      <Section icon="users" title="Instructors" hint="Instructors can edit the course and grade its learners.">
        {instructors.length === 0 ? (
          <p className="hint">No instructor accounts yet.</p>
        ) : (
          <OptionList columns={1}>
            {instructors.map((i) => (
              <Checkbox
                key={i.id}
                label={`${fullName(i)} · ${i.userType}`}
                checked={draft.instructorIds.includes(i.id)}
                onChange={(v) =>
                  set({
                    instructorIds: v
                      ? [...draft.instructorIds, i.id]
                      : draft.instructorIds.filter((id) => id !== i.id),
                  })
                }
              />
            ))}
          </OptionList>
        )}
      </Section>

      <Section icon="signal" title="Difficulty" hint="Shown as a tag on the course card.">
        <div className="max-w-[320px]">
          <Select value={draft.level} aria-label="Difficulty" onChange={(e) => set({ level: e.target.value })}>
            {['All levels', 'Beginner', 'Intermediate', 'Advanced'].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </Select>
        </div>
      </Section>

      <Section icon="image" title="Banner theme" hint="The accent used on the course banner.">
        <div className="max-w-[320px]">
          <Select value={draft.cover} aria-label="Banner theme" onChange={(e) => set({ cover: e.target.value })}>
            <option value="default">GA Healthcare (gold)</option>
            <option value="cna">Nursing Assistant</option>
            <option value="nclex">NCLEX Review</option>
            <option value="compliance">Compliance</option>
          </Select>
        </div>
      </Section>

      {(settings?.courses?.customFields || []).length > 0 && (
        <Section icon="list" title="More details" hint="The custom course fields set up in Account & Settings → Courses. Learners see them on the course's About page.">
          <div className="max-w-[420px]">
            <CustomFieldInputs
              fields={settings.courses.customFields}
              values={draft.custom}
              onChange={(custom) => set({ custom })}
              errors={problems.custom?.fields || {}}
              className="!mb-4"
            />
          </div>
        </Section>
      )}
    </>
  )
}

function AvailabilityTab({ draft, set, course, settings, enrolledCount }) {
  const selfEnrollAllowed = !!settings?.courses?.allowSelfEnrollment
  const capacity = Math.floor(Number(draft.capacity) || 0)
  const linkLive = course.publicSharing && course.status === 'active'

  return (
    <>
      <Section icon="book" title="Catalog visibility" hint="Set whether learners can find this course in the catalog.">
        <Toggle checked={draft.showInCatalog} onChange={(v) => set({ showInCatalog: v })} label="Show in catalog" />
      </Section>

      <Section
        icon="group"
        title="Capacity"
        hint="The most learners this course takes. Once it is full it leaves the catalog, but you can still enroll more learners yourself."
      >
        <div className="max-w-[320px]">
          <Input
            type="number"
            min="0"
            value={draft.capacity}
            placeholder="Set maximum number"
            aria-label="Maximum learners"
            onChange={(e) => set({ capacity: e.target.value })}
          />
        </div>
        <p className="hint mt-1.5">
          {capacity > 0
            ? `${enrolledCount} of ${capacity} places taken.`
            : `${enrolledCount} enrolled. Leave empty for no limit.`}
        </p>
      </Section>

      <Section
        icon="share"
        title="Public sharing"
        hint="Anyone with the link can take this course without an account. Guest progress stays in their own browser."
      >
        <Toggle checked={draft.publicSharing} onChange={(v) => set({ publicSharing: v })} label="Enable public sharing" />
        {draft.publicSharing && (
          <>
            <ShareLink url={publicCourseURL(course.id)} />
            {!linkLive && (
              <p className="hint mt-1.5">
                {draft.status === 'active'
                  ? 'The link starts working when you save.'
                  : 'The link starts working once the course is activated and saved.'}
              </p>
            )}
          </>
        )}
      </Section>

      <Section
        icon="hand"
        title="Enrollment request"
        hint="Learners ask to join from the catalog and wait for an administrator to approve them."
      >
        <Toggle
          checked={draft.enrollmentRequest}
          onChange={(v) => set({ enrollmentRequest: v })}
          label="Enable enrollment request"
        />
        {!draft.enrollmentRequest &&
          (selfEnrollAllowed ? (
            <p className="hint mt-2">Learners enroll themselves straight from the catalog.</p>
          ) : (
            <Note>
              Self-enrollment is switched off for the whole portal in Account &amp; Settings → Courses, so learners
              still request this course.
            </Note>
          ))}
      </Section>
    </>
  )
}

function LimitsTab({ draft, set, problems }) {
  return (
    <>
      <Section
        icon="clock"
        title="Time"
        hint={
          draft.timeMode === 'days'
            ? 'Give learners a set number of days to finish, counted from the day they enroll.'
            : 'Open the course between two dates. Learners can’t start before it opens and lose access when it closes.'
        }
      >
        <Segmented
          label="Time rule"
          value={draft.timeMode}
          onChange={(timeMode) => set({ timeMode })}
          options={[
            { value: 'days', label: 'Time limit' },
            { value: 'timeframe', label: 'Timeframe' },
          ]}
        />

        {draft.timeMode === 'days' ? (
          <div className="mt-4 max-w-[320px]">
            <label className="label" htmlFor="course-options-days">
              Number of days
            </label>
            <Input
              id="course-options-days"
              type="number"
              min="0"
              value={draft.timeLimitDays}
              placeholder="Set number of days"
              onChange={(e) => set({ timeLimitDays: e.target.value })}
            />
            <p className="hint mt-1.5">Leave empty for no time limit.</p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <label className="label" htmlFor="course-options-start">
                Start date
              </label>
              <Input
                id="course-options-start"
                type="date"
                value={draft.startDate}
                onChange={(e) => set({ startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="course-options-end">
                End date
              </label>
              <Input
                id="course-options-end"
                type="date"
                value={draft.endDate}
                min={draft.startDate || undefined}
                onChange={(e) => set({ endDate: e.target.value })}
                className={cx(problems.endDate && 'border-red-400 focus:border-red-500 focus:ring-red-500/15')}
              />
            </div>
            <p className="hint sm:col-span-2">Leave either date empty to keep that side open.</p>
            {problems.endDate && (
              <div className="sm:col-span-2 -mt-1.5">
                <FieldError problem={problems.endDate} />
              </div>
            )}
          </div>
        )}
      </Section>

      <Section
        icon="folderOpen"
        title="Access retention"
        hint="Let learners who complete the course keep its materials after their time limit or timeframe runs out."
      >
        <Toggle
          checked={draft.retainAccess}
          onChange={(v) => set({ retainAccess: v })}
          label="Activate access retention"
        />
      </Section>
    </>
  )
}

function CompletionTab({ draft, set, course, settings }) {
  return (
    <>
      <Section
        icon="checkSquare"
        title="Completion rule"
        hint={
          draft.completionRule === 'Instructor marks the course complete'
            ? 'Nobody completes this course by themselves: an instructor marks each learner complete from the Enrolled users panel.'
            : draft.completionRule === 'Only the final test must be passed'
              ? 'Passing the last test in the course completes it, whatever else is left. A course with no test falls back to all units.'
              : 'What counts as finishing this course.'
        }
      >
        <div className="max-w-[320px]">
          <Select
            value={draft.completionRule}
            aria-label="Completion rule"
            onChange={(e) => set({ completionRule: e.target.value })}
          >
            {COMPLETION_RULES.map((rule) => (
              <option key={rule}>{rule}</option>
            ))}
          </Select>
        </div>
      </Section>

      <Section
        icon="award"
        title="Certificate"
        hint={
          settings?.courses?.certificateEnabled === false
            ? 'Certificates are switched off for the whole portal in Account & Settings → Courses, so none is issued whatever is chosen here.'
            : 'The certificate learners receive when they complete the course.'
        }
      >
        <div className="max-w-[320px]">
          <label className="label" htmlFor="course-options-certificate">
            Type
          </label>
          <Select
            id="course-options-certificate"
            value={draft.certificateType}
            onChange={(e) => set({ certificateType: e.target.value })}
          >
            <option value="">No certificate</option>
            {CERTIFICATE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        {draft.certificateType && (
          <CertificatePreview type={draft.certificateType} course={course} code={draft.code} settings={settings} />
        )}
      </Section>
    </>
  )
}

/* ------------------------------------------------------------- building blocks */

function Section({ icon, title, hint, action, children }) {
  return (
    <section className="py-6 first:pt-1 border-b border-line last:border-b-0">
      <div className="flex items-start gap-3">
        <Icon name={icon} className="w-[18px] h-[18px] mt-[2px] shrink-0 text-ink-900" strokeWidth={1.7} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-[15px] leading-[22px] font-bold text-ink-900">{title}</h4>
            {action}
          </div>
          {hint && <p className="hint mt-0.5">{hint}</p>}
          <div className="mt-3.5">{children}</div>
        </div>
      </div>
    </section>
  )
}

/** Two-way switch drawn as a pair of buttons, as in "YouTube video / Custom video". */
function Segmented({ label, value, options, onChange }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-3">
      {options.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cx(
              'h-10 px-3 rounded-md border text-[14px] transition-colors',
              active
                ? 'bg-brand-100 border-brand-100 text-brand-800 font-semibold'
                : 'bg-white border-[#d9dce2] text-ink-700 hover:bg-gray-50',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function VideoDropZone({ fileName, size, onUploaded }) {
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function take(file) {
    if (!file) return
    if (!file.type.startsWith('video/')) {
      setError('Choose a video file, such as MP4, WebM or MOV.')
      return
    }
    setError('')
    setBusy(true)
    try {
      onUploaded(await putFile(file))
    } catch {
      setError('This browser could not store the video. Try a smaller file.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <label
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          take(e.dataTransfer.files?.[0])
        }}
        className={cx(
          'flex flex-col items-center justify-center gap-1 text-center rounded-md border px-4 py-7 cursor-pointer transition-colors',
          'focus-within:ring-2 focus-within:ring-brand-700/30',
          over ? 'border-brand-700 bg-brand-50' : 'border-brand-700/70 hover:bg-brand-50/60',
          busy && 'pointer-events-none opacity-70',
        )}
      >
        <Icon name="paperclip" className="w-5 h-5 text-brand-700 mb-1" />
        <span className="text-[13.5px] font-semibold text-brand-700">
          {busy ? 'Uploading…' : 'Select a file to upload'}
        </span>
        <span className="hint">or drag and drop your file here</span>
        <input
          type="file"
          accept="video/*"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            take(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </label>
      {error ? (
        <p className="text-[12.5px] text-red-600 mt-1.5">{error}</p>
      ) : (
        fileName && (
          <p className="hint mt-2 flex items-center gap-1.5 min-w-0">
            <Icon name="video" className="w-4 h-4 shrink-0" />
            <span className="truncate">{fileName}</span>
            {size ? <span className="shrink-0">· {fileSize(size)}</span> : null}
          </p>
        )
      )}
    </>
  )
}

function ShareLink({ url }) {
  const [copied, setCopied] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!copied) return undefined
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  function copy() {
    const fallback = () => inputRef.current?.select()
    if (!navigator.clipboard) return fallback()
    navigator.clipboard.writeText(url).then(() => setCopied(true), fallback)
  }

  return (
    <div className="mt-4 flex gap-2">
      <input
        ref={inputRef}
        readOnly
        value={url}
        aria-label="Public course link"
        onFocus={(e) => e.target.select()}
        className="field h-10 text-[13px] text-ink-700 bg-gray-50 min-w-0"
      />
      <Button size="sm" variant="outline" icon={copied ? 'check' : 'copy'} onClick={copy} className="h-10 shrink-0">
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  )
}

const SHEET_WIDTH = 760

/** The real certificate, zoomed down to fit the drawer. */
function CertificatePreview({ type, course, code, settings }) {
  const ref = useRef(null)
  const [scale, setScale] = useState(0.6)

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const measure = () => setScale(Math.min(1, el.clientWidth / SHEET_WIDTH))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="mt-5">
      <p className="label">Preview</p>
      <div className="rounded-md border border-line bg-[#f7f8fa] p-3 overflow-hidden">
        <div ref={ref}>
          <div style={{ width: SHEET_WIDTH, zoom: scale }} aria-hidden="true" className="pointer-events-none select-none">
            <CertificateView
              type={type}
              recipient="Learner name"
              courseName={course.name}
              issuedAt={new Date().toISOString()}
              code={`GA-${(code.trim() || 'CRS').toUpperCase()}-0000`}
              settings={settings}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function FieldError({ problem }) {
  if (!problem) return null
  return <p className="text-[12.5px] text-red-600 mt-1.5">{problem.message}</p>
}

function Note({ children }) {
  return (
    <p className="mt-3 flex gap-2.5 text-[13px] leading-5 text-ink-700 bg-[#f7f8fa] border border-line rounded-md px-3.5 py-2.5">
      <Icon name="info" className="w-[18px] h-[18px] shrink-0 text-brand-700" />
      <span>{children}</span>
    </p>
  )
}
