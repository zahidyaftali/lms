import { useState } from 'react'
import { Badge, Button, Checkbox, Field, Icon, Input, Modal, OptionList, Select, SetupNote, Textarea, Toggle } from '../../components/ui'
import { DEFAULT_SETTINGS } from '../../lib/seed'
import { cx, formatDate, uid } from '../../lib/utils'
import { NumberField, Section, SettingRow } from './SettingsParts'

/* Account & Settings tabs for features the portal stores settings for but does not run yet. */

export const CURRENCIES = ['US Dollar ($)', 'Euro (€)', 'British Pound (£)', 'Canadian Dollar (C$)']

/* ------------------------------------------------------------------ skills */

export function SkillsTab({ draft, setGroup }) {
  const s = draft.skills
  const set = (changes) => setGroup('skills', changes)
  return (
    <>
      <SetupNote>
        These settings are saved now and take effect once skills are opened to learners. Skills themselves are managed
        on the Skills page.
      </SetupNote>

      <Section title="Skills">
        <SettingRow label="Skills" hint="Lets learners build skills through assessments and the courses linked to each skill.">
          <Toggle checked={s.enabled} onChange={(v) => set({ enabled: v })} />
        </SettingRow>
      </Section>

      <Section title="Skill settings" muted={!s.enabled}>
        <SettingRow label="Activate skills for learners" hint="Learners see their skills and can work towards new ones.">
          <Toggle checked={s.learners} onChange={(v) => set({ learners: v })} disabled={!s.enabled} />
        </SettingRow>
        <SettingRow
          label="Activate skill recommendations for learners"
          hint="Learners can recommend skills to administrators and endorse colleagues who have a skill."
        >
          <Toggle checked={s.recommendations} onChange={(v) => set({ recommendations: v })} disabled={!s.enabled} />
        </SettingRow>
        <SettingRow label="Skill levels" hint="Skills have more than one level, each with its own assessment.">
          <Toggle checked={s.levels} onChange={(v) => set({ levels: v })} disabled={!s.enabled} />
        </SettingRow>
      </Section>

      <Section title="Assessments" muted={!s.enabled}>
        <SettingRow label="Questions per assessment">
          <NumberField value={s.questions} onChange={(v) => set({ questions: v })} unit="questions" min={1} />
        </SettingRow>
        <SettingRow label="Pass mark">
          <NumberField value={s.passMark} onChange={(v) => set({ passMark: v })} unit="%" max={100} />
        </SettingRow>
        <SettingRow label="Retry after" hint="How long a learner waits before taking a failed assessment again.">
          <NumberField value={s.retryDays} onChange={(v) => set({ retryDays: v })} unit="days" />
        </SettingRow>
        <SettingRow label="Skill expires after" hint="0 means a skill never expires.">
          <NumberField value={s.expiryMonths} onChange={(v) => set({ expiryMonths: v })} unit="months" />
        </SettingRow>
      </Section>
    </>
  )
}

/* ------------------------------------------------------------ gamification */

const POINT_RULES = [
  ['login', 'Each sign-in'],
  ['unit', 'Each completed unit'],
  ['course', 'Each completed course'],
  ['certificate', 'Each certificate'],
  ['test', 'Each passed test'],
  ['assignment', 'Each passed assignment'],
  ['session', 'Each attended instructor-led session'],
  ['discussion', 'Each discussion topic or comment'],
  ['upvote', 'Each upvote on a discussion comment'],
]

const BADGE_TYPES = [
  ['activity', 'Activity', 'Signing in often'],
  ['learning', 'Learning', 'Completing courses'],
  ['test', 'Test', 'Passing tests'],
  ['assignment', 'Assignment', 'Passing assignments'],
  ['perfectionism', 'Perfectionism', 'Scoring 90% or more'],
  ['survey', 'Survey', 'Answering surveys'],
  ['communication', 'Communication', 'Joining discussions'],
  ['certification', 'Certification', 'Earning certificates'],
]

const BOARD_COLUMNS = [
  ['levels', 'Levels'],
  ['points', 'Points'],
  ['badges', 'Badges'],
  ['courses', 'Completed courses'],
  ['certifications', 'Certificates'],
]

