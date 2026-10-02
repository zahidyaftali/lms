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
  SetupNote,
  Tabs,
  Textarea,
  Toggle,
} from '../../components/ui'
import { useData } from '../../context/DataContext'
import { useToast } from '../../context/ToastContext'
import { formatDate, fullName, plural } from '../../lib/utils'

const COMPLETION_RULES = ['All courses must be completed', 'Only the last course must be completed']

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
  const { learningPaths = [], courses, users, categories, enrollments, actions } = useData()
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
    const record = { ...draft, name: draft.name.trim(), courseIds, updatedAt: new Date().toISOString() }
    if (editing.id) actions.learningPaths.update(editing.id, record)
    else actions.learningPaths.add(record)
    const assign = record.status === 'active' && record.userIds.length > 0 && courseIds.length > 0
    if (assign) actions.enroll(record.userIds, courseIds)
    toast(
      assign
        ? `${record.name} saved. ${plural(record.userIds.length, 'learner')} can open its ${plural(courseIds.length, 'course')}.`
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
    const ids = (path.courseIds || []).filter(courseById)
    const members = path.userIds || []
    if (!ids.length || !members.length) return 0
    const done = enrollments.filter(
      (e) => e.status === 'completed' && ids.includes(e.courseId) && members.includes(e.userId),
    ).length
    return Math.round((done / (ids.length * members.length)) * 100)
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
            label: 'Completed',
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
              Learners added here are enrolled in every course of the path when you save. Removing someone keeps the
              course access they already have.
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
            <SetupNote>
              These options are saved with the path. Learners are not held to them yet: for now a path enrolls its
              learners in all of its courses at once.
            </SetupNote>
            <Toggle
              checked={draft.ordered}
              onChange={(v) => change({ ordered: v })}
              label="Courses are taken in order"
              hint="Each course opens once the one before it is completed."
            />
            <Field label="Completion rule" className="!mb-0">
              <Select value={draft.completionRule} onChange={(e) => change({ completionRule: e.target.value })}>
                {COMPLETION_RULES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Select>
            </Field>
            <Field label="Time limit (days)" hint="Days a learner has to finish the path. 0 means no limit." className="!mb-0">
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
            />
            <Toggle
              checked={draft.selfEnroll}
              onChange={(v) => change({ selfEnroll: v })}
              label="Learners can join this path on their own"
              hint="The path appears in the course catalog."
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
