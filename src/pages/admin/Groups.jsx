import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Avatar,
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
  Textarea,
} from '../../components/ui'
import { useData } from '../../context/DataContext'
import { useToast } from '../../context/ToastContext'
import { formatDate, fullName } from '../../lib/utils'

const empty = { name: '', description: '', key: '', courseIds: [] }

export default function Groups() {
  const [params, setParams] = useSearchParams()
  const { groups, users, courses, actions } = useData()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState(empty)
  const [members, setMembers] = useState(null)
  const [confirm, setConfirm] = useState(null)

  useEffect(() => {
    if (params.get('new') === '1') {
      open(null)
      params.delete('new')
      setParams(params, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function open(group) {
    setEditing(group || { id: null })
    setDraft(group ? { ...group } : { ...empty })
  }

  function save() {
    if (!draft.name.trim()) return
    if (editing?.id) {
      actions.groups.update(editing.id, draft)
      toast('Group updated.')
    } else {
      const group = actions.groups.add(draft)
      toast(`${group.name} created.`)
    }
    setEditing(null)
  }

  const rows = groups.filter((g) => g.name.toLowerCase().includes(query.trim().toLowerCase()))
  const membersOf = (groupId) => users.filter((u) => (u.groupIds || []).includes(groupId))

  return (
    <div>
      <PageHeader title="Groups" subtitle="Bundle learners together and assign courses to all of them at once.">
        <Button icon="plus" onClick={() => open(null)}>
          Add group
        </Button>
      </PageHeader>

      <SearchInput value={query} onChange={setQuery} className="w-[250px] mb-5" />

      <DataTable
        rows={rows}
        empty={
          <EmptyState
            icon="group"
            title="No groups yet"
            message="Create a cohort, then add the courses every member should receive."
            action={<Button onClick={() => open(null)}>Add group</Button>}
          />
        }
        columns={[
          {
            key: 'name',
            label: 'Group',
            render: (g) => (
              <button className="link" onClick={() => open(g)}>
                {g.name}
              </button>
            ),
          },
          { key: 'description', label: 'Description', render: (g) => g.description || '-' },
          { key: 'key', label: 'Group key', render: (g) => (g.key ? <code className="bg-gray-100 rounded px-2 py-0.5 text-[12.5px]">{g.key}</code> : '-') },
          {
            key: 'members',
            label: 'Members',
            sortValue: (g) => membersOf(g.id).length,
            render: (g) => (
              <button className="link" onClick={() => setMembers(g)}>
                {membersOf(g.id).length}
              </button>
            ),
          },
          {
            key: 'courses',
            label: 'Courses',
            sortValue: (g) => (g.courseIds || []).length,
            render: (g) => <Badge tone="blue">{(g.courseIds || []).length}</Badge>,
          },
          { key: 'createdAt', label: 'Created', render: (g) => formatDate(g.createdAt) },
        ]}
        actions={(g) => (
          <>
            <MenuItem icon="pencil" onClick={() => open(g)}>
              Edit
            </MenuItem>
            <MenuItem icon="users" onClick={() => setMembers(g)}>
              Manage members
            </MenuItem>
            <MenuItem
              icon="book"
              onClick={() => {
                const ids = membersOf(g.id).map((u) => u.id)
                if (ids.length && (g.courseIds || []).length) {
                  actions.enroll(ids, g.courseIds)
                  toast('Group courses assigned to every member.')
                } else {
                  toast('Add members and courses to this group first.', 'info')
                }
              }}
            >
              Sync course access
            </MenuItem>
            <MenuItem
              icon="trash"
              danger
              onClick={() =>
                setConfirm({
                  title: 'Delete group',
                  message: `Delete ${g.name}? Members keep their existing course access.`,
                  onConfirm: () => {
                    actions.groups.remove(g.id)
                    users.forEach((u) => {
                      if ((u.groupIds || []).includes(g.id))
                        actions.updateUser(u.id, { groupIds: u.groupIds.filter((id) => id !== g.id) })
                    })
                    toast('Group deleted.')
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
        title={editing?.id ? 'Edit group' : 'Add group'}
        width="max-w-lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save}>Save</Button>
          </>
        }
      >
        <Field label="Group name" required>
          <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Fall 2026 CNA Cohort" />
        </Field>
        <Field label="Description">
          <Textarea rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        </Field>
        <Field label="Group key" hint="An internal reference used on rosters and reports.">
          <Input value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value.toUpperCase() })} />
        </Field>
        <Field label="Courses for this group">
          <OptionList>
            {courses.map((c) => (
              <Checkbox
                key={c.id}
                label={c.name}
                checked={(draft.courseIds || []).includes(c.id)}
                onChange={(v) =>
                  setDraft({
                    ...draft,
                    courseIds: v
                      ? [...(draft.courseIds || []), c.id]
                      : (draft.courseIds || []).filter((id) => id !== c.id),
                  })
                }
              />
            ))}
          </OptionList>
        </Field>
      </Drawer>

      <Drawer
        open={!!members}
        onClose={() => setMembers(null)}
        title="Group members"
        subtitle={members?.name}
        width="max-w-lg"
        footer={<Button onClick={() => setMembers(null)}>Done</Button>}
      >
        {members && (
          <ul className="divide-y divide-line">
            {users.map((u) => {
              const inGroup = (u.groupIds || []).includes(members.id)
              return (
                <li key={u.id} className="py-3 flex items-center gap-3.5">
                  <Avatar user={u} size={34} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px] truncate">{fullName(u)}</span>
                    <span className="block hint">{u.userType}</span>
                  </span>
                  <Button
                    size="sm"
                    variant={inGroup ? 'ghost' : 'outline'}
                    onClick={() => {
                      const groupIds = inGroup
                        ? (u.groupIds || []).filter((id) => id !== members.id)
                        : [...(u.groupIds || []), members.id]
                      actions.updateUser(u.id, { groupIds })
                      if (!inGroup && (members.courseIds || []).length) actions.enroll([u.id], members.courseIds)
                    }}
                  >
                    {inGroup ? 'Remove' : 'Add'}
                  </Button>
                </li>
              )
            })}
          </ul>
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
