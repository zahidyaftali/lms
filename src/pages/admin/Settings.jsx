import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Badge,
  Button,
  ConfirmDialog,
  Field,
  Icon,
  Input,
  Modal,
  Select,
  SideTabs,
  Textarea,
  Toggle,
} from '../../components/ui'
import Logo from '../../components/layout/Logo'
import { NON_DATA_KEYS, useData } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { shrinkImage } from '../../lib/fileStore'
import { withSettingDefaults } from '../../lib/settingsDefaults.js'
import { COMPLETION_RULES, badIpRules } from '../../lib/rules.js'
import { LANGUAGES } from '../../lib/i18n'
import SettingsHistory from './SettingsHistory'
import { CURRENCIES, EcommerceTab, GamificationTab, IntegrationsTab, SkillsTab } from './SettingsMore'
import { CustomFields, NeedsServer, NumberField, SecretField, Section, SettingRow, useSecrets, useServer } from './SettingsParts'
import { download, plural, uid } from '../../lib/utils'

const TABS = [
  { value: 'portal', label: 'Portal' },
  { value: 'users', label: 'Users' },
  { value: 'types', label: 'User types' },
  { value: 'courses', label: 'Courses' },
  { value: 'categories', label: 'Categories' },
  { value: 'skills', label: 'Skills' },
  { value: 'gamification', label: 'Gamification' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'integrations', label: 'Integrations' },
  { value: 'security', label: 'Security' },
  { value: 'importexport', label: 'Import-Export' },
  { value: 'history', label: 'History' },
]

/** Tabs edited as a draft and kept with the Save button at the bottom. */
const DRAFT_TABS = ['portal', 'users', 'courses', 'skills', 'gamification', 'ecommerce', 'integrations', 'security']

const TIME_ZONES = [
  '(GMT -04:00) Atlantic Time (Canada)',
  '(GMT -05:00) Eastern Time (US & Canada)',
  '(GMT -06:00) Central Time (US & Canada)',
  '(GMT -07:00) Mountain Time (US & Canada)',
  '(GMT -08:00) Pacific Time (US & Canada)',
  '(GMT -09:00) Alaska',
  '(GMT -10:00) Hawaii',
  '(GMT +00:00) UTC',
]

export default function Settings() {
  const data = useData()
  const { settings, actions } = data
  const { user } = useAuth()
  const toast = useToast()
  const secrets = useSecrets()
  const [params] = useSearchParams()
  const [tab, setTab] = useState(() => (TABS.some((t) => t.value === params.get('tab')) ? params.get('tab') : 'portal'))
  // Links elsewhere in the portal open a particular tab (…/settings?tab=integrations).
  const wanted = params.get('tab')
  useEffect(() => {
    if (TABS.some((t) => t.value === wanted)) setTab(wanted)
  }, [wanted])

  // Compared by content: the portal re-fetches its data in the background, and a
  // refresh that changes nothing must not throw away what is being typed here.
  const savedKey = useMemo(() => JSON.stringify(withSettingDefaults(settings)), [settings])
  const saved = useMemo(() => JSON.parse(savedKey), [savedKey])
  const [draft, setDraft] = useState(saved)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setDraft(saved)
    setDirty(false)
  }, [saved, tab])

  const set = (changes) => {
    setDraft((d) => ({ ...d, ...changes }))
    setDirty(true)
  }
  const setGroup = (group, changes) => {
    setDraft((d) => ({ ...d, [group]: { ...d[group], ...changes } }))
    setDirty(true)
  }

  const save = () => {
    const bad = badIpRules(draft.security.allowedIps)
    if (bad.length) return toast(`Allowed IP addresses: “${bad[0]}” is not an address, a block such as 203.0.113.0/24 or a range.`, 'error')
    // Only what was edited is written, so History names the settings that really changed.
    const changes = Object.fromEntries(
      Object.entries(draft).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(saved[key])),
    )
    actions.updateSettings({ ...changes, settingsVersion: draft.settingsVersion })
    actions.logEvent('settings', 'updated the portal settings', user.id)
    setDirty(false)
    toast('Settings saved.')
  }

  const showFooter = DRAFT_TABS.includes(tab)
  const shared = { draft, set, setGroup, secrets }

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-5 lg:-my-7 min-h-[calc(100vh-64px)] lg:min-h-[calc(100vh-72px)] flex flex-col">
      <div className="flex-1 flex flex-col lg:flex-row">
        <SideTabs tabs={TABS} active={tab} onChange={setTab} />

        <div className="flex-1 min-w-0 px-4 sm:px-6 lg:px-10 py-6 lg:py-7 pb-24">
          <h1 className="page-title mb-7">{TABS.find((t) => t.value === tab)?.label}</h1>

          {tab === 'portal' && <PortalTab {...shared} />}
          {tab === 'users' && <UsersTab {...shared} />}
          {tab === 'types' && <UserTypesTab />}
          {tab === 'courses' && <CoursesTab {...shared} />}
          {tab === 'categories' && <CategoriesTab />}
          {tab === 'skills' && <SkillsTab {...shared} />}
          {tab === 'gamification' && <GamificationTab {...shared} />}
          {tab === 'ecommerce' && <EcommerceTab {...shared} />}
          {tab === 'integrations' && <IntegrationsTab {...shared} />}
          {tab === 'security' && <SecurityTab {...shared} />}
          {tab === 'importexport' && <ImportExportTab />}
          {tab === 'history' && <SettingsHistory />}
        </div>
      </div>

      {showFooter && (
        <div className="sticky bottom-0 z-10 bg-white border-t border-line px-4 sm:px-6 lg:pr-10 lg:pl-[230px] py-4 flex items-center gap-4">
          <Button onClick={save} disabled={!dirty}>
            Save
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setDraft(saved)
              setDirty(false)
            }}
          >
            Cancel
          </Button>
          {dirty && <span className="hint">You have unsaved changes.</span>}
        </div>
      )}
    </div>
  )
}

