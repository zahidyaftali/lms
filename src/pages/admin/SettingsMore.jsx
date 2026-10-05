import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Checkbox, Field, Icon, Input, Modal, OptionList, Select, Textarea, Toggle } from '../../components/ui'
import { useData } from '../../context/DataContext'
import { useToast } from '../../context/ToastContext'
import { DEFAULT_SETTINGS } from '../../lib/settingsDefaults.js'
import { CURRENCIES as CURRENCY_CODES } from '../../lib/commerce.js'
import { WEBHOOK_EVENTS } from '../../lib/engine.js'
import { copyText, cx, formatDate, formatDateTime, uid } from '../../lib/utils'
import { NeedsServer, NumberField, SecretField, Section, SettingRow, useServer } from './SettingsParts'

/* Account & Settings tabs: Skills, Gamification, E-commerce and Integrations. */

export const CURRENCIES = Object.keys(CURRENCY_CODES)

/* ------------------------------------------------------------------ skills */

export function SkillsTab({ draft, setGroup }) {
  const s = draft.skills
  const set = (changes) => setGroup('skills', changes)
  return (
    <>
      <Section title="Skills">
        <SettingRow label="Skills" hint="Lets learners build skills through assessments and the courses linked to each skill. Skills themselves are managed on the Skills page.">
          <Toggle checked={s.enabled} onChange={(v) => set({ enabled: v })} />
        </SettingRow>
      </Section>

      <Section title="Skill settings" muted={!s.enabled}>
        <SettingRow label="Activate skills for learners" hint="Learners get a Skills page showing the skills they hold, the courses that teach each one, and its assessment.">
          <Toggle checked={s.learners} onChange={(v) => set({ learners: v })} disabled={!s.enabled} />
        </SettingRow>
        <SettingRow label="Activate skill recommendations for learners" hint="Learners can suggest a new skill; the suggestion arrives in every administrator's messages.">
          <Toggle checked={s.recommendations} onChange={(v) => set({ recommendations: v })} disabled={!s.enabled} />
        </SettingRow>
        <SettingRow label="Skill levels" hint="A skill has three levels — Beginner, Intermediate, Advanced. Each time a learner passes the assessment they move up one.">
          <Toggle checked={s.levels} onChange={(v) => set({ levels: v })} disabled={!s.enabled} />
        </SettingRow>
      </Section>

      <Section title="Assessments" muted={!s.enabled}>
        <p className="hint -mt-3">An assessment draws its questions at random from the question bank you write for each skill (Skills → a skill → Assessment).</p>
        <SettingRow label="Questions per assessment" hint="Fewer are used when a skill's bank is smaller.">
          <NumberField value={s.questions} onChange={(v) => set({ questions: v })} unit="questions" min={1} />
        </SettingRow>
        <SettingRow label="Pass mark">
          <NumberField value={s.passMark} onChange={(v) => set({ passMark: v })} unit="%" max={100} />
        </SettingRow>
        <SettingRow label="Retry after" hint="How long a learner waits before taking a failed assessment again.">
          <NumberField value={s.retryDays} onChange={(v) => set({ retryDays: v })} unit="days" />
        </SettingRow>
        <SettingRow label="Skill expires after" hint="A skill earned by assessment lapses after this long and can be earned again. 0 means it never expires.">
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
  ['perfectionism', 'Perfectionism', 'Scoring 90% or more on tests'],
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
      <Section title="Gamification">
        <SettingRow
          label="Gamification"
          hint="Learners get an Achievements page with their points, badges, level and the leaderboard. Everything is worked out from what they have actually done, so changing a rule re-scores everyone."
        >
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
          <SettingRow label="Badge types" hint="Each type has eight badges, from the first milestone (Newbie) to the hardest (Grandmaster).">
            <OptionList>
              {BADGE_TYPES.map(([key, label, what]) => (
                <div key={key}>
                  <Checkbox label={label} checked={g.badges[key]} onChange={(v) => badges({ [key]: v })} />
                  <p className="hint pl-[28px]">{what}</p>
                </div>
              ))}
            </OptionList>
          </SettingRow>
        )}
      </Section>

      <Section title="Levels" muted={off}>
        <SettingRow label="Levels" hint="Learners move up a level as they collect points, courses or badges. 0 switches a rule off. The highest level is 20.">
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
        <SettingRow label="Rewards" hint="Gives learners a discount on paid courses once they reach a target. The best discount they have earned is taken off at checkout when no coupon is used. 0 switches a reward off.">
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
        <SettingRow label="Leaderboard" hint="Ranks learners against each other by points.">
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
          <Button variant="ghost" icon="refresh" onClick={() => setGroup('gamification', { ...DEFAULT_SETTINGS.gamification, enabled: g.enabled })}>
            Reset to defaults
          </Button>
        </SettingRow>
      </Section>
    </>
  )
}