export function GamificationTab({ draft, setGroup }) {
  const g = draft.gamification
  const part = (key) => (changes) => setGroup('gamification', { [key]: { ...g[key], ...changes } })
  const points = part('points')
  const badges = part('badges')
  const levels = part('levels')
  const rewards = part('rewards')
  const board = part('leaderboard')
  const off = !g.enabled

  return (
    <>
      <SetupNote>
        These settings are saved now. Points, badges and the leaderboard are not shown to learners yet.
      </SetupNote>

      <Section title="Gamification">
        <SettingRow label="Gamification" hint="Rewards learners with points, badges and levels across the portal and its branches.">
          <Toggle checked={g.enabled} onChange={(v) => setGroup('gamification', { enabled: v })} />
        </SettingRow>
      </Section>

      <Section title="Points" muted={off}>
        <SettingRow label="Points" hint="Learners collect points for what they do. Set a rule to 0 to switch it off.">
          <Toggle checked={g.points.enabled} onChange={(v) => points({ enabled: v })} disabled={off} />
        </SettingRow>
        {g.points.enabled &&
          POINT_RULES.map(([key, label]) => (
            <SettingRow key={key} label={label}>
              <NumberField value={g.points[key]} onChange={(v) => points({ [key]: v })} unit="points" />
            </SettingRow>
          ))}
      </Section>

      <Section title="Badges" muted={off}>
        <SettingRow label="Badges" hint="Learners earn a badge each time they reach a milestone.">
          <Toggle checked={g.badges.enabled} onChange={(v) => badges({ enabled: v })} disabled={off} />
        </SettingRow>
        {g.badges.enabled && (
          <>
            <SettingRow label="Badge set">
              <Select value={g.badges.set} onChange={(e) => badges({ set: e.target.value })}>
                <option>Classic</option>
                <option>Modern</option>
                <option>Outline</option>
              </Select>
            </SettingRow>
            <SettingRow label="Badge types" hint="Each type has eight badges, from the first milestone to the hardest.">
              <OptionList>
                {BADGE_TYPES.map(([key, label, what]) => (
                  <div key={key}>
                    <Checkbox label={label} checked={g.badges[key]} onChange={(v) => badges({ [key]: v })} />
                    <p className="hint pl-[28px]">{what}</p>
                  </div>
                ))}
              </OptionList>
            </SettingRow>
          </>
        )}
      </Section>

      <Section title="Levels" muted={off}>
        <SettingRow label="Levels" hint="Learners move up a level as they collect points, courses or badges. 0 switches a rule off.">
          <Toggle checked={g.levels.enabled} onChange={(v) => levels({ enabled: v })} disabled={off} />
        </SettingRow>
        {g.levels.enabled && (
          <>
            <SettingRow label="Level up every">
              <NumberField value={g.levels.everyPoints} onChange={(v) => levels({ everyPoints: v })} unit="points" />
            </SettingRow>
            <SettingRow label="Level up every">
              <NumberField value={g.levels.everyCourses} onChange={(v) => levels({ everyCourses: v })} unit="completed courses" />
            </SettingRow>
            <SettingRow label="Level up every">
              <NumberField value={g.levels.everyBadges} onChange={(v) => levels({ everyBadges: v })} unit="badges" />
            </SettingRow>
          </>
        )}
      </Section>

      <Section title="Rewards" muted={off}>
        <SettingRow label="Rewards" hint="Gives learners a discount on paid courses once they reach a target. 0 switches a reward off.">
          <Toggle checked={g.rewards.enabled} onChange={(v) => rewards({ enabled: v })} disabled={off} />
        </SettingRow>
        {g.rewards.enabled &&
          [
            ['points', 'pointsDiscount', 'Discount for points', '% off once a learner has', 'points'],
            ['badges', 'badgesDiscount', 'Discount for badges', '% off once a learner has', 'badges'],
            ['level', 'levelDiscount', 'Discount for a level', '% off once a learner reaches level', ''],
          ].map(([target, discount, label, lead, tail]) => (
            <SettingRow key={target} label={label}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
                <NumberField value={g.rewards[discount]} onChange={(v) => rewards({ [discount]: v })} unit={lead} max={100} />
                <NumberField value={g.rewards[target]} onChange={(v) => rewards({ [target]: v })} unit={tail} />
              </div>
            </SettingRow>
          ))}
      </Section>

      <Section title="Leaderboard" muted={off}>
        <SettingRow label="Leaderboard" hint="Ranks learners against each other.">
          <Toggle checked={g.leaderboard.enabled} onChange={(v) => board({ enabled: v })} disabled={off} />
        </SettingRow>
        {g.leaderboard.enabled && (
          <SettingRow label="Show on the leaderboard">
            <OptionList>
              {BOARD_COLUMNS.map(([key, label]) => (
                <Checkbox key={key} label={label} checked={g.leaderboard[key]} onChange={(v) => board({ [key]: v })} />
              ))}
            </OptionList>
          </SettingRow>
        )}
      </Section>

      <Section title="Reset">
        <SettingRow label="Gamification settings" hint="Puts every rule on this page back to how the portal started. Nothing changes until you save.">
          <Button variant="ghost" icon="refresh" onClick={() => setGroup('gamification', DEFAULT_SETTINGS.gamification)}>
            Reset to defaults
          </Button>
        </SettingRow>
      </Section>
    </>
  )
}

