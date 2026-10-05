import { useState } from 'react'
import {
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  DataTable,
  Drawer,
  EmptyState,
  Field,
  Input,
  MenuItem,
  OptionList,
  PageHeader,
  SearchInput,
  Select,
  SetupNote,
  Toggle,
} from '../../components/ui'
import { useData } from '../../context/DataContext'
import { useToast } from '../../context/ToastContext'
import { formatDate, formatDateTime, plural } from '../../lib/utils'

/**
 * What an automation can do. `needs` lists the inputs the rule takes:
 * course (X), hours (Z), targets (courses Y), score (K–L), days, points, url.
 */
const RULES = [
  { id: 'assign_after_assignment', label: 'After a course is assigned, assign more courses', needs: ['course', 'hours', 'targets'] },
  { id: 'assign_after_completion', label: 'After a course is completed, assign more courses', needs: ['course', 'hours', 'targets'] },
  { id: 'assign_after_score', label: 'After a course is completed with a score in a range, assign courses', needs: ['course', 'hours', 'score', 'targets'] },
  { id: 'assign_after_failure', label: 'After a course is failed, assign courses', needs: ['course', 'hours', 'targets'] },
  { id: 'assign_before_expiry', label: 'Before a course expires, assign courses', needs: ['course', 'hours', 'targets'] },
  { id: 'reassign_after_certificate', label: 'After a certificate expires, reset and assign courses', needs: ['course', 'hours', 'targets'] },
  { id: 'reassign_before_certificate', label: 'Before a certificate expires, reset and assign courses', needs: ['course', 'hours', 'targets'] },
  { id: 'assign_after_creation', label: 'After a user is created, assign courses', needs: ['hours', 'targets'] },
  { id: 'deactivate_after_completion', label: 'After a course is completed, deactivate the user', needs: ['course', 'hours'] },
  { id: 'deactivate_after_creation', label: 'After a user is created, deactivate the user', needs: ['hours'] },
  { id: 'deactivate_inactive', label: 'Deactivate users who have not signed in', needs: ['days'] },
  { id: 'points_on_completion', label: 'When a course is completed, give points', needs: ['course', 'points'] },
  { id: 'url_on_completion', label: 'When a course is completed, call a web address', needs: ['course', 'url'] },
]

const BEFORE = ['assign_before_expiry', 'reassign_before_certificate']

const empty = {
  name: '',
  rule: RULES[1].id,
  courseId: '',
  hours: 0,
  targetCourseIds: [],
  scoreMin: 0,
  scoreMax: 100,
  days: 90,
  points: 100,
  url: '',
  active: true,
}

