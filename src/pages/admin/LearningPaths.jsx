import { useState } from 'react'
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  Drawer,
  EmptyState,
  Field,
  Icon,
  Input,
  MenuItem,
  PageHeader,
  PickList,
  Progress,
  SearchInput,
  Select,
  Tabs,
  Textarea,
  Toggle,
} from '../../components/ui'
import { useData } from '../../context/DataContext'
import { useToast } from '../../context/ToastContext'
import { PATH_RULES, pathProgress } from '../../lib/rules.js'
import { formatDate, fullName, plural } from '../../lib/utils'

const COMPLETION_RULES = PATH_RULES

const empty = {
  name: '',
  description: '',
  code: '',
  categoryId: '',
  status: 'active',
  courseIds: [],
  userIds: [],
  ordered: true,
  completionRule: COMPLETION_RULES[0],
  certificate: false,
  timeLimitDays: 0,
  selfEnroll: false,
}

const TABS = [
  { value: 'details', label: 'Details' },
  { value: 'courses', label: 'Courses' },
  { value: 'learners', label: 'Learners' },
  { value: 'options', label: 'Options' },
]

export default function LearningPaths() {
  const data = useData()
  const { learningPaths = [], courses, users, categories, actions } = data
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState(empty)
  const [tab, setTab] = useState('details')
  const [pick, setPick] = useState('')
  const [nameError, setNameError] = useState(false)
  const [confirm, setConfirm] = useState(null)

  const courseById = (id) => courses.find((c) => c.id === id)
  const change = (changes) => setDraft((d) => ({ ...d, ...changes }))

  function open(path) {
    setEditing(path || { id: null })
    setDraft(path ? { ...empty, ...path } : { ...empty })
    setTab('details')
    setPick('')
    setNameError(false)
  }

  function save() {
    if (!draft.name.trim()) {
      setNameError(true)
      setTab('details')
      return
    }
    // Courses deleted since the path was built drop out of it here.
    const courseIds = draft.courseIds.filter(courseById)
    const now = new Date().toISOString()
    // The day each learner joined starts their time limit.
    const joined = Object.fromEntries(draft.userIds.map((id) => [id, draft.joined?.[id] || now]))
    const record = { ...draft, name: draft.name.trim(), courseIds, joined, updatedAt: now }
    const saved = editing.id ? { ...editing, ...record } : actions.learningPaths.add(record)
    if (editing.id) actions.learningPaths.update(editing.id, record)
    const assign = record.status === 'active' && record.userIds.length > 0 && courseIds.length > 0
    if (assign) {
      for (const userId of record.userIds) {
        // In order: only the first course a learner has not completed opens; the rest follow as they finish.
        const next = pathProgress(record, userId, data).next
        actions.enroll([userId], record.ordered ? (next ? [next.courseId] : []) : courseIds, { pathId: saved.id })
      }
    }
    toast(
      assign
        ? `${record.name} saved. ${plural(record.userIds.length, 'learner')} can open ${record.ordered ? 'its first course' : `its ${plural(courseIds.length, 'course')}`}.`
        : `${record.name} saved.`,
    )
    setEditing(null)
  }

  function move(index, direction) {
    const ids = [...draft.courseIds]
    const target = index + direction
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    change({ courseIds: ids })
  }

  /** Share of the path's courses its learners have completed, as a percentage. */
  function progressOf(path) {
    const members = (path.userIds || []).filter((id) => users.some((u) => u.id === id))
    if (!members.length) return 0
    const done = members.filter((id) => pathProgress(path, id, data).completed).length
    return Math.round((done / members.length) * 100)
  }

  const rows = learningPaths.filter((p) => `${p.name} ${p.code || ''}`.toLowerCase().includes(query.trim().toLowerCase()))
  const available = courses.filter((c) => !draft.courseIds.includes(c.id))

  return (
    <div>
      <PageHeader title="Learning paths" subtitle="Line courses up in a sequence and give learners the whole journey at once.">
        <Button icon="plus" onClick={() => open(null)}>
          Add learning path
        </Button>
      </PageHeader>

      <SearchInput value={query} onChange={setQuery} className="w-[250px] mb-5" />

      <DataTable
        rows={rows}
        defaultSort={{ key: 'name', dir: 'asc' }}
        empty={
          <EmptyState
            icon="route"
            title={learningPaths.length ? 'Nothing matches' : 'No learning paths yet'}
            message={
              learningPaths.length
                ? 'Try another search.'
                : 'Create a path, add the courses in the order learners should take them, then assign it.'
            }
            action={!learningPaths.length && <Button onClick={() => open(null)}>Add learning path</Button>}
          />
        }
        columns={[
          {
            key: 'name',
            label: 'Learning path',
            render: (p) => (
              <div className="min-w-0">
                <button className="link text-left" onClick={() => open(p)}>
                  {p.name}
                </button>
                {p.code && <p className="hint">{p.code}</p>}
              </div>
            ),
          },
          {
            key: 'courses',
            label: 'Courses',
            sortValue: (p) => (p.courseIds || []).length,
            render: (p) => <Badge tone="blue">{(p.courseIds || []).filter(courseById).length}</Badge>,
          },
          {
            key: 'learners',
            label: 'Learners',
            sortValue: (p) => (p.userIds || []).length,
            render: (p) => (p.userIds || []).length,
          },
          {
            key: 'progress',
            label: 'Learners finished',
            width: 190,
            sortValue: progressOf,
            render: (p) => (
              <div className="flex items-center gap-3">
                <Progress value={progressOf(p)} className="flex-1" />
                <span className="text-[13px] text-ink-700 w-9 text-right">{progressOf(p)}%</span>
              </div>
            ),
          },
          {
            key: 'status',
            label: 'Status',
            render: (p) => <Badge tone={p.status === 'active' ? 'green' : 'gray'}>{p.status === 'active' ? 'Active' : 'Inactive'}</Badge>,
          },
          { key: 'updatedAt', label: 'Last updated', render: (p) => formatDate(p.updatedAt || p.createdAt) },
        ]}
        actions={(p) => (
          <>
            <MenuItem icon="pencil" onClick={() => open(p)}>
              Edit
            </MenuItem>
            <MenuItem
              icon="copy"
              onClick={() => {
                const { id, createdAt, ...rest } = p
                actions.learningPaths.add({ ...rest, name: `${p.name} (copy)`, userIds: [], status: 'inactive', updatedAt: new Date().toISOString() })
                toast('Learning path duplicated.')
              }}
            >
              Duplicate
            </MenuItem>
            <MenuItem
              icon={p.status === 'active' ? 'lock' : 'check'}
              onClick={() => actions.learningPaths.update(p.id, { status: p.status === 'active' ? 'inactive' : 'active' })}
            >
              {p.status === 'active' ? 'Deactivate' : 'Activate'}
            </MenuItem>
            <MenuItem
              icon="trash"
              danger
              onClick={() =>
                setConfirm({
                  title: 'Delete learning path',
                  message: `Delete ${p.name}? Its courses stay in the portal and learners keep the course access they already have.`,
                  onConfirm: () => {
                    actions.learningPaths.remove(p.id)
                    toast('Learning path deleted.')
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
        title={editing?.id ? 'Edit learning path' : 'Add learning path'}
        subtitle={editing?.id ? draft.name : undefined}
        width="max-w-2xl"
        toolbar={
          <Tabs
            tabs={TABS.map((t) =>
              t.value === 'courses'
                ? { ...t, count: draft.courseIds.length }
                : t.value === 'learners'
                  ? { ...t, count: draft.userIds.length }
                  : t,
            )}
            active={tab}
            onChange={setTab}
          />
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save}>Save</Button>
          </>
        }
      >
        {tab === 'details' && (
          <>
            <Field label="Name" required error={nameError && !draft.name.trim() ? 'Give the learning path a name.' : undefined}>
              <Input value={draft.name} onChange={(e) => change({ name: e.target.value })} placeholder="CNA to NCLEX-PN" />
            </Field>
            <Field label="Description" hint="Shown to learners at the top of the path.">
              <Textarea rows={4} value={draft.description} onChange={(e) => change({ description: e.target.value })} />
            </Field>
            <div className="grid sm:grid-cols-2 gap-x-5">
              <Field label="Code">
                <Input value={draft.code} onChange={(e) => change({ code: e.target.value.toUpperCase() })} placeholder="LP-01" />
              </Field>
              <Field label="Category">
                <Select value={draft.categoryId || ''} onChange={(e) => change({ categoryId: e.target.value })}>
                  <option value="">No category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Toggle
              checked={draft.status === 'active'}
              onChange={(v) => change({ status: v ? 'active' : 'inactive' })}
              label="Learning path is active"
              hint="Only active paths give their learners access to the courses."
            />
          </>
        )}

        {tab === 'courses' && (
          <>
            <Field label="Add a course">
              <div className="flex gap-3">
                <div className="flex-1 min-w-0">
                  <Select value={pick} onChange={(e) => setPick(e.target.value)}>
                    <option value="">{available.length ? 'Choose a course…' : 'Every course is already in this path'}</option>
                    {available.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button
                  variant="outline"
                  disabled={!pick}
                  onClick={() => {
                    change({ courseIds: [...draft.courseIds, pick] })
                    setPick('')
                  }}
                >
                  Add
                </Button>
              </div>
            </Field>

            {draft.courseIds.length === 0 ? (
              <EmptyState icon="book" title="No courses in this path" message="Add courses in the order learners should take them." />
            ) : (
              <ol className="border border-line rounded-md divide-y divide-line">
                {draft.courseIds.map((id, index) => {
                  const course = courseById(id)
                  return (
                    <li key={id} className="flex items-center gap-3.5 px-4 py-3">
                      <span className="w-7 h-7 rounded-full bg-brand-50 text-brand-700 text-[13px] font-semibold flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[14px] truncate">{course?.name || 'Deleted course'}</span>
                        {course && (
                          <span className="block hint truncate">
                            {plural(course.units.filter((u) => u.type !== 'section').length, 'unit')}
                            {course.status !== 'active' && ' · inactive'}
                          </span>
                        )}
                      </span>
                      <RowButton icon="chevronUp" title="Move up" disabled={index === 0} onClick={() => move(index, -1)} />
                      <RowButton
                        icon="chevronDown"
                        title="Move down"
                        disabled={index === draft.courseIds.length - 1}
                        onClick={() => move(index, 1)}
                      />
                      <RowButton
                        icon="trash"
                        title="Remove from path"
                        onClick={() => change({ courseIds: draft.courseIds.filter((x) => x !== id) })}
                      />
                    </li>
                  )
                })}
              </ol>
            )}
          </>
        )}

        {tab === 'learners' && (
          <>
            <p className="hint mb-4">
              Learners added here are enrolled in the path's courses when you save — all of them, or the first one when
              courses are taken in order. Removing someone keeps the course access they already have.
            </p>
            <PickList
              items={users.filter((u) => u.active)}
              selected={draft.userIds}
              onChange={(userIds) => change({ userIds })}
              title={fullName}
              subtitle={(u) => u.userType}
              leading={(u) => <Avatar user={u} size={34} />}
              empty="There are no active users yet."
            />
          </>
        )}

        {tab === 'options' && (
          <div className="space-y-6">
            <Toggle
              checked={draft.ordered}
              onChange={(v) => change({ ordered: v })}
              label="Courses are taken in order"
              hint="Each learner is enrolled in the first course; the next one is added the moment they complete the one before it. Off: they get every course at once."
            />
            <Field label="Completion rule" className="!mb-0">
              <Select value={draft.completionRule} onChange={(e) => change({ completionRule: e.target.value })}>
                {COMPLETION_RULES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Select>
            </Field>
            <Field label="Time limit (days)" hint="Days a learner has to finish the path, from the day they join. After that the path shows as out of time and no further courses open. 0 means no limit." className="!mb-0">
              <Input
                type="number"
                min={0}
                value={draft.timeLimitDays}
                onChange={(e) => change({ timeLimitDays: Math.max(0, Number(e.target.value)) })}
              />
            </Field>
            <Toggle
              checked={draft.certificate}
              onChange={(v) => change({ certificate: v })}
              label="Issue a certificate when the path is completed"
              hint="In addition to the certificates of its courses. It uses the default certificate template."
            />
            <Toggle
              checked={draft.selfEnroll}
              onChange={(v) => change({ selfEnroll: v })}
              label="Learners can join this path on their own"
              hint="The path appears at the top of the course catalog with a Join button."
            />
          </div>
        )}
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

function RowButton({ icon, title, onClick, disabled }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className="p-1.5 rounded text-ink-700 hover:bg-gray-100 disabled:opacity-30 disabled:pointer-events-none"
    >
      <Icon name={icon} className="w-[18px] h-[18px]" />
    </button>
  )
}