/* -------------------------------------------------------------- e-commerce */

const emptyCoupon = { code: '', percent: 10, expires: '', limit: 0 }

export function EcommerceTab({ draft, set, setGroup }) {
  const e = draft.ecommerce
  const update = (changes) => setGroup('ecommerce', changes)
  const [coupon, setCoupon] = useState(emptyCoupon)
  const code = coupon.code.trim().toUpperCase()
  const duplicate = e.coupons.some((c) => c.code === code)

  const addCoupon = () => {
    if (!code || duplicate) return
    update({ coupons: [...e.coupons, { ...coupon, id: uid('cp'), code, active: true }] })
    setCoupon(emptyCoupon)
  }

  return (
    <>
      <SetupNote>
        These settings are saved now. The portal does not take payments yet, so paid courses are still assigned by an
        administrator.
      </SetupNote>

      <Section title="Payments">
        <SettingRow label="Payment processor" hint="Payments go straight to your own account with the processor.">
          <Select value={e.processor} onChange={(ev) => update({ processor: ev.target.value })}>
            <option>None</option>
            <option>Stripe</option>
            <option>PayPal</option>
          </Select>
          {e.processor === 'Stripe' && <p className="hint mt-2">Connecting the Stripe account is the next step once payments are switched on.</p>}
        </SettingRow>
        {e.processor === 'PayPal' && (
          <SettingRow label="PayPal account email" hint="The email address of the PayPal business account that receives payments.">
            <Input type="email" value={e.paypalEmail} onChange={(ev) => update({ paypalEmail: ev.target.value })} />
          </SettingRow>
        )}
        <SettingRow label="Currency" hint="Course prices are shown and charged in this currency.">
          <Select value={draft.currency} onChange={(ev) => set({ currency: ev.target.value })}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </SettingRow>
      </Section>

      <Section title="Subscription">
        <SettingRow label="Subscription" hint="Learners pay one recurring fee for access to every paid course. Needs Stripe.">
          <Toggle checked={e.subscription.enabled} onChange={(v) => update({ subscription: { ...e.subscription, enabled: v } })} />
        </SettingRow>
        {e.subscription.enabled && (
          <>
            <SettingRow label="Fee">
              <div className="flex flex-wrap items-center gap-3">
                <NumberField
                  value={e.subscription.fee}
                  onChange={(v) => update({ subscription: { ...e.subscription, fee: v } })}
                  unit="per"
                />
                <div className="w-36">
                  <Select
                    value={e.subscription.interval}
                    onChange={(ev) => update({ subscription: { ...e.subscription, interval: ev.target.value } })}
                    aria-label="Billing interval"
                  >
                    <option value="Monthly">month</option>
                    <option value="Annually">year</option>
                  </Select>
                </div>
              </div>
            </SettingRow>
            <SettingRow label="Free trial" hint="0 means the first payment is taken straight away.">
              <NumberField
                value={e.subscription.trialDays}
                onChange={(v) => update({ subscription: { ...e.subscription, trialDays: v } })}
                unit="days"
              />
            </SettingRow>
          </>
        )}
      </Section>

      <Section title="Discounts">
        <SettingRow label="Global discount" hint="Taken off the price of every paid course. 0 means no discount.">
          <NumberField value={e.globalDiscount} onChange={(v) => update({ globalDiscount: v })} unit="% off" max={100} />
        </SettingRow>
        <SettingRow label="Credits" hint="Administrators give learners credits, which they spend on courses instead of paying.">
          <Toggle checked={e.credits} onChange={(v) => update({ credits: v })} />
        </SettingRow>

        <div>
          <p className="text-[14.5px] font-medium text-ink-900">Coupons</p>
          <p className="hint mt-1 mb-4">Codes learners enter at checkout for a discount.</p>

          {e.coupons.length > 0 && (
            <div className="border border-line rounded-md divide-y divide-line mb-4">
              {e.coupons.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <code className="bg-gray-100 rounded px-2 py-0.5 text-[13px] font-semibold">{c.code}</code>
                  <span className="text-[14px]">{c.percent}% off</span>
                  <span className="hint flex-1 min-w-[140px]">
                    {c.expires ? `Until ${formatDate(c.expires)}` : 'No end date'} · {c.limit > 0 ? `${c.limit} uses` : 'Unlimited uses'}
                  </span>
                  <Toggle
                    checked={c.active}
                    onChange={(v) => update({ coupons: e.coupons.map((x) => (x.id === c.id ? { ...x, active: v } : x)) })}
                  />
                  <button
                    type="button"
                    title="Delete coupon"
                    aria-label={`Delete coupon ${c.code}`}
                    onClick={() => update({ coupons: e.coupons.filter((x) => x.id !== c.id) })}
                    className="p-1.5 rounded text-ink-700 hover:text-red-600 hover:bg-red-50"
                  >
                    <Icon name="trash" className="w-[18px] h-[18px]" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-[1.2fr_0.8fr_1fr_0.8fr_auto] gap-3 items-end">
            <Field label="Code" className="!mb-0" error={duplicate ? 'This code already exists.' : undefined}>
              <Input value={coupon.code} onChange={(ev) => setCoupon({ ...coupon, code: ev.target.value.toUpperCase() })} placeholder="FALL2026" />
            </Field>
            <Field label="% off" className="!mb-0">
              <Input
                type="number"
                min={1}
                max={100}
                value={coupon.percent}
                onChange={(ev) => setCoupon({ ...coupon, percent: Math.min(100, Math.max(1, Number(ev.target.value) || 1)) })}
              />
            </Field>
            <Field label="Valid until" className="!mb-0">
              <Input type="date" value={coupon.expires} onChange={(ev) => setCoupon({ ...coupon, expires: ev.target.value })} />
            </Field>
            <Field label="Uses (0 = any)" className="!mb-0">
              <Input
                type="number"
                min={0}
                value={coupon.limit}
                onChange={(ev) => setCoupon({ ...coupon, limit: Math.max(0, Number(ev.target.value) || 0) })}
              />
            </Field>
            <Button variant="outline" onClick={addCoupon} disabled={!code || duplicate} className={cx('col-span-2 lg:col-span-1', duplicate && 'lg:mb-[26px]')}>
              Add coupon
            </Button>
          </div>
        </div>
      </Section>

      <Section title="Invoices">
        <SettingRow label="Invoices" hint="Emails the learner an invoice after each payment.">
          <Toggle checked={e.invoices.enabled} onChange={(v) => update({ invoices: { ...e.invoices, enabled: v } })} />
        </SettingRow>
        {e.invoices.enabled && (
          <>
            <SettingRow label="Your details" hint="Company name, address and tax number as they should appear on the invoice.">
              <Textarea rows={4} value={e.invoices.details} onChange={(ev) => update({ invoices: { ...e.invoices, details: ev.target.value } })} />
            </SettingRow>
            <SettingRow label="Note" hint="Printed at the bottom of every invoice.">
              <Textarea rows={3} value={e.invoices.note} onChange={(ev) => update({ invoices: { ...e.invoices, note: ev.target.value } })} />
            </SettingRow>
          </>
        )}
      </Section>
    </>
  )
}

/* ------------------------------------------------------------ integrations */

const INTEGRATIONS = [
  {
    group: 'Video conferencing',
    items: [
      { id: 'zoom', name: 'Zoom', color: '#0b5cff', about: 'Run instructor-led sessions as Zoom meetings and webinars.', fields: [['accountId', 'Account ID'], ['clientId', 'Client ID']] },
      { id: 'teams', name: 'Microsoft Teams', color: '#4b53bc', about: 'Run instructor-led sessions as Teams meetings.', fields: [['tenantId', 'Tenant ID'], ['clientId', 'Client ID']] },
      { id: 'goto', name: 'GoTo Meeting', color: '#f68d2e', about: 'Run instructor-led sessions in GoTo Meeting, Webinar or Training.', fields: [['clientId', 'Client ID']] },
      { id: 'bbb', name: 'BigBlueButton', color: '#0f70d7', about: 'Run instructor-led sessions on your own BigBlueButton server.', fields: [['serverUrl', 'Server address']] },
    ],
  },
  {
    group: 'People & CRM',
    items: [
      { id: 'bamboohr', name: 'BambooHR', color: '#73c41d', about: 'Create portal accounts for new employees and keep their details in step.', fields: [['subdomain', 'Company subdomain']] },
      { id: 'salesforce', name: 'Salesforce', color: '#00a1e0', about: 'Open the portal inside Salesforce and report training progress there.', fields: [['domain', 'Salesforce domain']] },
    ],
  },
  {
    group: 'Automation & stores',
    items: [
      { id: 'zapier', name: 'Zapier', color: '#ff4f00', about: 'Connect the portal to thousands of other apps without code.', fields: [] },
      { id: 'shopify', name: 'Shopify', color: '#5a8a1f', about: 'Sell courses from a Shopify store.', fields: [['storeUrl', 'Store address']] },
      { id: 'woocommerce', name: 'WooCommerce', color: '#7f54b3', about: 'Sell courses from a WordPress store.', fields: [['storeUrl', 'Store address']] },
    ],
  },
]

export function IntegrationsTab({ draft, set, setGroup }) {
  const saved = draft.integrations
  const [open, setOpen] = useState(null)
  const [form, setForm] = useState({})

  const edit = (item) => {
    setOpen(item)
    setForm({ enabled: false, ...saved[item.id] })
  }

  return (
    <>
      <SetupNote>
        Connections are saved here but are not live yet. Sessions, accounts and sales still run inside the portal only.
      </SetupNote>

      {INTEGRATIONS.map(({ group, items }) => (
        <section key={group} className="mb-7">
          <h2 className="text-[13px] font-semibold tracking-[0.12em] uppercase text-ink-700 mb-4">{group}</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {items.map((item) => {
              const on = !!saved[item.id]?.enabled
              return (
                <div key={item.id} className="card p-5 flex items-start gap-4">
                  <span
                    className="w-11 h-11 rounded-md text-white text-[17px] font-bold flex items-center justify-center shrink-0"
                    style={{ background: item.color }}
                    aria-hidden="true"
                  >
                    {item.name[0]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-ink-900 flex flex-wrap items-center gap-2.5">
                      {item.name}
                      {on && <Badge tone="green">On</Badge>}
                    </p>
                    <p className="hint mt-1 mb-3.5">{item.about}</p>
                    <Button size="sm" variant={on ? 'ghost' : 'outline'} onClick={() => edit(item)}>
                      {on ? 'Manage' : 'Set up'}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}

      <Section title="API">
        <SettingRow label="Enable API" hint="Lets your other systems read and update portal data using an API key.">
          <Toggle checked={draft.api.enabled} onChange={(v) => set({ api: { ...draft.api, enabled: v } })} />
        </SettingRow>
        <SettingRow label="API key">
          <p className="hint">A key is issued here when API access goes live.</p>
        </SettingRow>
      </Section>

      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        title={open?.name}
        subtitle={open?.about}
        width="max-w-lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setGroup('integrations', { [open.id]: form })
                setOpen(null)
              }}
            >
              Done
            </Button>
          </>
        }
      >
        {open?.fields.map(([key, label]) => (
          <Field key={key} label={label}>
            <Input value={form[key] || ''} onChange={(ev) => setForm({ ...form, [key]: ev.target.value.trim() })} />
          </Field>
        ))}
        <Toggle
          checked={!!form.enabled}
          onChange={(v) => setForm({ ...form, enabled: v })}
          label={`Use ${open?.name}`}
          hint="Press Save at the bottom of the page to keep this change."
        />
      </Modal>
    </>
  )
}
