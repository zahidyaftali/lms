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
import { useData } from '../../context/DataContext'
import { useToast } from '../../context/ToastContext'
import { formatDate, fullName, plural, uid } from '../../lib/utils'

const empty = { name: '', description: '', courseIds: [], resources: [], userIds: [] }

const DRAWER_TABS = [
  { value: 'details', label: 'Details' },
  { value: 'courses', label: 'Courses' },
  { value: 'resources', label: 'Resources' },
  { value: 'users', label: 'Users' },
]

export default function Skills() {
  const { skills = [], courses, users, actions } = useData()
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
    const record = { ...draft, name: draft.name.trim() }
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
  const userRows = users
    .map((u) => ({ ...u, skills: skills.filter((s) => (s.userIds || []).includes(u.id)) }))
    .filter((u) => u.skills.length && fullName(u).toLowerCase().includes(q))

  return (
    <div>
      <PageHeader title="Skills" subtitle="Name the abilities your learners build, and link each one to the courses that teach it.">
        <Button icon="plus" onClick={() => open(null)}>
          Add skill
        </Button>
      </PageHeader>

      <SetupNote>
        Skills are kept for administrators for now; learners do not see them yet. Assessments and the other options are
        under{' '}
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
          { value: 'users', label: 'Users', count: users.filter((u) => skills.some((s) => (s.userIds || []).includes(u.id))).length },
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
              sortValue: (s) => (s.userIds || []).length,
              render: (s) => (
                <button className="link" onClick={() => open(s, 'users')}>
                  {(s.userIds || []).filter((id) => users.some((u) => u.id === id)).length}
                </button>
              ),
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
              t.value === 'details' ? t : { ...t, count: draft[t.value === 'users' ? 'userIds' : t.value === 'courses' ? 'courseIds' : 'resources'].length },
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
            <p className="hint mb-4">Courses that teach this skill. Learners working towards it are pointed to these.</p>
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
