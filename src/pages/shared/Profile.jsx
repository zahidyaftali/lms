import { useState } from 'react'
import {
  Avatar,
  Badge,
  Button,
  Field,
  Icon,
  Input,
  PageHeader,
  Tabs,
  Textarea,
} from '../../components/ui'
import { useData, useSelectors } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { readAsDataURL } from '../../lib/fileStore'
import { duration, formatDate, fullName } from '../../lib/utils'

export default function Profile() {
  const { branches, groups, certificates, actions, settings } = useData()
  const { enrollmentsOf, progressOf, courseById } = useSelectors()
  const { user } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('details')
  const [draft, setDraft] = useState(user)
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' })
  const [error, setError] = useState('')

  const enrollments = enrollmentsOf(user.id)
  const branch = branches.find((b) => b.id === user.branchId)

  function saveDetails() {
    actions.updateUser(user.id, {
      firstName: draft.firstName,
      lastName: draft.lastName,
      phone: draft.phone,
      bio: draft.bio,
      avatar: draft.avatar,
    })
    toast('Profile updated.')
  }

  function changePassword() {
    setError('')
    if (passwords.current !== user.password) return setError('Your current password is not correct.')
    if (passwords.next.length < (settings.users.passwordMinLength || 8))
      return setError(`Use at least ${settings.users.passwordMinLength || 8} characters.`)
    if (passwords.next !== passwords.confirm) return setError('The new passwords do not match.')
    actions.updateUser(user.id, { password: passwords.next })
    setPasswords({ current: '', next: '', confirm: '' })
    toast('Password changed.')
  }

  return (
    <div>
      <PageHeader title="My profile" subtitle="Your account details and training record." />

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
        <aside className="card card-pad text-center">
          <div className="relative inline-block">
            <Avatar user={draft} size={96} className="mx-auto" />
            <label className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-brand-700 text-white flex items-center justify-center cursor-pointer hover:bg-brand-800">
              <Icon name="pencil" className="w-4 h-4" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (file) setDraft({ ...draft, avatar: await readAsDataURL(file) })
                  e.target.value = ''
                }}
              />
            </label>
          </div>
          <p className="mt-4 text-[17px] font-semibold">{fullName(user)}</p>
          <p className="hint">{user.email}</p>
          <Badge tone="blue" className="mt-3">
            {user.userType}
          </Badge>

          <dl className="mt-6 pt-5 border-t border-line space-y-3.5 text-left text-[13.5px]">
            <Row label="Branch" value={branch?.name || '-'} />
            <Row
              label="Groups"
              value={(user.groupIds || []).map((id) => groups.find((g) => g.id === id)?.name).filter(Boolean).join(', ') || '-'}
            />
            <Row label="Member since" value={formatDate(user.registeredAt)} />
            <Row label="Courses" value={enrollments.length} />
            <Row label="Training time" value={duration(enrollments.reduce((s, e) => s + (e.timeSpentMin || 0), 0))} />
          </dl>
        </aside>

        <section className="card">
          <div className="px-6 pt-5">
            <Tabs
              tabs={[
                { value: 'details', label: 'Details' },
                { value: 'security', label: 'Password' },
                { value: 'training', label: 'Training record', count: enrollments.length },
              ]}
              active={tab}
              onChange={setTab}
            />
          </div>

          <div className="p-6">
            {tab === 'details' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5">
                  <Field label="First name">
                    <Input value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} />
                  </Field>
                  <Field label="Last name">
                    <Input value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} />
                  </Field>
                  <Field label="Email" hint="Contact the program office to change your email address." className="sm:col-span-2">
                    <Input value={draft.email} disabled className="bg-gray-50 text-ink-500" />
                  </Field>
                  <Field label="Phone" className="sm:col-span-2">
                    <Input value={draft.phone || ''} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
                  </Field>
                  <Field label="About me" className="sm:col-span-2">
                    <Textarea rows={4} value={draft.bio || ''} onChange={(e) => setDraft({ ...draft, bio: e.target.value })} />
                  </Field>
                </div>
                <Button onClick={saveDetails}>Save changes</Button>
              </>
            )}

            {tab === 'security' && (
              <div className="max-w-md">
                <Field label="Current password">
                  <Input
                    type="password"
                    value={passwords.current}
                    onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                  />
                </Field>
                <Field label="New password" hint={`At least ${settings.users.passwordMinLength || 8} characters.`}>
                  <Input
                    type="password"
                    value={passwords.next}
                    onChange={(e) => setPasswords({ ...passwords, next: e.target.value })}
                  />
                </Field>
                <Field label="Confirm new password" error={error}>
                  <Input
                    type="password"
                    value={passwords.confirm}
                    onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                  />
                </Field>
                <Button onClick={changePassword}>Change password</Button>
              </div>
            )}

            {tab === 'training' && (
              <ul className="divide-y divide-line">
                {enrollments.length === 0 && <p className="hint">No courses assigned yet.</p>}
                {enrollments.map((e) => {
                  const course = courseById(e.courseId)
                  const certificate = certificates.find((c) => c.userId === user.id && c.courseId === e.courseId)
                  return (
                    <li key={e.id} className="py-4 flex items-center gap-4">
                      <span className="w-9 h-9 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                        <Icon name="book" className="w-[18px] h-[18px]" strokeWidth={1.6} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[14.5px] truncate">{course?.name}</span>
                        <span className="block hint">
                          Enrolled {formatDate(e.enrolledAt)} · {progressOf(e)}% complete
                        </span>
                      </span>
                      {certificate && <Badge tone="green">Certificate {certificate.code}</Badge>}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-ink-900 text-right">{value}</dd>
    </div>
  )
}