/* -------------------------------------------------------------- e-commerce */

const emptyCoupon = { code: '', percent: 10, expires: '', limit: 0 }

export function EcommerceTab({ draft, set, setGroup, secrets }) {
  const e = draft.ecommerce
  const update = (changes) => setGroup('ecommerce', changes)
  const [coupon, setCoupon] = useState(emptyCoupon)
  const code = coupon.code.trim().toUpperCase()
  const duplicate = e.coupons.some((c) => c.code === code)
  const stripeKey = secrets.secrets.stripeSecretKey?.set

  const addCoupon = () => {
    if (!code || duplicate) return
    update({ coupons: [...e.coupons, { ...coupon, id: uid('cp'), code, active: true, used: 0 }] })
    setCoupon(emptyCoupon)
  }

  return (
    <>
      <Section title="Payments">
        <p className="hint -mt-3">
          A course with a price is bought from the catalog once at least one way to pay is switched on here. With none, learners request the course and
          you enroll them. Orders are listed under{' '}
          <Link className="link" to="/reports?tab=sales">
            Reports → Sales
          </Link>
          .
        </p>
        <SettingRow label="Payment processor" hint="Payments go straight to your own account with the processor.">
          <Select value={e.processor} onChange={(ev) => update({ processor: ev.target.value })}>
            <option>None</option>
            <option>Stripe</option>
            <option>PayPal</option>
          </Select>
        </SettingRow>
        {e.processor === 'Stripe' && (
          <SettingRow
            label="Stripe secret key"
            hint="From your Stripe dashboard → Developers → API keys. Learners pay on Stripe's own checkout page and are enrolled the moment Stripe confirms the payment."
          >
            <SecretField name="stripeSecretKey" secrets={secrets} placeholder="sk_live_…" />
            {secrets.server && !stripeKey && <p className="hint mt-2">Card payment is offered to learners once a key is saved.</p>}
          </SettingRow>
        )}
        {e.processor === 'PayPal' && (
          <SettingRow
            label="PayPal account email"
            hint="The PayPal business account that receives payments. PayPal does not tell the portal when a payment arrives, so each order waits under Reports → Sales until you mark it paid."
          >
            <Input type="email" value={e.paypalEmail} onChange={(ev) => update({ paypalEmail: ev.target.value.trim() })} />
          </SettingRow>
        )}
        <SettingRow label="Pay the program office" hint="Lets a learner reserve a course and pay you directly — cash, check, bank transfer. They are enrolled when you mark the order paid.">
          <Toggle checked={e.offline.enabled} onChange={(v) => update({ offline: { ...e.offline, enabled: v } })} />
          {e.offline.enabled && (
            <Textarea
              rows={3}
              className="mt-3"
              value={e.offline.instructions}
              onChange={(ev) => update({ offline: { ...e.offline, instructions: ev.target.value } })}
              placeholder="How and where to pay, shown to the learner after they place the order."
            />
          )}
        </SettingRow>
        <SettingRow label="Currency" hint="Course prices are shown and charged in this currency.">
          <Select value={draft.currency} onChange={(ev) => set({ currency: ev.target.value })}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </SettingRow>
      </Section>

      <Section title="Subscription">
        <SettingRow label="Subscription" hint="Learners pay one fee for a month or a year of access to every paid course. It does not renew by itself: they extend it when it runs out.">
          <Toggle checked={e.subscription.enabled} onChange={(v) => update({ subscription: { ...e.subscription, enabled: v } })} />
        </SettingRow>
        {e.subscription.enabled && (
          <>
            <SettingRow label="Fee">
              <div className="flex flex-wrap items-center gap-3">
                <NumberField value={e.subscription.fee} onChange={(v) => update({ subscription: { ...e.subscription, fee: v } })} unit="per" />
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
            <SettingRow label="Free trial" hint="Each learner can start once with this many days free. 0 means no trial.">
              <NumberField value={e.subscription.trialDays} onChange={(v) => update({ subscription: { ...e.subscription, trialDays: v } })} unit="days" />
            </SettingRow>
          </>
        )}
      </Section>

      <Section title="Discounts">
        <SettingRow label="Global discount" hint="Taken off the price of every paid course. 0 means no discount.">
          <NumberField value={e.globalDiscount} onChange={(v) => update({ globalDiscount: v })} unit="% off" max={100} />
        </SettingRow>
        <SettingRow label="Credits" hint="You give learners credits on the Users page (Edit user → Credits); they spend them on courses instead of paying. One credit is worth one unit of the portal currency.">
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
                    {c.expires ? `Until ${formatDate(c.expires)}` : 'No end date'} · used {Number(c.used) || 0}
                    {c.limit > 0 ? ` of ${c.limit}` : ' times'}
                  </span>
                  <Toggle checked={c.active} onChange={(v) => update({ coupons: e.coupons.map((x) => (x.id === c.id ? { ...x, active: v } : x)) })} />
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
              <Input type="number" min={0} value={coupon.limit} onChange={(ev) => setCoupon({ ...coupon, limit: Math.max(0, Number(ev.target.value) || 0) })} />
            </Field>
            <Button variant="outline" onClick={addCoupon} disabled={!code || duplicate} className={cx('col-span-2 lg:col-span-1', duplicate && 'lg:mb-[26px]')}>
              Add coupon
            </Button>
          </div>
        </div>
      </Section>

      <Section title="Invoices">
        <SettingRow label="Invoices" hint="Every paid order gets an invoice number and a printable invoice (Reports → Sales, and the learner's profile). With an email service connected, the invoice is also emailed to the learner.">
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
      {
        id: 'zoom',
        name: 'Zoom',
        color: '#0b5cff',
        about: 'Create a Zoom meeting for an instructor-led session with one click.',
        how: 'In the Zoom App Marketplace, build a “Server-to-Server OAuth” app with the scope “meeting:write:admin” and copy its three values here. Then, in a session, choose Zoom and press “Create meeting”.',
        fields: [['accountId', 'Account ID'], ['clientId', 'Client ID']],
        secret: ['zoomClientSecret', 'Client secret'],
      },
      {
        id: 'teams',
        name: 'Microsoft Teams',
        color: '#4b53bc',
        about: 'Run instructor-led sessions as Teams meetings.',
        how: 'Schedule the meeting in Teams, then choose Microsoft Teams in the session and paste its join link. Learners get a Join button.',
        fields: [],
      },
      {
        id: 'goto',
        name: 'GoTo Meeting',
        color: '#f68d2e',
        about: 'Run instructor-led sessions in GoTo Meeting, Webinar or Training.',
        how: 'Schedule the meeting in GoTo, then choose GoTo Meeting in the session and paste its join link. Learners get a Join button.',
        fields: [],
      },
      {
        id: 'bbb',
        name: 'BigBlueButton',
        color: '#0f70d7',
        about: 'Open a room on your own BigBlueButton server for each session.',
        how: 'Enter your server address and its shared secret (run “bbb-conf --secret” on the server). In a session, choose BigBlueButton: the room opens when the first person joins, instructors as moderators.',
        fields: [['serverUrl', 'Server address']],
        secret: ['bbbSecret', 'Shared secret'],
      },
    ],
  },
  {
    group: 'People & CRM',
    items: [
      {
        id: 'bamboohr',
        name: 'BambooHR',
        color: '#73c41d',
        about: 'Create portal accounts for the employees in your BambooHR directory.',
        how: 'Enter your company subdomain (the part before .bamboohr.com) and an API key from BambooHR → your photo → API keys. “Import employees” creates an account for everyone in the directory who does not have one yet.',
        fields: [['subdomain', 'Company subdomain']],
        secret: ['bambooApiKey', 'API key'],
        action: 'bamboo',
      },
      {
        id: 'salesforce',
        name: 'Salesforce',
        color: '#00a1e0',
        about: 'Report training progress to Salesforce.',
        how: 'Salesforce receives portal events through a webhook: create a Flow (or Apex REST endpoint) in Salesforce that accepts a POST, then add its address under Webhooks below and tick the events to send.',
        fields: [],
      },
    ],
  },
  {
    group: 'Automation & stores',
    items: [
      {
        id: 'zapier',
        name: 'Zapier',
        color: '#ff4f00',
        about: 'Connect the portal to thousands of other apps without code.',
        how: 'Triggers: in Zapier choose “Webhooks by Zapier → Catch Hook”, then add the address it gives you under Webhooks below. Actions: use “Webhooks by Zapier → POST” with a portal API key (below) to create users and enrollments.',
        fields: [],
      },
      {
        id: 'shopify',
        name: 'Shopify',
        color: '#5a8a1f',
        about: 'Sell courses from a Shopify store.',
        how: 'Give each product the course code as its SKU. When an order is paid, have Shopify Flow (or Zapier) send it to the orders address below with a portal API key: the buyer gets an account and is enrolled.',
        fields: [['storeUrl', 'Store address']],
        orders: true,
      },
      {
        id: 'woocommerce',
        name: 'WooCommerce',
        color: '#7f54b3',
        about: 'Sell courses from a WordPress store.',
        how: 'Give each product the course code as its SKU. Send completed orders to the orders address below (a webhook plugin or Zapier) with a portal API key: the buyer gets an account and is enrolled.',
        fields: [['storeUrl', 'Store address']],
        orders: true,
      },
    ],
  },
]

