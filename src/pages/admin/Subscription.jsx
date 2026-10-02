import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, EmptyState, Field, Icon, Input, PageHeader, Progress, Textarea } from '../../components/ui'
import { useData } from '../../context/DataContext'
import { useToast } from '../../context/ToastContext'
import { withSettingDefaults } from '../../lib/seed'

/** Plan, usage and billing details for the portal. GA Healthcare owns its portal, so there is no plan to buy. */
export default function Subscription() {
  const { settings, users, courses, branches, groups, backend, actions } = useData()
  const toast = useToast()
  // Compared by content, so a background refresh of the portal's data does not wipe what is being typed.
  const savedKey = JSON.stringify(withSettingDefaults(settings).subscription)
  const saved = useMemo(() => JSON.parse(savedKey), [savedKey])
  const [draft, setDraft] = useState(saved)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setDraft(saved)
    setDirty(false)
  }, [saved])

  const change = (changes) => {
    setDraft((d) => ({ ...d, ...changes }))
    setDirty(true)
  }
  const limit = (key) => (e) => change({ [key]: Math.max(0, Math.floor(Number(e.target.value) || 0)) })

  const activeUsers = users.filter((u) => u.active).length
  const activeCourses = courses.filter((c) => c.status === 'active').length
  const shared = backend.mode === 'server'

  return (
    <div>
      <PageHeader title="Subscription" subtitle="Your plan, how much of it is in use, and the details that go on invoices." />

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <section className="card card-pad lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <p className="text-[13px] font-semibold tracking-[0.12em] uppercase text-ink-700 mb-2">Current plan</p>
              <h2 className="text-[20px] leading-7 font-bold text-ink-900 flex items-center gap-3">
                Organization portal
                <Badge tone="green">Active</Badge>
              </h2>
              <p className="hint mt-1.5 max-w-lg">
                This portal belongs to {settings.siteName}. There is no per-user fee and nothing to renew; the limits
                below are your own.
              </p>
            </div>
            <span className="w-12 h-12 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
              <Icon name="card" className="w-6 h-6" />
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-6">
            <Usage label="Active users" used={activeUsers} limit={draft.userLimit} note={`${users.length} accounts in total`} />
            <Usage label="Active courses" used={activeCourses} limit={draft.courseLimit} note={`${courses.length} courses in total`} />
            <Usage label="Branches" used={branches.length} />
            <Usage label="Groups" used={groups.length} />
          </div>
        </section>

        <section className="card card-pad">
          <p className="text-[13px] font-semibold tracking-[0.12em] uppercase text-ink-700 mb-4">Hosting</p>
          <ul className="space-y-4 text-[14px]">
            <Fact icon="globe" label="Address" value={settings.domain} />
            <Fact
              icon="archive"
              label="Data"
              value={shared ? 'Shared database' : 'This browser only'}
              note={shared ? 'Accounts work on any device.' : 'Connect a database to share accounts across devices.'}
            />
            <Fact icon="mail" label="Support" value={settings.supportEmail} />
          </ul>
        </section>
      </div>

      <section className="card card-pad mb-6">
        <h2 className="card-title mb-1.5">Limits</h2>
        <p className="hint mb-5">Set a ceiling to be warned about on this page. 0 means no limit.</p>
        <div className="grid sm:grid-cols-2 gap-x-5 max-w-2xl">
          <Field label="Active user limit">
            <Input type="number" min={0} value={draft.userLimit} onChange={limit('userLimit')} />
          </Field>
          <Field label="Active course limit">
            <Input type="number" min={0} value={draft.courseLimit} onChange={limit('courseLimit')} />
          </Field>
        </div>

        <h2 className="card-title mt-3 mb-1.5">Billing details</h2>
        <p className="hint mb-5">Kept on file for when the portal issues invoices.</p>
        <div className="grid sm:grid-cols-2 gap-x-5 max-w-2xl">
          <Field label="Company name">
            <Input value={draft.company} onChange={(e) => change({ company: e.target.value })} />
          </Field>
          <Field label="Billing email">
            <Input type="email" value={draft.billingEmail} onChange={(e) => change({ billingEmail: e.target.value })} />
          </Field>
          <Field label="Billing address" className="sm:col-span-2">
            <Textarea rows={3} value={draft.address} onChange={(e) => change({ address: e.target.value })} />
          </Field>
          <Field label="Tax ID">
            <Input value={draft.taxId} onChange={(e) => change({ taxId: e.target.value })} />
          </Field>
        </div>

        <div className="flex gap-4 pt-1">
          <Button
            disabled={!dirty}
            onClick={() => {
              actions.updateSettings({ subscription: draft })
              toast('Subscription details saved.')
            }}
          >
            Save
          </Button>
          <Button
            variant="ghost"
            disabled={!dirty}
            onClick={() => {
              setDraft(saved)
              setDirty(false)
            }}
          >
            Cancel
          </Button>
        </div>
      </section>

      <section className="card">
        <div className="px-6 pt-6">
          <h2 className="card-title">Invoices</h2>
        </div>
        <EmptyState icon="file" title="No invoices" message="This portal is not billed, so there is nothing to pay or download here." />
      </section>
    </div>
  )
}

function Usage({ label, used, limit = 0, note }) {
  const over = limit > 0 && used > limit
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <span className="text-[14px] text-ink-900">{label}</span>
        <span className="text-[14px]">
          <span className={over ? 'font-bold text-red-600' : 'font-bold text-ink-900'}>{used}</span>
          <span className="text-ink-500"> {limit > 0 ? `of ${limit}` : '· no limit'}</span>
        </span>
      </div>
      {limit > 0 && <Progress value={(used / limit) * 100} tone={over ? 'brand' : 'green'} />}
      {over ? (
        <p className="text-[13px] text-red-600 mt-1.5">Over the limit you set.</p>
      ) : (
        note && <p className="hint mt-1.5">{note}</p>
      )}
    </div>
  )
}

function Fact({ icon, label, value, note }) {
  return (
    <li className="flex items-start gap-3.5">
      <Icon name={icon} className="w-[20px] h-[20px] text-ink-700 mt-0.5 shrink-0" />
      <span className="min-w-0">
        <span className="block hint">{label}</span>
        <span className="block text-ink-900 break-words">{value || '-'}</span>
        {note && <span className="block hint">{note}</span>}
      </span>
    </li>
  )
}
