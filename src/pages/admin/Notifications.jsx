import { useState } from 'react'
import {
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
  SearchInput,
  Select,
  Textarea,
  Toggle,
} from '../../components/ui'
import { useData } from '../../context/DataContext'
import { useToast } from '../../context/ToastContext'
import { formatDate } from '../../lib/utils'

const EVENTS = [
  'User is created',
  'User is enrolled in course',
  'User completes course',
  'User fails a test',
  'Assignment is submitted',
  'Assignment is graded',
  'Instructor-led session is scheduled',
  'User has not logged in for 14 days',
  'Certificate expires in 30 days',
]

const RECIPIENTS = ['The user', "The user's instructor", 'All administrators', 'Program director']

const empty = {
  name: '',
  event: EVENTS[0],
  recipient: RECIPIENTS[0],
  active: true,
  subject: '',
  body: '',
}

export default function Notifications() {
  const { notifications, actions } = useData()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState(empty)
  const [confirm, setConfirm] = useState(null)

  const rows = notifications.filter((n) => `${n.name} ${n.event}`.toLowerCase().includes(query.trim().toLowerCase()))

  function open(rule) {
    setEditing(rule || { id: null })
    setDraft(rule ? { ...rule } : { ...empty })
  }

  function save() {
    if (!draft.name.trim()) return
    if (editing?.id) {
      actions.notificationRules.update(editing.id, draft)
      toast('Notification updated.')
    } else {
      actions.notificationRules.add(draft)
      toast('Notification created.')
    }
    setEditing(null)
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Automatic emails the portal sends to learners, instructors and staff."
      >
        <Button icon="plus" onClick={() => open(null)}>
          Add notification
        </Button>
      </PageHeader>

      <div className="flex items-start gap-3 rounded-md bg-brand-50 border border-brand-100 px-4 py-3.5 mb-5">
        <Icon name="info" className="w-[18px] h-[18px] text-brand-700 mt-0.5 shrink-0" />
        <p className="text-[13px] text-ink-700 leading-5">
          Messages use placeholders such as <code className="bg-white rounded px-1.5 py-0.5">{'{user_name}'}</code>,{' '}
          <code className="bg-white rounded px-1.5 py-0.5">{'{course_name}'}</code> and{' '}
          <code className="bg-white rounded px-1.5 py-0.5">{'{login_url}'}</code>, which are filled in when the email
          is sent.
        </p>
      </div>

      <SearchInput value={query} onChange={setQuery} className="w-[250px] mb-5" />

      <DataTable
        rows={rows}
        empty={
          <EmptyState
            icon="bell"
            title="No notifications configured"
            message="Add a rule to email users automatically when something happens in the portal."
            action={<Button onClick={() => open(null)}>Add notification</Button>}
          />
        }
        columns={[
          {
            key: 'name',
            label: 'Notification',
            render: (n) => (
              <button className="link" onClick={() => open(n)}>
                {n.name}
              </button>
            ),
          },
          { key: 'event', label: 'Triggered when' },
          { key: 'recipient', label: 'Recipient' },
          {
            key: 'active',
            label: 'Status',
            render: (n) => <Badge tone={n.active ? 'green' : 'gray'}>{n.active ? 'Active' : 'Paused'}</Badge>,
          },
          { key: 'createdAt', label: 'Created', render: (n) => formatDate(n.createdAt) },
        ]}
        actions={(n) => (
          <>
            <MenuItem icon="pencil" onClick={() => open(n)}>
              Edit
            </MenuItem>
            <MenuItem
              icon={n.active ? 'lock' : 'check'}
              onClick={() => actions.notificationRules.update(n.id, { active: !n.active })}
            >
              {n.active ? 'Pause' : 'Activate'}
            </MenuItem>
            <MenuItem
              icon="trash"
              danger
              onClick={() =>
                setConfirm({
                  title: 'Delete notification',
                  message: `Delete “${n.name}”?`,
                  onConfirm: () => {
                    actions.notificationRules.remove(n.id)
                    toast('Notification deleted.')
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
        title={editing?.id ? 'Edit notification' : 'Add notification'}
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
          <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-x-5">
          <Field label="Trigger event">
            <Select value={draft.event} onChange={(e) => setDraft({ ...draft, event: e.target.value })}>
              {EVENTS.map((ev) => (
                <option key={ev}>{ev}</option>
              ))}
            </Select>
          </Field>
          <Field label="Recipient">
            <Select value={draft.recipient} onChange={(e) => setDraft({ ...draft, recipient: e.target.value })}>
              {RECIPIENTS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Subject">
          <Input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
        </Field>
        <Field label="Message">
          <Textarea rows={6} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
        </Field>
        <Toggle checked={draft.active} onChange={(v) => setDraft({ ...draft, active: v })} label="Notification is active" />
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
