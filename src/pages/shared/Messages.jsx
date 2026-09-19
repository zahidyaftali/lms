import { useMemo, useState } from 'react'
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Field,
  Icon,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  Textarea,
} from '../../components/ui'
import { useData, useSelectors } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { cx, formatDateTime, fullName, timeAgo } from '../../lib/utils'

export default function Messages() {
  const { messages, users, actions } = useData()
  const { userById } = useSelectors()
  const { user, view } = useAuth()
  const toast = useToast()
  const [box, setBox] = useState('inbox')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(null)
  const [compose, setCompose] = useState(false)
  const [draft, setDraft] = useState({ toId: '', subject: '', body: '' })

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return messages
      .filter((m) => (box === 'inbox' ? m.toId === user.id : m.fromId === user.id))
      .filter((m) => !q || `${m.subject} ${m.body}`.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))
  }, [messages, box, query, user.id])

  // Learners message staff; staff can message anyone.
  const recipients = view === 'learner' ? users.filter((u) => u.role !== 'learner') : users.filter((u) => u.id !== user.id)

  function send() {
    if (!draft.toId || !draft.subject.trim()) return
    actions.messages.add({ ...draft, fromId: user.id, sentAt: new Date().toISOString(), read: false })
    setCompose(false)
    setDraft({ toId: '', subject: '', body: '' })
    toast('Message sent.')
  }

  return (
    <div>
      <PageHeader title="Messages" subtitle="Internal messages between learners, instructors and the program office.">
        <Button icon="send" onClick={() => setCompose(true)}>
          New message
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex rounded-md border border-line overflow-hidden">
          {['inbox', 'sent'].map((b) => (
            <button
              key={b}
              onClick={() => setBox(b)}
              className={cx(
                'h-11 px-5 text-[14px] capitalize transition',
                box === b ? 'bg-navy-900 text-white' : 'bg-white text-ink-700 hover:bg-gray-50',
              )}
            >
              {b}
            </button>
          ))}
        </div>
        <SearchInput value={query} onChange={setQuery} className="w-[250px]" />
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="mail"
            title={box === 'inbox' ? 'Your inbox is empty' : 'Nothing sent yet'}
            message="Messages you send and receive in the portal appear here."
          />
        </div>
      ) : (
        <ul className="card divide-y divide-line">
          {rows.map((m) => {
            const other = userById(box === 'inbox' ? m.fromId : m.toId)
            return (
              <li key={m.id}>
                <button
                  onClick={() => {
                    setOpen(m)
                    if (box === 'inbox' && !m.read) actions.markMessageRead(m.id)
                  }}
                  className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-gray-50"
                >
                  <Avatar user={other} size={38} />
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2.5">
                      <span className={cx('text-[14.5px] truncate', box === 'inbox' && !m.read ? 'font-semibold' : '')}>
                        {m.subject}
                      </span>
                      {box === 'inbox' && !m.read && <Badge tone="blue">New</Badge>}
                    </span>
                    <span className="block text-[13px] text-ink-500 truncate mt-0.5">
                      {box === 'inbox' ? 'From' : 'To'} {fullName(other)} · {m.body}
                    </span>
                  </span>
                  <span className="text-[12.5px] text-ink-400 whitespace-nowrap">{timeAgo(m.sentAt)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        title={open?.subject}
        subtitle={open ? `${fullName(userById(open.fromId))} · ${formatDateTime(open.sentAt)}` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(null)}>
              Close
            </Button>
            <Button
              icon="send"
              onClick={() => {
                setDraft({ toId: open.fromId, subject: `Re: ${open.subject}`, body: '' })
                setOpen(null)
                setCompose(true)
              }}
            >
              Reply
            </Button>
          </>
        }
      >
        <p className="text-[14.5px] leading-7 whitespace-pre-line">{open?.body}</p>
      </Modal>

      <Modal
        open={compose}
        onClose={() => setCompose(false)}
        title="New message"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCompose(false)}>
              Cancel
            </Button>
            <Button onClick={send}>Send</Button>
          </>
        }
      >
        <Field label="To" required>
          <Select value={draft.toId} onChange={(e) => setDraft({ ...draft, toId: e.target.value })}>
            <option value="">Choose a recipient</option>
            {recipients.map((u) => (
              <option key={u.id} value={u.id}>
                {fullName(u)} — {u.userType}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Subject" required>
          <Input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
        </Field>
        <Field label="Message">
          <Textarea rows={6} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
        </Field>
        <p className="hint flex items-center gap-2">
          <Icon name="info" className="w-4 h-4" />
          Messages stay inside the portal — they are not emailed.
        </p>
      </Modal>
    </div>
  )
}
