import { useState } from 'react'
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  Drawer,
  EmptyState,
  Field,
  Input,
  MenuItem,
  PageHeader,
  SearchInput,
  Textarea,
  Toggle,
} from '../../components/ui'
import { useData } from '../../context/DataContext'
import { useToast } from '../../context/ToastContext'
import { formatDate } from '../../lib/utils'

const empty = { name: '', description: '', location: '', active: true }

export default function Branches() {
  const { branches, users, actions } = useData()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState(empty)
  const [confirm, setConfirm] = useState(null)

  const rows = branches.filter((b) => b.name.toLowerCase().includes(query.trim().toLowerCase()))
  const countOf = (id) => users.filter((u) => u.branchId === id).length

  function open(branch) {
    setEditing(branch || { id: null })
    setDraft(branch ? { ...branch } : { ...empty })
  }

  function save() {
    if (!draft.name.trim()) return
    if (editing?.id) {
      actions.branches.update(editing.id, draft)
      toast('Branch updated.')
    } else {
      actions.branches.add(draft)
      toast('Branch created.')
    }
    setEditing(null)
  }

  return (
    <div>
      <PageHeader title="Branches" subtitle="Separate campuses or partner sites, each with their own learners.">
        <Button icon="plus" onClick={() => open(null)}>
          Add branch
        </Button>
      </PageHeader>

      <SearchInput value={query} onChange={setQuery} className="w-[250px] mb-5" />

      <DataTable
        rows={rows}
        empty={
          <EmptyState
            icon="branch"
            title="No branches yet"
            message="Add a campus or partner location to group learners by site."
            action={<Button onClick={() => open(null)}>Add branch</Button>}
          />
        }
        columns={[
          {
            key: 'name',
            label: 'Branch',
            render: (b) => (
              <button className="link" onClick={() => open(b)}>
                {b.name}
              </button>
            ),
          },
          { key: 'location', label: 'Location', render: (b) => b.location || '-' },
          { key: 'description', label: 'Description', render: (b) => b.description || '-' },
          { key: 'users', label: 'Users', sortValue: (b) => countOf(b.id), render: (b) => countOf(b.id) },
          {
            key: 'active',
            label: 'Status',
            render: (b) => <Badge tone={b.active ? 'green' : 'gray'}>{b.active ? 'Active' : 'Inactive'}</Badge>,
          },
          { key: 'createdAt', label: 'Created', render: (b) => formatDate(b.createdAt) },
        ]}
        actions={(b) => (
          <>
            <MenuItem icon="pencil" onClick={() => open(b)}>
              Edit
            </MenuItem>
            <MenuItem icon={b.active ? 'lock' : 'check'} onClick={() => actions.branches.update(b.id, { active: !b.active })}>
              {b.active ? 'Deactivate' : 'Activate'}
            </MenuItem>
            <MenuItem
              icon="trash"
              danger
              onClick={() =>
                setConfirm({
                  title: 'Delete branch',
                  message: `Delete ${b.name}? Users assigned to it keep their accounts but lose the branch link.`,
                  onConfirm: () => {
                    actions.branches.remove(b.id)
                    users.forEach((u) => u.branchId === b.id && actions.updateUser(u.id, { branchId: null }))
                    toast('Branch deleted.')
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
        title={editing?.id ? 'Edit branch' : 'Add branch'}
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
        <Field label="Branch name" required>
          <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Atlanta Campus" />
        </Field>
        <Field label="Location">
          <Input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} placeholder="Atlanta, GA" />
        </Field>
        <Field label="Description">
          <Textarea rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        </Field>
        <Toggle checked={draft.active} onChange={(v) => setDraft({ ...draft, active: v })} label="Branch is active" />
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