/** Uploads an image as a small data URL, with a preview and a remove button. */
function ImageSetting({ value, onChange, fallback, size, alt }) {
  return (
    <div className="flex items-center gap-4">
      <span className="flex-1">{value ? <img src={value} alt={alt} className={size.className} /> : fallback}</span>
      <label className="p-2 rounded text-ink-700 hover:bg-gray-100 cursor-pointer" title={`Upload ${alt.toLowerCase()}`}>
        <Icon name="upload" className="w-[20px] h-[20px]" />
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (file && file.type.startsWith('image/')) onChange(await shrinkImage(file, size.limits))
            e.target.value = ''
          }}
        />
      </label>
      <button onClick={() => onChange(null)} className="p-2 rounded text-ink-700 hover:bg-gray-100" title={`Remove ${alt.toLowerCase()}`}>
        <Icon name="trash" className="w-[20px] h-[20px]" />
      </button>
    </div>
  )
}

function PortalTab({ draft, set, setGroup }) {
  const a = draft.announcements
  return (
    <>
      <Section title="Identity">
        <SettingRow label="Site name" hint="The name on the browser tab, in search results, in emails and on invoices.">
          <Input value={draft.siteName} onChange={(e) => set({ siteName: e.target.value })} className="bg-gray-50" />
        </SettingRow>
        <SettingRow
          label="Site description"
          hint="Briefly describe what your website is about. It appears in search results, on the sign-in page and on the homepage."
        >
          <Textarea rows={5} value={draft.siteDescription} onChange={(e) => set({ siteDescription: e.target.value })} className="bg-gray-50" />
        </SettingRow>
        <SettingRow label="Domain name" hint="The address this portal is running at.">
          <Input value={window.location.host} disabled className="bg-gray-50 text-ink-500" />
        </SettingRow>
        <SettingRow
          label="Custom domain"
          hint="Your own address for the portal, such as learn.gahealthcaretraining.com. It is printed on certificates as the place to verify them."
        >
          <Input value={draft.customDomain} onChange={(e) => set({ customDomain: e.target.value.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '') })} placeholder="learn.example.com" />
          <p className="hint mt-2">
            To make the address open the portal, add the same domain to the portal's project at your web host (Vercel → Settings → Domains) and point
            its DNS record there. That step is done at the host, not here.
          </p>
        </SettingRow>
      </Section>

      <Section title="Branding">
        <SettingRow label="Logo" hint="PNG, JPG, GIF or SVG. Large images are resized to fit. Shown to everyone once you save.">
          <ImageSetting
            value={draft.logo}
            onChange={(logo) => set({ logo })}
            alt="Logo"
            size={{ className: 'h-12' }}
            fallback={<Logo size="sm" />}
          />
        </SettingRow>
        <SettingRow label="Favicon" hint="The small icon on the browser tab. A square image works best.">
          <ImageSetting
            value={draft.favicon}
            onChange={(favicon) => set({ favicon })}
            alt="Favicon"
            size={{ className: 'h-8 w-8 rounded', limits: { maxWidth: 64, maxHeight: 64 } }}
            fallback={<span className="hint">No favicon uploaded</span>}
          />
        </SettingRow>
        <SettingRow label="Theme" hint="The colours of the menu, buttons and links for everyone who uses the portal.">
          <Select value={draft.theme} onChange={(e) => set({ theme: e.target.value })}>
            <option>GA Healthcare (default)</option>
            <option>Navy &amp; gold</option>
            <option>Light</option>
            <option>High contrast</option>
          </Select>
        </SettingRow>
        <SettingRow label="Website" hint="Shown in the Help Center.">
          <Input value={draft.website} onChange={(e) => set({ website: e.target.value })} />
        </SettingRow>
      </Section>

      <Section title="Contact">
        <SettingRow label="Support email">
          <Input value={draft.supportEmail} onChange={(e) => set({ supportEmail: e.target.value })} />
        </SettingRow>
        <SettingRow label="Support phone">
          <Input value={draft.supportPhone} onChange={(e) => set({ supportPhone: e.target.value })} />
        </SettingRow>
      </Section>

      <Section title="Locale">
        <SettingRow label="Default language" hint="The language of the menu, the sign-in pages and the learner's pages. Administration pages and course content stay as written.">
          <Select value={draft.language} onChange={(e) => set({ language: e.target.value })}>
            {LANGUAGES.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </Select>
        </SettingRow>
        <SettingRow label="Time zone" hint="Dates and times across the portal are shown in this time zone.">
          <Select value={draft.timezone} onChange={(e) => set({ timezone: e.target.value })}>
            {TIME_ZONES.map((z) => (
              <option key={z}>{z}</option>
            ))}
          </Select>
        </SettingRow>
        <SettingRow label="Date format">
          <Select value={draft.dateFormat} onChange={(e) => set({ dateFormat: e.target.value })}>
            <option>DD/MM/YYYY</option>
            <option>MM/DD/YYYY</option>
          </Select>
        </SettingRow>
        <SettingRow label="Currency" hint="Used for course prices, orders and invoices.">
          <Select value={draft.currency} onChange={(e) => set({ currency: e.target.value })}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </SettingRow>
      </Section>

      <Section title="Announcements">
        <SettingRow label="Internal announcement" hint="Shown at the top of every page to everyone who is signed in.">
          <Toggle checked={a.internalOn} onChange={(v) => setGroup('announcements', { internalOn: v })} />
          {a.internalOn && (
            <Textarea
              rows={3}
              value={a.internal}
              onChange={(e) => setGroup('announcements', { internal: e.target.value })}
              placeholder="Skills lab is closed on Friday for maintenance."
              className="mt-3"
            />
          )}
        </SettingRow>
        <SettingRow label="External announcement" hint="Shown on the sign-in page, before anyone has signed in.">
          <Toggle checked={a.externalOn} onChange={(v) => setGroup('announcements', { externalOn: v })} />
          {a.externalOn && (
            <Textarea
              rows={3}
              value={a.external}
              onChange={(e) => setGroup('announcements', { external: e.target.value })}
              placeholder="Fall 2026 enrollment is open. Call the program office to register."
              className="mt-3"
            />
          )}
        </SettingRow>
      </Section>

      <Section title="Custom homepage">
        <SettingRow label="Custom homepage" hint="A public welcome page that visitors see before the sign-in page, with your headline, introduction and, if the external catalog is on, your courses.">
          <Toggle checked={draft.homepage.custom} onChange={(v) => setGroup('homepage', { custom: v })} />
          <p className="hint mt-2">
            <Link to="/welcome" target="_blank" className="link">
              Preview the saved homepage
            </Link>
          </p>
        </SettingRow>
        {draft.homepage.custom && (
          <>
            <SettingRow label="Headline">
              <Input value={draft.homepage.headline} onChange={(e) => setGroup('homepage', { headline: e.target.value })} placeholder="Build a healthcare career that lasts." />
            </SettingRow>
            <SettingRow label="Introduction" hint="Leave empty to use the site description.">
              <Textarea rows={4} value={draft.homepage.intro} onChange={(e) => setGroup('homepage', { intro: e.target.value })} />
            </SettingRow>
          </>
        )}
      </Section>
    </>
  )
}