export function IntegrationsTab({ draft, set, setGroup, secrets }) {
  const saved = draft.integrations
  const { actions } = useData()
  const toast = useToast()
  const server = useServer()
  const [open, setOpen] = useState(null)
  const [form, setForm] = useState({})
  const [busy, setBusy] = useState(false)
  const ordersUrl = `${window.location.origin}/api/v1/orders`

  const edit = (item) => {
    setOpen(item)
    setForm({ enabled: false, ...saved[item.id] })
  }

  async function importEmployees() {
    setBusy(true)
    const res = await actions.rpc('bamboo.import')
    setBusy(false)
    if (!res.ok) return toast(res.error, 'error')
    toast(`${res.created} account${res.created === 1 ? '' : 's'} created, ${res.skipped} already existed.${res.created && !res.emailed ? ' No email service is connected, so set their passwords from the Users page.' : ''}`)
  }

  return (
    <>
      <EmailSection draft={draft} setGroup={setGroup} secrets={secrets} />

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

      <WebhooksSection draft={draft} set={set} />
      <ApiSection draft={draft} set={set} />

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
        {open && (
          <>
            <p className="text-[13.5px] leading-6 text-ink-700 bg-[#f7f8fa] border border-line rounded-md px-3.5 py-3 mb-5">{open.how}</p>
            {open.fields.map(([key, label]) => (
              <Field key={key} label={label}>
                <Input value={form[key] || ''} onChange={(ev) => setForm({ ...form, [key]: ev.target.value.trim() })} />
              </Field>
            ))}
            {open.secret && (
              <Field label={open.secret[1]}>
                <SecretField name={open.secret[0]} secrets={secrets} placeholder={open.secret[1]} />
              </Field>
            )}
            {open.orders && (
              <Field label="Orders address" hint="POST { email, firstName, lastName, courseCodes: […], reference, amount } with the header “Authorization: Bearer <API key>”.">
                <Input value={ordersUrl} readOnly onFocus={(ev) => ev.target.select()} className="bg-gray-50" />
              </Field>
            )}
            <Toggle
              checked={!!form.enabled}
              onChange={(v) => setForm({ ...form, enabled: v })}
              label={`Use ${open.name}`}
              hint="Press Done, then Save at the bottom of the page to keep this change."
            />
            {open.action === 'bamboo' && (
              <div className="mt-5 pt-5 border-t border-line">
                <Button variant="outline" icon="users" disabled={busy || !server || !saved.bamboohr?.enabled} onClick={importEmployees}>
                  {busy ? 'Importing…' : 'Import employees now'}
                </Button>
                <p className="hint mt-2">{saved.bamboohr?.enabled ? 'New accounts are learners, are asked to choose a password at first sign-in, and get the welcome email when an email service is connected.' : 'Switch BambooHR on and save the page first.'}</p>
                <NeedsServer />
              </div>
            )}
          </>
        )}
      </Modal>
    </>
  )
}

