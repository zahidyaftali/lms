import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
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
  Modal,
  PageHeader,
  SearchInput,
  Select,
  Tabs,
  Textarea,
  Toggle,
} from '../../components/ui'
import { useData } from '../../context/DataContext'
import { useToast } from '../../context/ToastContext'
import { NOTIFICATION_EVENTS, NOTIFICATION_RECIPIENTS, PLACEHOLDERS } from '../../lib/engine.js'
import { formatDate, formatDateTime } from '../../lib/utils'

const EVENTS = NOTIFICATION_EVENTS.map((e) => e.label)

const empty = {
  name: '',
  event: EVENTS[0],
  recipient: NOTIFICATION_RECIPIENTS[0],
  active: true,
  subject: '',
  body: '',
}

const MAIL_STATUS = {
  sent: ['Sent', 'green'],
  queued: ['Waiting to send', 'amber'],
  skipped: ['Not sent', 'gray'],
  failed: ['Failed', 'red'],
}

const MAIL_KIND = { welcome: 'Welcome email', notification: 'Notification', verification: 'Sign-up confirmation', invoice: 'Invoice', test: 'Test message' }

/**
 * Rules that message people when something happens. Each message goes to the
 * recipient's portal inbox and, when an email service is connected, to their
 * email address. The Sent tab lists every email and what became of it.
 */