const SOCIAL = [
  ['socialGoogle', 'google', 'Google', 'googleClientSecret'],
  ['socialFacebook', 'facebook', 'Facebook', 'facebookClientSecret'],
  ['socialLinkedIn', 'linkedin', 'LinkedIn', 'linkedinClientSecret'],
]

function UsersTab({ draft, setGroup, secrets }) {
  const { groups, userTypes } = useData()
  const server = useServer()
  const u = draft.users
  const sso = draft.sso
  const redirect = `${window.location.origin}/api/oauth`
  return (
    <>
      <Section title="Registration">
        <SettingRow label="Self-registration" hint="Adds a “Create an account” link to the sign-in page. People who sign up always get a learner account.">
          <Toggle checked={u.selfRegistration} onChange={(v) => setGroup('users', { selfRegistration: v })} />
          {u.selfRegistration && !server && (
            <NeedsServer>Without the shared database an account created here exists only in the browser it was created in.</NeedsServer>
          )}
        </SettingRow>
        <SettingRow label="Default user type" hint="Applied when an account is added, imported or signs up.">
          <Select value={u.defaultUserType} onChange={(e) => setGroup('users', { defaultUserType: e.target.value })}>
            {userTypes.map((t) => (
              <option key={t.id}>{t.name}</option>
            ))}
          </Select>
        </SettingRow>
        <SettingRow label="Send welcome email" hint="Emails new users their sign-in address and login details as soon as their account is created.">
          <Toggle checked={u.welcomeEmail} onChange={(v) => setGroup('users', { welcomeEmail: v })} />
          {u.welcomeEmail && !secrets.emailReady && (
            <p className="hint mt-2">
              No email service is connected yet, so nothing is sent.{' '}
              <Link className="link" to="/settings?tab=integrations">
                Connect one under Integrations
              </Link>
              . Until then, use “Send by email” on the login details window.
            </p>
          )}
        </SettingRow>
        <SettingRow label="Default group" hint="New accounts join this group and are enrolled in its courses. On the Add user form it is ticked for you and can be changed.">
          <Select value={u.defaultGroupId} onChange={(e) => setGroup('users', { defaultGroupId: e.target.value })}>
            <option value="">No group</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </SettingRow>
        <SettingRow label="Visible user format" hint="How names appear in lists, reports, messages and on certificates.">
          <Select value={u.nameFormat} onChange={(e) => setGroup('users', { nameFormat: e.target.value })}>
            <option>First name and last name</option>
            <option>First initial and last name</option>
            <option>Email address</option>
          </Select>
        </SettingRow>
      </Section>

      <Section title="Sign-up" muted={!u.selfRegistration}>
        {!u.selfRegistration && <p className="hint -mt-3">These apply to people who create their own account. Switch self-registration on to use them.</p>}
        <SettingRow label="Restrict sign-up to email domains" hint="Separate domains with commas. Leave empty to allow any address.">
          <Input value={u.allowedDomains} onChange={(e) => setGroup('users', { allowedDomains: e.target.value })} placeholder="gahealthcaretraining.com" />
        </SettingRow>
        <SettingRow label="User verification" hint="How a new account is confirmed before it can be used.">
          <Select value={u.verification} onChange={(e) => setGroup('users', { verification: e.target.value })}>
            <option value="None">None — the account works straight away</option>
            <option value="CAPTCHA">CAPTCHA — a short question people answer and scripts do not</option>
            <option value="Email verification">Email verification — a link sent to their address</option>
            <option value="Administrator activation">Administrator activation — you activate each account</option>
          </Select>
          {u.verification === 'Email verification' && !secrets.emailReady && (
            <p className="hint mt-2">Needs an email service (Integrations → Email). Until one is connected, new accounts wait for you to activate them instead.</p>
          )}
        </SettingRow>
      </Section>

      <Section title="Terms of service">
        <SettingRow label="Terms of service" hint="Learners and instructors accept these the first time they sign in, and again whenever you change the text. People signing up accept them on the sign-up form.">
          <Toggle checked={u.termsOn} onChange={(v) => setGroup('users', { termsOn: v })} />
          {u.termsOn && (
            <Textarea rows={7} value={u.terms} onChange={(e) => setGroup('users', { terms: e.target.value })} className="mt-3" placeholder="Write or paste your terms here." />
          )}
        </SettingRow>
      </Section>

      <Section title="Sign in with a social account">
        <NeedsServer />
        <p className="hint -mt-3">
          Each provider needs an app you register with them. Give the provider this redirect address: <code className="bg-gray-100 rounded px-1.5 py-0.5 break-all">{redirect}</code>. Only people who
          already have a portal account can use it, unless self-registration is on.
        </p>
        {SOCIAL.map(([key, id, label, secret]) => (
          <SettingRow key={key} label={label} hint={u[key] ? (secrets.signIn[id] ? 'Shown on the sign-in page.' : 'Not shown yet: it needs both the client ID and the client secret.') : undefined}>
            <Toggle checked={u[key]} onChange={(v) => setGroup('users', { [key]: v })} />
            {u[key] && (
              <div className="mt-3 space-y-3">
                <Input value={u[`${id}ClientId`] || ''} onChange={(e) => setGroup('users', { [`${id}ClientId`]: e.target.value.trim() })} placeholder={`${label} client ID`} />
                <SecretField name={secret} secrets={secrets} placeholder={`${label} client secret`} label="Save secret" />
              </div>
            )}
          </SettingRow>
        ))}
      </Section>

      <Section title="Single sign-on">
        <SettingRow label="Single sign-on" hint="Staff and learners sign in with their organization account (Microsoft Entra ID, Google Workspace, Okta …). Accounts are created as people arrive.">
          <Select value={sso.type} onChange={(e) => setGroup('sso', { type: e.target.value })}>
            <option>None</option>
            <option>OpenID Connect</option>
            <option>SAML 2.0</option>
            <option>LDAP</option>
          </Select>
          {(sso.type === 'SAML 2.0' || sso.type === 'LDAP') && (
            <p className="mt-2 flex gap-2 text-[13px] leading-5 text-red-800 bg-red-50 border border-red-100 rounded-md px-3 py-2">
              <Icon name="alert" className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                {sso.type} is not available in this portal. Choose OpenID Connect instead: every major identity provider that offers {sso.type} offers it too.
              </span>
            </p>
          )}
          {sso.type === 'OpenID Connect' && <NeedsServer />}
        </SettingRow>
        {sso.type === 'OpenID Connect' && (
          <>
            <SettingRow label="Issuer address" hint="The address of your identity provider, for example https://login.microsoftonline.com/your-tenant-id/v2.0">
              <Input value={sso.identityProvider} onChange={(e) => setGroup('sso', { identityProvider: e.target.value.trim() })} placeholder="https://" />
            </SettingRow>
            <SettingRow label="Client ID">
              <Input value={sso.clientId} onChange={(e) => setGroup('sso', { clientId: e.target.value.trim() })} />
            </SettingRow>
            <SettingRow label="Client secret">
              <SecretField name="ssoClientSecret" secrets={secrets} placeholder="Client secret" label="Save secret" />
            </SettingRow>
            <SettingRow label="Email attribute" hint="The field in the sign-in response that holds the user’s email address.">
              <Input value={sso.emailAttribute} onChange={(e) => setGroup('sso', { emailAttribute: e.target.value.trim() })} placeholder="email" />
            </SettingRow>
            <SettingRow label="Redirect address" hint="Enter this in your identity provider as the redirect (callback) address.">
              <Input value={redirect} readOnly onFocus={(e) => e.target.select()} className="bg-gray-50" />
              <p className="hint mt-2">{secrets.signIn.sso ? 'The sign-in page shows “Your organization account”.' : 'Not shown on the sign-in page until the issuer, client ID and secret are saved.'}</p>
            </SettingRow>
          </>
        )}
      </Section>

      <Section title="Custom user fields">
        <p className="hint -mt-3">Extra details to keep on every account, such as a student ID. They appear on the Add user form, the user's page and the sign-up form.</p>
        <CustomFields fields={u.customFields} onChange={(customFields) => setGroup('users', { customFields })} placeholder="Student ID" />
      </Section>

      <Section title="Passwords & inactivity">
        <SettingRow label="Minimum password length" hint="More password rules are under Security.">
          <NumberField value={u.passwordMinLength} onChange={(v) => setGroup('users', { passwordMinLength: v })} unit="characters" min={4} max={64} />
        </SettingRow>
        <SettingRow label="Deactivate after inactivity" hint="Learners and instructors who have not signed in for this long are deactivated. Administrators never are. 0 keeps accounts active indefinitely.">
          <NumberField value={u.inactivityDays} onChange={(v) => setGroup('users', { inactivityDays: v })} unit="days" />
        </SettingRow>
      </Section>
    </>
  )
}