export default function Automations() {
  const { automations = [], courses, jobs = [], settings, backend, actions } = useData()
  const [checking, setChecking] = useState(false)
  const waiting = (a) => jobs.filter((j) => j.automationId === a.id && j.status === 'pending').length
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState(empty)
  const [problem, setProblem] = useState('')
  const [confirm, setConfirm] = useState(null)

  const ruleOf = (a) => RULES.find((r) => r.id === a.rule) || RULES[0]
  const courseName = (id) => courses.find((c) => c.id === id)?.name || 'a deleted course'
  const change = (changes) => {
    setDraft((d) => ({ ...d, ...changes }))
    setProblem('')
  }

  /** The rule as a sentence, e.g. "24 hours after CNA is completed, assign NCLEX PN". */
  function describe(a) {
    const x = courseName(a.courseId)
    const y = (a.targetCourseIds || []).map(courseName).join(', ') || 'no courses'
    const after = (event) => (a.hours > 0 ? `${plural(a.hours, 'hour')} after ${event}` : `When ${event}`)
    const before = (event) => `${plural(Math.max(1, a.hours), 'hour')} before ${event}`
    switch (a.rule) {
      case 'assign_after_assignment':
        return `${after(`${x} is assigned`)}, assign ${y}`
      case 'assign_after_completion':
        return `${after(`${x} is completed`)}, assign ${y}`
      case 'assign_after_score':
        return `${after(`${x} is completed with a score of ${a.scoreMin}–${a.scoreMax}%`)}, assign ${y}`
      case 'assign_after_failure':
        return `${after(`${x} is failed`)}, assign ${y}`
      case 'assign_before_expiry':
        return `${before(`${x} expires`)}, assign ${y}`
      case 'reassign_after_certificate':
        return `${after(`the certificate for ${x} expires`)}, reset progress and assign ${y}`
      case 'reassign_before_certificate':
        return `${before(`the certificate for ${x} expires`)}, reset progress and assign ${y}`
      case 'assign_after_creation':
        return `${after('a user is created')}, assign ${y}`
      case 'deactivate_after_completion':
        return `${after(`${x} is completed`)}, deactivate the user`
      case 'deactivate_after_creation':
        return `${after('a user is created')}, deactivate the user`
      case 'deactivate_inactive':
        return `Deactivate users who have not signed in for ${plural(a.days, 'day')}`
      case 'points_on_completion':
        return `When ${x} is completed, give ${plural(a.points, 'point')}`
      case 'url_on_completion':
        return `When ${x} is completed, call ${a.url}`
      default:
        return '-'
    }
  }

  function open(automation) {
    setEditing(automation || { id: null })
    setDraft(automation ? { ...empty, ...automation } : { ...empty })
    setProblem('')
  }

  function save() {
    const needs = ruleOf(draft).needs
    // A course cannot be assigned as a result of itself.
    const targetCourseIds = draft.targetCourseIds.filter((id) => !needs.includes('course') || id !== draft.courseId)
    const missing = !draft.name.trim()
      ? 'Give the automation a name.'
      : needs.includes('course') && !draft.courseId
        ? 'Choose the course this automation watches.'
        : needs.includes('targets') && !targetCourseIds.length
          ? 'Choose at least one course to assign.'
          : needs.includes('url') && !/^https?:\/\/\S+$/.test(draft.url.trim())
            ? 'Enter a web address that starts with http:// or https://.'
            : needs.includes('score') && draft.scoreMin > draft.scoreMax
              ? 'The lowest score cannot be above the highest score.'
              : ''
    if (missing) {
      setProblem(missing)
      return
    }
    const record = {
      ...draft,
      name: draft.name.trim(),
      url: draft.url.trim(),
      targetCourseIds,
      hours: BEFORE.includes(draft.rule) ? Math.max(1, draft.hours) : draft.hours,
    }
    if (editing.id) {
      actions.automations.update(editing.id, record)
      toast('Automation updated.')
    } else {
      actions.automations.add(record)
      toast('Automation created.')
    }
    setEditing(null)
  }

  const rows = automations.filter((a) => `${a.name} ${describe(a)}`.toLowerCase().includes(query.trim().toLowerCase()))
  const needs = ruleOf(draft).needs
  const number = (key, min = 0) => (e) => change({ [key]: Math.max(min, Number(e.target.value) || 0) })

  return (
    <div>
      <PageHeader title="Automations" subtitle="Rules that assign courses or tidy up accounts when something happens.">
        <Button icon="plus" onClick={() => open(null)}>
          Add automation
        </Button>
      </PageHeader>

      <SetupNote>
        Active automations run by themselves. Ones that follow an event (a course completed, a user created) act as it happens, or after the hours you
        set. Ones that watch the clock (expiry, inactivity) are checked {backend.mode === 'server' ? 'every few minutes while the portal is in use and once a day otherwise' : 'every few minutes while the portal is open in this browser'}.{' '}
        <button
          type="button"
          className="link"
          disabled={checking}
          onClick={async () => {
            setChecking(true)
            const res = await actions.runEngine()
            setChecking(false)
            toast(res.ok ? (res.changed ? 'Checked: due automations have run.' : 'Checked: nothing was due.') : res.error, res.ok ? 'success' : 'error')
          }}
        >
          {checking ? 'Checking…' : 'Check now'}
        </button>
      </SetupNote>

      <SearchInput value={query} onChange={setQuery} className="w-[250px] mb-5" />

      <DataTable
        rows={rows}
        empty={
          <EmptyState
            icon="bolt"
            title={automations.length ? 'Nothing matches' : 'No automations yet'}
            message={
              automations.length
                ? 'Try another search.'
                : 'For example: 24 hours after the CNA course is completed, assign the NCLEX PN review.'
            }
            action={!automations.length && <Button onClick={() => open(null)}>Add automation</Button>}
          />
        }
        columns={[
          {
            key: 'name',
            label: 'Automation',
            render: (a) => (
              <button className="link text-left" onClick={() => open(a)}>
                {a.name}
              </button>
            ),
          },
          { key: 'rule', label: 'What it does', sortValue: describe, render: (a) => <span className="text-ink-700">{describe(a)}</span> },
          {
            key: 'active',
            label: 'Status',
            sortValue: (a) => (a.active ? 0 : 1),
            render: (a) => <Badge tone={a.active ? 'green' : 'gray'}>{a.active ? 'Active' : 'Paused'}</Badge>,
          },
          {
            key: 'runs',
            label: 'Has run',
            sortValue: (a) => Number(a.runs) || 0,
            render: (a) => (
              <span title={a.lastRunAt ? `Last ran ${formatDateTime(a.lastRunAt)}` : undefined}>
                {plural(Number(a.runs) || 0, 'time')}
                {waiting(a) > 0 && <span className="text-ink-500"> · {waiting(a)} waiting</span>}
              </span>
            ),
          },
          { key: 'createdAt', label: 'Created', render: (a) => formatDate(a.createdAt) },
        ]}
        actions={(a) => (
          <>
            <MenuItem icon="pencil" onClick={() => open(a)}>
              Edit
            </MenuItem>
            <MenuItem icon={a.active ? 'lock' : 'check'} onClick={() => actions.automations.update(a.id, { active: !a.active })}>
              {a.active ? 'Pause' : 'Activate'}
            </MenuItem>
            <MenuItem
              icon="trash"
              danger
              onClick={() =>
                setConfirm({
                  title: 'Delete automation',
                  message: `Delete “${a.name}”?`,
                  onConfirm: () => {
                    actions.automations.remove(a.id)
                    toast('Automation deleted.')
                  },
                })
              }
            >
              Delete
            </MenuItem>
          </>
        )}
      />

      <Drawer
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit automation' : 'Add automation'}
        width="max-w-2xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save}>Save</Button>
          </>
        }
      >
        <Field label="Name" required>
          <Input value={draft.name} onChange={(e) => change({ name: e.target.value })} placeholder="CNA graduates move on to NCLEX PN" />
        </Field>
        <Field label="Automation">
          <Select value={draft.rule} onChange={(e) => change({ rule: e.target.value })}>
            {RULES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>

        {needs.includes('course') && (
          <Field label="Course" required>
            <Select value={draft.courseId} onChange={(e) => change({ courseId: e.target.value })}>
              <option value="">Choose a course…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {needs.includes('score') && (
          <div className="grid grid-cols-2 gap-x-5">
            <Field label="Lowest score (%)">
              <Input type="number" min={0} max={100} value={draft.scoreMin} onChange={number('scoreMin')} />
            </Field>
            <Field label="Highest score (%)">
              <Input type="number" min={0} max={100} value={draft.scoreMax} onChange={number('scoreMax')} />
            </Field>
          </div>
        )}

        {needs.includes('hours') && (
          <Field
            label={BEFORE.includes(draft.rule) ? 'Hours before' : 'Hours after'}
            hint={BEFORE.includes(draft.rule) ? undefined : '0 runs the automation straight away.'}
          >
            <Input type="number" min={BEFORE.includes(draft.rule) ? 1 : 0} value={draft.hours} onChange={number('hours')} />
          </Field>
        )}

        {needs.includes('days') && (
          <Field label="Days without signing in">
            <Input type="number" min={1} value={draft.days} onChange={number('days', 1)} />
          </Field>
        )}

        {needs.includes('points') && (
          <Field label="Points" hint={settings.gamification?.enabled ? 'Added to the learner\'s total on their Achievements page.' : 'Gamification is switched off, so learners will not see these points until it is turned on in Account & Settings.'}>
            <Input type="number" min={1} value={draft.points} onChange={number('points', 1)} />
          </Field>
        )}

        {needs.includes('url') && (
          <Field label="Web address" hint={`The portal sends the user, course and score to this address as JSON (a POST request).${backend.mode === 'server' ? '' : ' Without the shared database it is sent from the learner\'s browser, which some addresses refuse.'}`}>
            <Input value={draft.url} onChange={(e) => change({ url: e.target.value })} placeholder="https://" />
          </Field>
        )}

        {needs.includes('targets') && (
          <Field label="Courses to assign" required>
            <OptionList>
              {courses
                .filter((c) => !needs.includes('course') || c.id !== draft.courseId)
                .map((c) => (
                  <Checkbox
                    key={c.id}
                    label={c.name}
                    checked={draft.targetCourseIds.includes(c.id)}
                    onChange={(v) =>
                      change({
                        targetCourseIds: v ? [...draft.targetCourseIds, c.id] : draft.targetCourseIds.filter((id) => id !== c.id),
                      })
                    }
                  />
                ))}
            </OptionList>
          </Field>
        )}

        <Toggle checked={draft.active} onChange={(v) => change({ active: v })} label="Automation is active" />

        {problem && <p className="text-[13px] text-red-600 mt-5">{problem}</p>}
      </Drawer>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={confirm?.onConfirm || (() => {})}
        title={confirm?.title}
        message={confirm?.message}
      />
    </div>
  )
}