function EmailSection({ draft, setGroup, secrets }) {
  const { actions } = useData()
  const toast = useToast()
  const e = draft.email
  const [busy, setBusy] = useState(false)

  async function test() {
    setBusy(true)
    const res = await actions.rpc('email.test', {}, { refresh: false })
    setBusy(false)
    toast(res.ok ? `Test message sent to ${res.to}.` : res.error, res.ok ? 'success' : 'error')
  }

  return (
    <Section title="Email">
      <p className="hint -mt-3">
        The portal sends email — welcome messages, notifications, sign-up confirmations, invoices — through an email service you have an account with. What was
        sent is listed under{' '}
        <Link className="link" to="/notifications?tab=sent">
          Notifications → Sent
        </Link>
        .
      </p>
      <SettingRow label="Email service" hint="Both have a free plan that is enough for a school.">
        <Select value={e.provider} onChange={(ev) => setGroup('email', { provider: ev.target.value })}>
          <option value="None">None — the portal sends no email</option>
          <option>Resend</option>
          <option>SendGrid</option>
        </Select>
        <NeedsServer />
      </SettingRow>
      {e.provider !== 'None' && (
        <>
          <SettingRow label="API key" hint={`From your ${e.provider} dashboard → API keys.`}>
            <SecretField name="emailApiKey" secrets={secrets} placeholder={e.provider === 'Resend' ? 're_…' : 'SG.…'} />
          </SettingRow>
          <SettingRow label="From address" hint={`An address on a domain you have verified with ${e.provider}.`}>
            <Input type="email" value={e.fromAddress} onChange={(ev) => setGroup('email', { fromAddress: ev.target.value.trim() })} placeholder="portal@gahealthcaretraining.com" />
          </SettingRow>
          <SettingRow label="From name" hint="Leave empty to use the site name.">
            <Input value={e.fromName} onChange={(ev) => setGroup('email', { fromName: ev.target.value })} />
          </SettingRow>
          <SettingRow label="Test" hint="Sends a message to your own address using what is saved. Save the page first if you just changed something.">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" icon="send" onClick={test} disabled={busy || !secrets.server}>
                {busy ? 'Sending…' : 'Send a test email'}
              </Button>
              <Badge tone={secrets.emailReady ? 'green' : 'gray'}>{secrets.emailReady ? 'Ready to send' : 'Not ready'}</Badge>
            </div>
          </SettingRow>
        </>
      )}
    </Section>
  )
}