function UserTypesTab() {
  const { userTypes, users, actions } = useData()
  const toast = useToast()
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState({ name: '', role: 'learner', description: '' })

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button
          icon="plus"
          onClick={() => {
            setEditing({ id: null })
            setDraft({ name: '', role: 'learner', description: '' })
          }}
        >
          Add user type
        </Button>
      </div>

      <div className="card divide-y divide-line">
        {userTypes.map((t) => {
          const count = users.filter((u) => u.userType === t.name).length
          return (
            <div key={t.id} className="px-6 py-5 flex items-start gap-4">
              <span className="w-10 h-10 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                <Icon name="user" className="w-[18px] h-[18px]" strokeWidth={1.6} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium flex items-center gap-2.5">
                  {t.name}
                  {t.system && <Badge>System</Badge>}
                </p>
                <p className="hint mt-1">{t.description}</p>
                <p className="text-[12.5px] text-ink-500 mt-1.5">
                  {plural(count, 'account')} · access level: <span className="font-medium">{t.role}</span>
                </p>
              </div>
              {!t.system && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(t)
                      setDraft(t)
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (count) return toast(`${plural(count, 'account')} still use this type. Move them to another type first.`, 'info')
                      actions.userTypes.remove(t.id)
                      toast('User type removed.')
                    }}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit user type' : 'Add user type'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const name = draft.name.trim()
                if (!name) return
                if (userTypes.some((t) => t.id !== editing.id && t.name.toLowerCase() === name.toLowerCase())) return toast('Another user type already has this name.', 'error')
                if (editing.id) {
                  actions.userTypes.update(editing.id, { ...draft, name })
                  // Accounts follow their type: a renamed type keeps its users, a changed access level applies to them.
                  users.forEach((u) => u.userType === editing.name && actions.updateUser(u.id, { userType: name, role: draft.role }))
                } else actions.userTypes.add({ ...draft, name, system: false })
                setEditing(null)
                toast('User type saved.')
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <Field label="Name" required>
          <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </Field>
        <Field label="Access level" hint="Determines which pages accounts of this type can open.">
          <Select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}>
            <option value="learner">Learner — own courses and profile only</option>
            <option value="instructor">Instructor — assigned courses, learners and grading</option>
            <option value="admin">Admin — full portal management</option>
          </Select>
        </Field>
        <Field label="Description">
          <Textarea rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        </Field>
      </Modal>
    </>
  )
}

function CoursesTab({ draft, setGroup }) {
  const c = draft.courses
  return (
    <>
      <Section title="Course defaults">
        <SettingRow label="Completion rule" hint="What a new course starts with. Each course can change it in Course options → Completion.">
          <Select value={c.defaultCompletionRule} onChange={(e) => setGroup('courses', { defaultCompletionRule: e.target.value })}>
            {COMPLETION_RULES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </SettingRow>
        <SettingRow label="Show progress bar to learners" hint="The percentage and bar on their courses and learning paths.">
          <Toggle checked={c.showProgressBar} onChange={(v) => setGroup('courses', { showProgressBar: v })} />
        </SettingRow>
        <SettingRow label="Allow learners to self-enroll from the catalog" hint="When off, learners can only request enrollment. Each course also has its own “Enrollment request” switch.">
          <Toggle checked={c.allowSelfEnrollment} onChange={(v) => setGroup('courses', { allowSelfEnrollment: v })} />
        </SettingRow>
      </Section>

      <Section title="Learning experience">
        <SettingRow label="Unit navigation" hint="In order: a unit opens once every unit before it is completed. Any order: learners open whichever unit they like.">
          <Select value={c.unitNavigation} onChange={(e) => setGroup('courses', { unitNavigation: e.target.value })}>
            <option>In order</option>
            <option>Any order</option>
          </Select>
          {c.unitNavigation === 'In order' && (
            <p className="hint mt-2">A test with no questions cannot be passed, so learners would stop there. Check that every test has its questions first.</p>
          )}
        </SettingRow>
        <SettingRow label="Show a summary page" hint="Learners see the description, outline and facts about a course before its first unit.">
          <Toggle checked={c.showSummary} onChange={(v) => setGroup('courses', { showSummary: v })} />
        </SettingRow>
        <SettingRow label="Discussions" hint="Learners and instructors can post questions and replies inside a course.">
          <Toggle checked={c.discussions} onChange={(v) => setGroup('courses', { discussions: v })} />
        </SettingRow>
        <SettingRow label="Course ratings" hint="Learners rate a course once they complete it. The average is shown in the catalog.">
          <Toggle checked={c.ratings} onChange={(v) => setGroup('courses', { ratings: v })} />
        </SettingRow>
      </Section>

      <Section title="Catalog">
        <SettingRow label="External catalog" hint="Shows the course catalog to visitors who have not signed in.">
          <Toggle checked={c.externalCatalog} onChange={(v) => setGroup('courses', { externalCatalog: v })} />
          {c.externalCatalog && (
            <p className="hint mt-2">
              Visitors find it at{' '}
              <Link to="/explore" target="_blank" className="link">
                {window.location.host}/explore
              </Link>
            </p>
          )}
        </SettingRow>
        <SettingRow label="Catalog layout">
          <Select value={c.catalogLayout} onChange={(e) => setGroup('courses', { catalogLayout: e.target.value })}>
            <option>Cards</option>
            <option>List</option>
          </Select>
        </SettingRow>
        <SettingRow label="Social sharing" hint="Adds Facebook, LinkedIn, X and copy-link buttons to catalog courses and to certificates.">
          <Toggle checked={c.socialSharing} onChange={(v) => setGroup('courses', { socialSharing: v })} />
        </SettingRow>
      </Section>

      <Section title="Certificates">
        <SettingRow label="Issue certificates on completion" hint="When off, no course or learning path issues a certificate, whatever its own setting.">
          <Toggle checked={c.certificateEnabled} onChange={(v) => setGroup('courses', { certificateEnabled: v })} />
        </SettingRow>
        <SettingRow label="Certificate validity" hint="How long a certificate stays valid after it is issued. An expired certificate can be earned again by retaking the course.">
          <Select value={c.certificateValidity} onChange={(e) => setGroup('courses', { certificateValidity: e.target.value })}>
            <option>Never expires</option>
            <option>12 months</option>
            <option>24 months</option>
            <option>36 months</option>
          </Select>
        </SettingRow>
        <SettingRow label="Default certificate template" hint="What new courses and learning paths start with. Each course picks its own in Course options.">
          <Select value={c.certificateTemplate} onChange={(e) => setGroup('courses', { certificateTemplate: e.target.value })}>
            <option>Classic</option>
            <option>Fancy</option>
            <option>Modern</option>
            <option>Simple</option>
          </Select>
        </SettingRow>
      </Section>

      <Section title="Custom course fields">
        <p className="hint -mt-3">Extra details to keep on every course, such as clock hours. They are filled in under Course options → Info and shown to learners on the course's About page.</p>
        <CustomFields fields={c.customFields} onChange={(customFields) => setGroup('courses', { customFields })} placeholder="Clock hours" />
      </Section>
    </>
  )
}

function CategoriesTab() {
  const { categories, courses, actions } = useData()
  const toast = useToast()
  const [name, setName] = useState('')

  return (
    <>
      <div className="card card-pad mb-6">
        <Field label="Add a category" hint="Categories help learners and staff find courses quickly.">
          <div className="flex gap-3">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Continuing Education" />
            <Button
              onClick={() => {
                if (!name.trim()) return
                actions.categories.add({ id: uid('cat'), name: name.trim(), description: '' })
                setName('')
                toast('Category added.')
              }}
            >
              Add
            </Button>
          </div>
        </Field>
      </div>

      <div className="card divide-y divide-line">
        {categories.map((c) => (
          <div key={c.id} className="px-6 py-4 flex items-center gap-4">
            <Icon name="folder" className="w-5 h-5 text-ink-700" />
            <div className="flex-1 min-w-0">
              <p className="text-[14.5px]">{c.name}</p>
              <p className="hint">{courses.filter((x) => x.categoryId === c.id).length} courses</p>
            </div>
            <button
              onClick={() => {
                actions.categories.remove(c.id)
                courses.forEach((x) => x.categoryId === c.id && actions.updateCourse(x.id, { categoryId: null }))
                toast('Category removed.')
              }}
              className="text-ink-400 hover:text-red-600 p-1.5"
            >
              <Icon name="trash" className="w-[18px] h-[18px]" />
            </button>
          </div>
        ))}
      </div>
    </>
  )
}

function SecurityTab({ draft, setGroup }) {
  const { server: info } = useData()
  const server = useServer()
  const s = draft.security
  return (
    <>
      <Section title="Access & audit">
        <SettingRow label="Two-factor authentication" hint="Signing in also asks for a 6-digit code from an authenticator app on the person's phone. Each person sets it up the next time they sign in.">
          <Toggle checked={s.twoFactor} onChange={(v) => setGroup('security', { twoFactor: v })} />
          {s.twoFactor && <NeedsServer />}
        </SettingRow>
        {s.twoFactor && (
          <SettingRow label="Required for" hint="An administrator can reset someone's two-factor from the Users page if they lose their phone.">
            <Select value={s.twoFactorFor} onChange={(e) => setGroup('security', { twoFactorFor: e.target.value })}>
              <option>Administrators</option>
              <option>Administrators and instructors</option>
              <option>Everyone</option>
            </Select>
          </SettingRow>
        )}
        <SettingRow label="Session timeout" hint="People are signed out after this long without touching the portal. A lesson video that is playing counts as activity. 0 never signs anyone out.">
          <NumberField value={s.sessionTimeout} onChange={(v) => setGroup('security', { sessionTimeout: v })} unit="minutes" />
        </SettingRow>
        <SettingRow label="Failed login attempts before lockout" hint="0 never locks an account.">
          <NumberField value={s.loginAttempts} onChange={(v) => setGroup('security', { loginAttempts: v })} unit="attempts" />
        </SettingRow>
        <SettingRow label="Lockout lasts" hint="An administrator can unlock an account sooner from the Users page.">
          <NumberField value={s.lockoutMinutes} onChange={(v) => setGroup('security', { lockoutMinutes: v })} unit="minutes" min={1} />
        </SettingRow>
        <SettingRow label="Keep an audit log" hint="Records sign-ins, enrollments and content changes in Reports → Activity log, and who changed what in History. Switching it off stops new entries; existing ones stay.">
          <Toggle checked={s.auditLog} onChange={(v) => setGroup('security', { auditLog: v })} />
        </SettingRow>
      </Section>

      <Section title="Password policy">
        <SettingRow label="Strong passwords" hint="New passwords need an uppercase letter, a lowercase letter and a number, as well as the minimum length under Users.">
          <Toggle checked={s.strongPasswords} onChange={(v) => setGroup('security', { strongPasswords: v })} />
        </SettingRow>
        <SettingRow label="Passwords expire after" hint="Once a password is this old, its owner chooses a new one at their next sign-in. 0 means passwords never expire.">
          <NumberField value={s.passwordExpiryDays} onChange={(v) => setGroup('security', { passwordExpiryDays: v })} unit="days" />
        </SettingRow>
        <SettingRow label="New password at first sign-in" hint="Anyone given a password by an administrator replaces it with their own the next time they sign in. Applies to passwords set from now on.">
          <Toggle checked={draft.users.forcePasswordReset} onChange={(v) => setGroup('users', { forcePasswordReset: v })} />
        </SettingRow>
      </Section>

      <Section title="Sessions">
        <SettingRow label="One session at a time" hint="Signing in on a new device signs the user out everywhere else.">
          <Toggle checked={s.singleSession} onChange={(v) => setGroup('security', { singleSession: v })} />
          {s.singleSession && <NeedsServer />}
        </SettingRow>
        <SettingRow label="Allowed IP addresses" hint="One address, block (203.0.113.0/24) or range (203.0.113.5-203.0.113.40) per line. Leave empty to allow sign-in from anywhere.">
          <Textarea rows={3} value={s.allowedIps} onChange={(e) => setGroup('security', { allowedIps: e.target.value })} placeholder="203.0.113.0/24" />
          {server && info?.ip && (
            <p className="hint mt-2">
              Your own address right now is <code className="bg-gray-100 rounded px-1.5 py-0.5">{info.ip}</code>. A list that leaves it out is not saved, so you cannot lock yourself out.
            </p>
          )}
          {s.allowedIps.trim() && <NeedsServer />}
        </SettingRow>
      </Section>
    </>
  )
}

function ImportExportTab() {
  const data = useData()
  const toast = useToast()
  const [confirmReset, setConfirmReset] = useState(false)

  const shared = data.backend.mode === 'server'
  const [confirmUpload, setConfirmUpload] = useState(false)

  const exportState = () => {
    const state = Object.fromEntries(Object.entries(data).filter(([key]) => !NON_DATA_KEYS.includes(key)))
    download('ga-lms-backup.json', JSON.stringify(state, null, 2), 'application/json')
    toast('Portal data exported.')
  }

  return (
    <>
      {shared && data.localCopy && (
        <div className="card card-pad mb-6 border-amber-200">
          <h2 className="card-title mb-2">Data saved in this browser</h2>
          <p className="hint mb-5">
            Before the shared database was connected, this browser kept its own copy of the portal:{' '}
            {plural(data.localCopy.users, 'user')} and {plural(data.localCopy.courses, 'course')}. Moving it adds those users (with the
            passwords set here) and changes to the shared database, so they can sign in from any device.
          </p>
          <Button icon="upload" onClick={() => setConfirmUpload(true)}>
            Move this browser's data to the shared database
          </Button>
        </div>
      )}

      <div className="card card-pad mb-6">
        <h2 className="card-title mb-2">Export portal data</h2>
        <p className="hint mb-5">
          Downloads users, courses, enrollments and settings as a JSON file. Passwords, API keys and other secrets are never included.
        </p>
        <Button icon="download" onClick={exportState}>
          Export JSON
        </Button>
      </div>

      <div className="card card-pad mb-6">
        <h2 className="card-title mb-2">Import portal data</h2>
        <p className="hint mb-5">
          Replaces the current portal contents with a previously exported file
          {shared ? ' — for everyone using the portal.' : '.'}
        </p>
        <label className="btn-ghost cursor-pointer">
          <Icon name="upload" className="w-[18px] h-[18px]" />
          Choose backup file
          <input
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              try {
                const parsed = JSON.parse(await file.text())
                if (!parsed.users || !parsed.courses) throw new Error('missing collections')
                data.actions.importState(parsed)
                toast('Portal data imported.')
              } catch {
                toast('That file is not a valid portal backup.', 'error')
              }
              e.target.value = ''
            }}
          />
        </label>
      </div>

      <div className="card card-pad border-red-200">
        <h2 className="card-title mb-2 text-red-700">Reset portal</h2>
        <p className="hint mb-5">
          Restores the demo content that ships with the portal. Every user, course and enrollment you have added is
          removed{shared ? ' for everyone using the portal, and the sample accounts get their original passwords back' : ''}.
        </p>
        <Button variant="danger" icon="refresh" onClick={() => setConfirmReset(true)}>
          Reset to sample data
        </Button>
      </div>

      <ConfirmDialog
        open={confirmUpload}
        onClose={() => setConfirmUpload(false)}
        onConfirm={() => {
          data.actions.uploadLocalData()
          toast('Moving this browser’s data to the shared database…')
        }}
        title="Move this browser's data"
        message="Users, courses and other records saved in this browser are added to the shared database. Where the same record exists in both, this browser's version replaces the shared one."
        confirmLabel="Move data"
        tone="primary"
      />

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => {
          data.actions.resetPortal()
          toast('Portal reset.')
        }}
        title="Reset portal"
        message="This permanently deletes all current portal data and restores the sample content. This cannot be undone."
        confirmLabel="Reset portal"
      />
    </>
  )
}
