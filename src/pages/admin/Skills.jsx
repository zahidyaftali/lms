import { useState } from 'react'
import { Link } from 'react-router-dom'
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
  SearchInput,
  SetupNote,
  Tabs,
  Textarea,
} from '../../components/ui'
import { skillStatus } from '../../lib/rules.js'
import { useData } from '../../context/DataContext'
import { useToast } from '../../context/ToastContext'
import { formatDate, fullName, plural, uid } from '../../lib/utils'

const empty = { name: '', description: '', courseIds: [], resources: [], userIds: [], questions: [] }

const DRAWER_TABS = [
  { value: 'details', label: 'Details' },
  { value: 'courses', label: 'Courses' },
  { value: 'resources', label: 'Resources' },
  { value: 'assessment', label: 'Assessment' },
  { value: 'users', label: 'Users' },
]

const TAB_LIST = { users: 'userIds', courses: 'courseIds', resources: 'resources', assessment: 'questions' }

export default function Skills() {
  const data = useData()
  const { skills = [], courses, users, settings, actions } = data
  const on = settings.skills?.enabled && settings.skills?.learners
  const toast = useToast()
  const [view, setView] = useState('skills')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState(empty)
  const [tab, setTab] = useState('details')
  const [resource, setResource] = useState({ title: '', url: '' })
  const [nameError, setNameError] = useState(false)
  const [confirm, setConfirm] = useState(null)

  const change = (changes) => setDraft((d) => ({ ...d, ...changes }))
  const q = query.trim().toLowerCase()

  function open(skill, startTab = 'details') {
    setEditing(skill || { id: null })
    setDraft(skill ? { ...empty, ...skill } : { ...empty })
    setTab(startTab)
    setResource({ title: '', url: '' })
    setNameError(false)
  }

  function save() {
    if (!draft.name.trim()) {
      setNameError(true)
      setTab('details')
      return
    }
    // Half-written questions are dropped: a question needs its text, two answers and a correct one.
    const questions = (draft.questions || [])
      .map((q) => ({ ...q, text: q.text.trim(), options: q.options.map((o) => ({ ...o, text: o.text.trim() })).filter((o) => o.text) }))
      .filter((q) => q.text && q.options.length >= 2 && q.options.some((o) => o.correct))
    const record = { ...draft, name: draft.name.trim(), questions }
    if (editing.id) {
      actions.skills.update(editing.id, record)
      toast('Skill updated.')
    } else {
      actions.skills.add(record)
      toast(`${record.name} added.`)
    }
    setEditing(null)
  }

  function addResource() {
    const title = resource.title.trim()
    const url = resource.url.trim()
    if (!title || !/^https?:\/\/\S+$/.test(url)) return
    change({ resources: [...draft.resources, { id: uid('res'), title, url }] })
    setResource({ title: '', url: '' })
  }

  const skillRows = skills.filter((s) => `${s.name} ${s.description || ''}`.toLowerCase().includes(q))
  // Everyone who holds a skill, however they earned it: given by an administrator, a course, or the assessment.
  const holds = (s, u) => skillStatus(s, u.id, data, settings).earned
  const userRows = users
    .map((u) => ({ ...u, skills: skills.filter((s) => holds(s, u)) }))
    .filter((u) => u.skills.length && fullName(u).toLowerCase().includes(q))

  return (
    <div>
      <PageHeader title="Skills" subtitle="Name the abilities your learners build, and link each one to the courses that teach it.">
        <Button icon="plus" onClick={() => open(null)}>
          Add skill
        </Button>
      </PageHeader>

      <SetupNote>
        {on
          ? 'Learners see these skills on their Skills page. A learner earns a skill when you give it to them here, when they complete a course linked to it, or when they pass its assessment. '
          : 'Learners do not see skills yet. Switch “Skills” and “Activate skills for learners” on to give them a Skills page. '}
        The options are under{' '}
        <Link className="link" to="/settings?tab=skills">
          Account &amp; Settings → Skills
        </Link>
        .
      </SetupNote>

      <Tabs
        className="mb-5"
        active={view}
        onChange={(v) => {
          setView(v)
          setQuery('')
        }}
        tabs={[
          { value: 'skills', label: 'Skills', count: skills.length },
          { value: 'users', label: 'Users', count: users.filter((u) => skills.some((s) => holds(s, u))).length },
        ]}
      />

      <SearchInput value={query} onChange={setQuery} className="w-[250px] mb-5" />

      {view === 'skills' && (
        <DataTable
          rows={skillRows}
          empty={
            <EmptyState
              icon="skill"
              title={skills.length ? 'Nothing matches' : 'No skills yet'}
              message={
                skills.length
                  ? 'Try another search.'
                  : 'Add a skill such as “Vital signs” or “Infection control”, then link the courses that teach it.'
              }
              action={!skills.length && <Button onClick={() => open(null)}>Add skill</Button>}
            />
          }
          columns={[
            {
              key: 'name',
              label: 'Skill',
              render: (s) => (
                <button className="link text-left" onClick={() => open(s)}>
                  {s.name}
                </button>
              ),
            },
            {
              key: 'description',
              label: 'Description',
              render: (s) => <span className="text-ink-700 line-clamp-2">{s.description || '-'}</span>,
            },
            {
              key: 'courses',
              label: 'Courses',
              sortValue: (s) => (s.courseIds || []).length,
              render: (s) => <Badge tone="blue">{(s.courseIds || []).filter((id) => courses.some((c) => c.id === id)).length}</Badge>,
            },
            {
              key: 'users',
              label: 'Users',
              sortValue: (s) => users.filter((u) => holds(s, u)).length,
              render: (s) => (
                <button className="link" onClick={() => open(s, 'users')}>
                  {users.filter((u) => holds(s, u)).length}
                </button>
              ),
            },
            {
              key: 'questions',
              label: 'Assessment',
              sortValue: (s) => (s.questions || []).length,
              render: (s) => ((s.questions || []).length ? plural(s.questions.length, 'question') : <span className="text-ink-400">None</span>),
            },
            { key: 'createdAt', label: 'Created', render: (s) => formatDate(s.createdAt) },
          ]}
          actions={(s) => (
            <>
              <MenuItem icon="pencil" onClick={() => open(s)}>
                Edit
              </MenuItem>
              <MenuItem icon="users" onClick={() => open(s, 'users')}>
                Assign to users
              </MenuItem>
              <MenuItem
                icon="trash"
                danger
                onClick={() =>
                  setConfirm({
                    title: 'Delete skill',
                    message: `Delete ${s.name}? It is removed from the ${plural((s.userIds || []).length, 'user')} who have it.`,
                    onConfirm: () => {
                      actions.skills.remove(s.id)
                      toast('Skill deleted.')
                    },
                  })
                }
              >
                Delete
              </MenuItem>
            </>
          )}
        />
      )}

      {view === 'users' && (
        <DataTable
          rows={userRows}
          empty={
            <EmptyState
              icon="users"
              title="No users have a skill yet"
              message="Open a skill and use Assign to users to record who has it."
            />
          }
          columns={[
            {
              key: 'name',
              label: 'User',
              sortValue: fullName,
              render: (u) => (
                <span className="flex items-center gap-3">
                  <Avatar user={u} size={32} />
                  <Link className="link" to={`/users/${u.id}`}>
                    {fullName(u)}
                  </Link>
                </span>
              ),
            },
            { key: 'userType', label: 'User type' },
            {
              key: 'skills',
              label: 'Skills',
              sortValue: (u) => u.skills.length,
              render: (u) => (
                <span className="flex flex-wrap gap-1.5">
                  {u.skills.map((s) => (
                    <Badge key={s.id} tone="blue">
                      {s.name}
                    </Badge>
                  ))}
                </span>
              ),
            },
          ]}
        />
      )}

      <Drawer
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit skill' : 'Add skill'}
        subtitle={editing?.id ? draft.name : undefined}
        width="max-w-2xl"
        toolbar={
          <Tabs
            tabs={DRAWER_TABS.map((t) =>
              t.value === 'details' ? t : { ...t, count: (draft[TAB_LIST[t.value]] || []).length },
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
            <Field label="Name" required error={nameError && !draft.name.trim() ? 'Give the skill a name.' : undefined}>
              <Input value={draft.name} onChange={(e) => change({ name: e.target.value })} placeholder="Vital signs" />
            </Field>
            <Field label="Description" hint="What someone with this skill can do.">
              <Textarea rows={5} value={draft.description} onChange={(e) => change({ description: e.target.value })} />
            </Field>
          </>
        )}

        {tab === 'courses' && (
          <>
            <p className="hint mb-4">Courses that teach this skill. Completing any one of them earns the skill, and learners working towards it are pointed to these.</p>
            <PickList
              items={courses}
              selected={draft.courseIds}
              onChange={(courseIds) => change({ courseIds })}
              title={(c) => c.name}
              subtitle={(c) => `${plural(c.units.filter((u) => u.type !== 'section').length, 'unit')}${c.status !== 'active' ? ' · inactive' : ''}`}
              empty="There are no courses yet."
            />
          </>
        )}

        {tab === 'resources' && (
          <>
            <p className="hint mb-4">Articles, videos and other material outside the portal that help with this skill.</p>
            <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end mb-5">
              <Field label="Title" className="!mb-0">
                <Input value={resource.title} onChange={(e) => setResource({ ...resource, title: e.target.value })} />
              </Field>
              <Field label="Web address" className="!mb-0">
                <Input value={resource.url} onChange={(e) => setResource({ ...resource, url: e.target.value })} placeholder="https://" />
              </Field>
              <Button variant="outline" onClick={addResource} disabled={!resource.title.trim() || !/^https?:\/\/\S+$/.test(resource.url.trim())}>
                Add
              </Button>
            </div>
            {draft.resources.length === 0 ? (
              <p className="hint py-6 text-center">No resources added.</p>
            ) : (
              <ul className="border border-line rounded-md divide-y divide-line">
                {draft.resources.map((r) => (
                  <li key={r.id} className="flex items-center gap-3.5 px-4 py-3">
                    <Icon name="link" className="w-[18px] h-[18px] text-ink-700 shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14px] truncate">{r.title}</span>
                      <a className="block hint truncate hover:underline" href={r.url} target="_blank" rel="noreferrer">
                        {r.url}
                      </a>
                    </span>
                    <button
                      type="button"
                      title="Remove resource"
                      aria-label="Remove resource"
                      onClick={() => change({ resources: draft.resources.filter((x) => x.id !== r.id) })}
                      className="p-1.5 rounded text-ink-700 hover:text-red-600 hover:bg-red-50"
                    >
                      <Icon name="trash" className="w-[18px] h-[18px]" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tab === 'assessment' && <QuestionBank questions={draft.questions || []} onChange={(questions) => change({ questions })} settings={settings} />}

        {tab === 'users' && (
          <PickList
            items={users.filter((u) => u.active)}
            selected={draft.userIds}
            onChange={(userIds) => change({ userIds })}
            title={fullName}
            subtitle={(u) => u.userType}
            leading={(u) => <Avatar user={u} size={34} />}
            empty="There are no active users yet."
          />
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

/** The questions a skill's assessment is drawn from. Tick every answer that is correct. */
function QuestionBank({ questions, onChange, settings }) {
  const s = settings.skills || {}
  const update = (id, changes) => onChange(questions.map((q) => (q.id === id ? { ...q, ...changes } : q)))
  const add = () =>
    onChange([
      ...questions,
      { id: uid('q'), text: '', options: [{ id: uid('o'), text: '', correct: true }, { id: uid('o'), text: '', correct: false }] },
    ])

  return (
    <>
      <p className="hint mb-4">
        Learners answer {Math.min(Number(s.questions) || 10, Math.max(questions.length, 1))} of these, picked at random, and need {Number(s.passMark) || 0}% to pass. A skill with no
        questions has no assessment: it is earned through its courses or given by you.
      </p>
      <ol className="space-y-5">
        {questions.map((q, index) => (
          <li key={q.id} className="border border-line rounded-md p-4">
            <div className="flex items-start gap-3 mb-3">
              <span className="w-7 h-7 rounded-full bg-brand-50 text-brand-700 text-[13px] font-semibold flex items-center justify-center shrink-0 mt-1.5">{index + 1}</span>
              <Textarea rows={2} value={q.text} onChange={(e) => update(q.id, { text: e.target.value })} placeholder="Question" />
              <button
                type="button"
                title="Remove question"
                aria-label="Remove question"
                onClick={() => onChange(questions.filter((x) => x.id !== q.id))}
                className="p-1.5 rounded text-ink-700 hover:text-red-600 hover:bg-red-50 mt-1"
              >
                <Icon name="trash" className="w-[18px] h-[18px]" />
              </button>
            </div>
            <ul className="space-y-2 pl-10">
              {q.options.map((o) => (
                <li key={o.id} className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={!!o.correct}
                    onChange={(e) => update(q.id, { options: q.options.map((x) => (x.id === o.id ? { ...x, correct: e.target.checked } : x)) })}
                    title="Correct answer"
                    aria-label="Correct answer"
                    className="w-[18px] h-[18px] accent-emerald-600 shrink-0"
                  />
                  <Input
                    className="h-10"
                    value={o.text}
                    onChange={(e) => update(q.id, { options: q.options.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)) })}
                    placeholder="Answer"
                  />
                  <button
                    type="button"
                    title="Remove answer"
                    aria-label="Remove answer"
                    disabled={q.options.length <= 2}
                    onClick={() => update(q.id, { options: q.options.filter((x) => x.id !== o.id) })}
                    className="p-1.5 rounded text-ink-700 hover:bg-gray-100 disabled:opacity-30"
                  >
                    <Icon name="x" className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="pl-10 mt-2.5 flex flex-wrap items-center gap-3">
              <button type="button" className="link text-[13px]" onClick={() => update(q.id, { options: [...q.options, { id: uid('o'), text: '', correct: false }] })}>
                Add answer
              </button>
              {!q.options.some((o) => o.correct) && <span className="text-[12.5px] text-red-600">Tick at least one correct answer.</span>}
            </div>
          </li>
        ))}
      </ol>
      <Button variant="outline" icon="plus" className="mt-5" onClick={add}>
        Add question
      </Button>
    </>
  )
}