export default function Notifications() {
  const { notifications, outbox = [], server, backend, actions } = useData()
  const toast = useToast()
  const [params] = useSearchParams()
  const [tab, setTab] = useState(params.get('tab') === 'sent' ? 'sent' : 'rules')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState(empty)
  const [confirm, setConfirm] = useState(null)
  const [reading, setReading] = useState(null)

  const q = query.trim().toLowerCase()
  const rows = notifications.filter((n) => `${n.name} ${n.event}`.toLowerCase().includes(q))
  const mails = outbox.filter((m) => `${m.to} ${m.subject}`.toLowerCase().includes(q))
  const emailOn = backend.mode === 'server' && !!server?.email

  function open(rule) {
    setEditing(rule || { id: null })
    setDraft(rule ? { ...empty, ...rule } : { ...empty })
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
      <PageHeader title="Notifications" subtitle="Messages the portal sends to learners, instructors and staff when something happens.">
        <Button icon="plus" onClick={() => open(null)}>
          Add notification
        </Button>
      </PageHeader>

      <div className="flex items-start gap-3 rounded-md bg-brand-50 border border-brand-100 px-4 py-3.5 mb-5">
        <Icon name="info" className="w-[18px] h-[18px] text-brand-700 mt-0.5 shrink-0" />
        <p className="text-[13px] text-ink-700 leading-5">
          Every notification is delivered to the recipient's <strong>Messages</strong> in the portal.{' '}
          {emailOn ? (
            'It is also sent to their email address.'
          ) : (
            <>
              To send it by email as well, connect an email service under{' '}
              <Link className="link" to="/settings?tab=integrations">
                Account &amp; Settings → Integrations → Email
              </Link>
              .
            </>
          )}
        </p>
      </div>

      <Tabs
        className="mb-5"
        active={tab}
        onChange={(v) => {
          setTab(v)
          setQuery('')
        }}
        tabs={[
          { value: 'rules', label: 'Notifications', count: notifications.length },
          { value: 'sent', label: 'Sent', count: outbox.length },
        ]}
      />

      <SearchInput value={query} onChange={setQuery} className="w-[250px] mb-5" />

      {tab === 'rules' && (
        <DataTable
          rows={rows}
          empty={
            <EmptyState
              icon="bell"
              title="No notifications configured"
              message="Add a rule to message users automatically when something happens in the portal."
              action={<Button onClick={() => open(null)}>Add notification</Button>}
            />
          }
          columns={[
            {
              key: 'name',
              label: 'Notification',
              render: (n) => (
                <button className="link text-left" onClick={() => open(n)}>
                  {n.name}
                </button>
              ),
            },
            { key: 'event', label: 'Triggered when' },
            { key: 'recipient', label: 'Recipient' },
            {
              key: 'active',
              label: 'Status',
              sortValue: (n) => (n.active ? 0 : 1),
              render: (n) =>
                !EVENTS.includes(n.event) ? <Badge tone="red">Unknown trigger</Badge> : <Badge tone={n.active ? 'green' : 'gray'}>{n.active ? 'Active' : 'Paused'}</Badge>,
            },
            { key: 'createdAt', label: 'Created', render: (n) => formatDate(n.createdAt) },
          ]}
          actions={(n) => (
            <>
              <MenuItem icon="pencil" onClick={() => open(n)}>
                Edit
              </MenuItem>
              <MenuItem icon={n.active ? 'lock' : 'check'} onClick={() => actions.notificationRules.update(n.id, { active: !n.active })}>
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
      )}

      {tab === 'sent' && (
        <DataTable
          rows={mails}
          defaultSort={{ key: 'at', dir: 'desc' }}
          empty={<EmptyState icon="mail" title="No email yet" message="Welcome emails, notifications, sign-up confirmations and invoices are listed here as they go out." />}
          columns={[
            { key: 'at', label: 'When', render: (m) => formatDateTime(m.at) },
            { key: 'to', label: 'To' },
            {
              key: 'subject',
              label: 'Subject',
              render: (m) => (
                <button className="link text-left" onClick={() => setReading(m)}>
                  {m.subject}
                </button>
              ),
            },
            { key: 'kind', label: 'Kind', render: (m) => MAIL_KIND[m.kind] || m.kind },
            {
              key: 'status',
              label: 'Status',
              render: (m) => {
                const [label, tone] = MAIL_STATUS[m.status] || [m.status, 'gray']
                return (
                  <span title={m.error || undefined}>
                    <Badge tone={tone}>{label}</Badge>
                  </span>
                )
              },
            },
          ]}
          actions={(m) => (
            <>
              <MenuItem icon="eye" onClick={() => setReading(m)}>
                Read
              </MenuItem>
              {m.status !== 'sent' && backend.mode === 'server' && (
                <MenuItem
                  icon="send"
                  onClick={async () => {
                    const res = await actions.rpc('outbox.retry', { id: m.id })
                    if (!res.ok) return toast(res.error, 'error')
                    toast(res.mail?.status === 'sent' ? 'Sent.' : res.mail?.error || 'It could not be sent.', res.mail?.status === 'sent' ? 'success' : 'error')
                  }}
                >
                  Send again
                </MenuItem>
              )}
            </>
          )}
        />
      )}

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
            <Button onClick={save} disabled={!draft.name.trim()}>
              Save
            </Button>
          </>
        }
      >
        <Field label="Name" required>
          <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5">
          <Field label="Trigger event">
            <Select value={draft.event} onChange={(e) => setDraft({ ...draft, event: e.target.value })}>
              {!EVENTS.includes(draft.event) && <option>{draft.event}</option>}
              {EVENTS.map((ev) => (
                <option key={ev}>{ev}</option>
              ))}
            </Select>
          </Field>
          <Field label="Recipient">
            <Select value={draft.recipient} onChange={(e) => setDraft({ ...draft, recipient: e.target.value })}>
              {NOTIFICATION_RECIPIENTS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Subject" hint="Leave empty to use the notification's name.">
          <Input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
        </Field>
        <Field label="Message" hint="Leave empty for a standard message that fits the trigger.">
          <Textarea rows={6} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
        </Field>
        <div className="mb-5">
          <p className="label">Placeholders</p>
          <p className="hint mb-2">Click one to add it to the message. Each is replaced with the real value when the message is sent.</p>
          <div className="flex flex-wrap gap-1.5">
            {PLACEHOLDERS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setDraft({ ...draft, body: `${draft.body}{${p}}` })}
                className="bg-gray-100 hover:bg-brand-50 rounded px-2 py-1 text-[12.5px] font-mono text-ink-700"
              >
                {`{${p}}`}
              </button>
            ))}
          </div>
        </div>
        <Toggle checked={draft.active} onChange={(v) => setDraft({ ...draft, active: v })} label="Notification is active" />
      </Drawer>

      <Modal open={!!reading} onClose={() => setReading(null)} title={reading?.subject} subtitle={reading ? `To ${reading.to} · ${formatDateTime(reading.at)}` : ''}>
        {reading && (
          <>
            {reading.error && <p className="text-[13px] text-red-700 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">{reading.error}</p>}
            <p className="text-[14px] leading-6 whitespace-pre-line">{reading.body}</p>
          </>
        )}
      </Modal>

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
