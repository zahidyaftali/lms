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
import InvoiceDialog, { OrderStatus, PAYMENT_METHOD, orderAmount } from '../../components/course/Invoice'
import { customFieldText } from '../../components/users/CustomFieldInputs'
import { useData, useSelectors } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { isAdmin } from '../../lib/permissions'
import { useToast } from '../../context/ToastContext'
import { shrinkImage } from '../../lib/fileStore'
import { hasSubscription } from '../../lib/commerce.js'
import { passwordHint, passwordPolicy, passwordProblem, statusLabel } from '../../lib/rules.js'
import { duration, formatDate, fullName } from '../../lib/utils'
import { useT } from '../../lib/i18n'

export default function Profile() {
  const { branches, groups, certificates, orders = [], actions, settings, server, backend } = useData()
  const { enrollmentsOf, progressOf, courseById } = useSelectors()
  const { user } = useAuth()
  const toast = useToast()
  const t = useT()
  const [tab, setTab] = useState('details')
  const [draft, setDraft] = useState(user)
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' })
  const [error, setError] = useState('')
  const [invoice, setInvoice] = useState(null)
  const policy = passwordPolicy(settings)

  const enrollments = enrollmentsOf(user.id)
  const branch = branches.find((b) => b.id === user.branchId)
  const myOrders = orders.filter((o) => o.userId === user.id).sort((a, b) => (a.at < b.at ? 1 : -1))
  const customFields = settings.users?.customFields || []

  function saveDetails() {
    actions.updateUser(user.id, {
      firstName: draft.firstName,
      lastName: draft.lastName,
      phone: draft.phone,
      bio: draft.bio,
      avatar: draft.avatar,
    })
    toast(t('Profile updated.'))
  }

  async function changePassword() {
    setError('')
    const problem = passwordProblem(passwords.next, policy)
    if (problem) return setError(problem)
    if (passwords.next !== passwords.confirm) return setError('The new passwords do not match.')
    const result = await actions.changePassword(user.id, passwords.current, passwords.next)
    if (!result.ok) return setError(result.error)
    setPasswords({ current: '', next: '', confirm: '' })
    toast('Password changed.')
  }

  return (
    <div>
      <PageHeader title={t('My profile')} subtitle={t('Your account details and training record.')} />

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
                  if (file && file.type.startsWith('image/'))
                    setDraft({ ...draft, avatar: await shrinkImage(file, { maxWidth: 256, maxHeight: 256 }) })
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
            <Row label={t('Branch')} value={branch?.name || '-'} />
            <Row
              label={t('Groups')}
              value={(user.groupIds || []).map((id) => groups.find((g) => g.id === id)?.name).filter(Boolean).join(', ') || '-'}
            />
            <Row label={t('Member since')} value={formatDate(user.registeredAt)} />
            <Row label={t('Courses')} value={enrollments.length} />
            <Row label={t('Training time')} value={duration(enrollments.reduce((s, e) => s + (e.timeSpentMin || 0), 0))} />
            {settings.ecommerce?.credits && <Row label={t('Credits')} value={Number(user.credits) || 0} />}
            {hasSubscription(user) && <Row label={t('Subscription')} value={`${t('until')} ${formatDate(user.subscribedUntil)}`} />}
            {customFields.map((f) => {
              const value = customFieldText(f, user.custom?.[f.id])
              return value ? <Row key={f.id} label={f.name} value={value} /> : null
            })}
            {backend.mode === 'server' && server?.twoFactor && <Row label={t('Two-factor')} value={t('On')} />}
          </dl>
        </aside>

        <section className="card">
          <div className="px-6 pt-5">
            <Tabs
              tabs={[
                { value: 'details', label: t('Details') },
                // Learners and instructors ask an administrator for a new password.
                ...(isAdmin(user) ? [{ value: 'security', label: 'Password' }] : []),
                { value: 'training', label: t('Training record'), count: enrollments.length },
                ...(myOrders.length ? [{ value: 'orders', label: t('Purchases'), count: myOrders.length }] : []),
              ]}
              active={tab}
              onChange={setTab}
            />
          </div>

          <div className="p-6">
            {tab === 'details' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5">
                  <Field label={t('First name')}>
                    <Input value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} />
                  </Field>
                  <Field label={t('Last name')}>
                    <Input value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} />
                  </Field>
                  <Field label={t('Email')} hint={t('Contact the program office to change your email address.')} className="sm:col-span-2">
                    <Input value={draft.email} disabled className="bg-gray-50 text-ink-500" />
                  </Field>
                  <Field label={t('Phone')} className="sm:col-span-2">
                    <Input value={draft.phone || ''} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
                  </Field>
                  <Field label={t('About me')} className="sm:col-span-2">
                    <Textarea rows={4} value={draft.bio || ''} onChange={(e) => setDraft({ ...draft, bio: e.target.value })} />
                  </Field>
                </div>
                <Button onClick={saveDetails}>{t('Save changes')}</Button>
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
                <Field label="New password" hint={passwordHint(policy)}>
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
                {enrollments.length === 0 && <p className="hint">{t('No courses assigned yet.')}</p>}
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
                          {t('Enrolled')} {formatDate(e.enrolledAt)} · {t(statusLabel(e.status))} · {progressOf(e)}%
                          {e.score != null ? ` · ${t('score')} ${e.score}%` : ''}
                        </span>
                      </span>
                      {certificate && <Badge tone="green">{certificate.code}</Badge>}
                    </li>
                  )
                })}
              </ul>
            )}

            {tab === 'orders' && (
              <ul className="divide-y divide-line">
                {myOrders.map((o) => (
                  <li key={o.id} className="py-4 flex flex-wrap items-center gap-4">
                    <span className="w-9 h-9 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                      <Icon name="cart" className="w-[18px] h-[18px]" strokeWidth={1.6} />
                    </span>
                    <span className="flex-1 min-w-[160px]">
                      <span className="block text-[14.5px]">{o.name}</span>
                      <span className="block hint">
                        {formatDate(o.at)} · {orderAmount(o)} · {PAYMENT_METHOD[o.method] || o.method}
                      </span>
                    </span>
                    <OrderStatus order={o} />
                    {o.status === 'paid' && Number(o.amount) > 0 && (
                      <Button size="sm" variant="ghost" onClick={() => setInvoice(o)}>
                        {o.invoiceNo ? t('Invoice') : t('Receipt')}
                      </Button>
                    )}
                    {o.status === 'pending' && (
                      <Button size="sm" variant="ghost" onClick={() => actions.cancelOrder(o.id)}>
                        {t('Cancel')}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <InvoiceDialog order={invoice} buyer={user} onClose={() => setInvoice(null)} />
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