function WebhooksSection({ draft, set }) {
  const hooks = draft.webhooks || []
  const [url, setUrl] = useState('')
  const valid = /^https:\/\/\S+$/.test(url.trim())
  const update = (id, changes) => set({ webhooks: hooks.map((h) => (h.id === id ? { ...h, ...changes } : h)) })

  return (
    <Section title="Webhooks">
      <p className="hint -mt-3">When something happens in the portal, it sends the details (the event, the user and the course, as JSON) to each address below. This is how Zapier, Salesforce and your own systems hear about it.</p>
      <NeedsServer>Webhooks are sent by the server, so they are only delivered reliably once the shared database is connected.</NeedsServer>
      {hooks.length > 0 && (
        <ul className="space-y-4">
          {hooks.map((h) => (
            <li key={h.id} className="border border-line rounded-md p-4">
              <div className="flex items-center gap-3 mb-3">
                <code className="flex-1 min-w-0 truncate text-[13px] bg-gray-100 rounded px-2 py-1">{h.url}</code>
                <Toggle checked={h.active} onChange={(v) => update(h.id, { active: v })} />
                <button type="button" title="Delete webhook" aria-label="Delete webhook" onClick={() => set({ webhooks: hooks.filter((x) => x.id !== h.id) })} className="p-1.5 rounded text-ink-700 hover:text-red-600 hover:bg-red-50">
                  <Icon name="trash" className="w-[18px] h-[18px]" />
                </button>
              </div>
              <OptionList>
                {WEBHOOK_EVENTS.map((ev) => (
                  <Checkbox
                    key={ev.type}
                    label={ev.label}
                    checked={(h.events || []).includes(ev.type)}
                    onChange={(v) => update(h.id, { events: v ? [...(h.events || []), ev.type] : (h.events || []).filter((x) => x !== ev.type) })}
                  />
                ))}
              </OptionList>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-3">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://hooks.zapier.com/hooks/catch/…" className="flex-1 min-w-[220px]" />
        <Button
          variant="outline"
          disabled={!valid}
          onClick={() => {
            set({ webhooks: [...hooks, { id: uid('wh'), url: url.trim(), events: ['course.completed'], active: true }] })
            setUrl('')
          }}
        >
          Add webhook
        </Button>
      </div>
    </Section>
  )
}

const ENDPOINTS = [
  ['GET', '/api/v1/users', 'List accounts (?email= to find one)'],
  ['POST', '/api/v1/users', 'Create an account: firstName, lastName, email, password (optional)'],
  ['PATCH', '/api/v1/users/:id', 'Change a name, phone, or active: true / false'],
  ['GET', '/api/v1/courses', 'List courses'],
  ['GET', '/api/v1/enrollments', 'List enrollments (?userId=, ?email=, ?courseId=)'],
  ['POST', '/api/v1/enrollments', 'Enroll: userId or email, and courseId or courseCode'],
  ['DELETE', '/api/v1/enrollments', 'Unenroll, same fields'],
  ['GET', '/api/v1/certificates', 'List certificates (?userId=, ?email=)'],
  ['POST', '/api/v1/orders', 'A paid order from a store: creates the account if needed and enrolls it'],
]

function ApiSection({ draft, set }) {
  const { actions } = useData()
  const toast = useToast()
  const server = useServer()
  const [keys, setKeys] = useState([])
  const [name, setName] = useState('')
  const [fresh, setFresh] = useState(null)

  async function load() {
    if (!server) return
    const res = await actions.rpc('apikeys.list', {}, { refresh: false })
    if (res.ok) setKeys(res.keys)
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server])

  async function create() {
    const res = await actions.rpc('apikeys.create', { name: name.trim() || 'API key' }, { refresh: false })
    if (!res.ok) return toast(res.error, 'error')
    setFresh(res.key)
    setName('')
    load()
  }

  return (
    <Section title="API">
      <SettingRow label="Enable API" hint="Lets your other systems read and update portal data using an API key.">
        <Toggle checked={draft.api.enabled} onChange={(v) => set({ api: { ...draft.api, enabled: v } })} />
        <NeedsServer />
      </SettingRow>

      <SettingRow label="API keys" hint="A key has full access to the endpoints below. It is shown once, when you create it; the portal keeps only a fingerprint of it.">
        {server ? (
          <>
            {keys.length > 0 && (
              <ul className="border border-line rounded-md divide-y divide-line mb-3">
                {keys.map((k) => (
                  <li key={k.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14px] truncate">{k.name}</span>
                      <span className="block hint">
                        <code>{k.prefix}…</code> · created {formatDate(k.createdAt)} · {k.lastUsedAt ? `last used ${formatDateTime(k.lastUsedAt)}` : 'never used'}
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await actions.rpc('apikeys.revoke', { id: k.id }, { refresh: false })
                        toast('Key revoked. Anything still using it stops working.')
                        load()
                      }}
                    >
                      Revoke
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2.5">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="What is this key for? e.g. Zapier" />
              <Button variant="outline" onClick={create}>
                Create key
              </Button>
            </div>
          </>
        ) : (
          <p className="hint">Keys are issued by the server.</p>
        )}
      </SettingRow>

      <div>
        <p className="text-[14.5px] font-medium text-ink-900">Endpoints</p>
        <p className="hint mt-1 mb-3">
          Send the key as the header <code className="bg-gray-100 rounded px-1.5 py-0.5">Authorization: Bearer &lt;key&gt;</code>. Requests and answers are JSON; answers are wrapped as{' '}
          <code className="bg-gray-100 rounded px-1.5 py-0.5">{'{ "data": … }'}</code>.
        </p>
        <div className="border border-line rounded-md divide-y divide-line text-[13px]">
          {ENDPOINTS.map(([method, path, what]) => (
            <div key={method + path} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2">
              <code className="font-semibold w-14">{method}</code>
              <code className="text-ink-900">{path}</code>
              <span className="text-ink-500 flex-1 min-w-[200px]">{what}</span>
            </div>
          ))}
        </div>
      </div>

      <Modal
        open={!!fresh}
        onClose={() => setFresh(null)}
        title="Your new API key"
        subtitle="Copy it now. It is not shown again."
        width="max-w-lg"
        footer={
          <>
            <Button
              variant="ghost"
              icon="copy"
              onClick={async () => toast((await copyText(fresh)) ? 'Key copied.' : 'Select the key and copy it yourself.', 'info')}
            >
              Copy
            </Button>
            <Button onClick={() => setFresh(null)}>Done</Button>
          </>
        }
      >
        <code className="block bg-gray-100 rounded px-3 py-2.5 font-mono text-[13px] break-all select-all">{fresh}</code>
        {!draft.api.enabled && <p className="hint mt-3">The API is still switched off: turn “Enable API” on and save before using the key.</p>}
      </Modal>
    </Section>
  )
}
