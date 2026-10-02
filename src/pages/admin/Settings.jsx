import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
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
import { useData } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { shrinkImage } from '../../lib/fileStore'
import { withSettingDefaults } from '../../lib/seed'
import SettingsHistory from './SettingsHistory'
import { CURRENCIES, EcommerceTab, GamificationTab, IntegrationsTab, SkillsTab } from './SettingsMore'
import { CustomFields, NumberField, Section, SettingRow } from './SettingsParts'
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

export default function Settings() {
  const data = useData()
  const { settings, actions } = data
  const { user } = useAuth()
  const toast = useToast()
  const [params] = useSearchParams()
  const [tab, setTab] = useState(() => (TABS.some((t) => t.value === params.get('tab')) ? params.get('tab') : 'portal'))

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
    // Only what was edited is written, so History names the settings that really changed.
    const changes = Object.fromEntries(
      Object.entries(draft).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(saved[key])),
    )
    actions.updateSettings(changes)
    actions.logEvent('settings', 'updated the portal settings', user.id)
    setDirty(false)
    toast('Settings saved.')
  }

  const showFooter = DRAFT_TABS.includes(tab)

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-5 lg:-my-7 min-h-[calc(100vh-64px)] lg:min-h-[calc(100vh-72px)] flex flex-col">
      <div className="flex-1 flex flex-col lg:flex-row">
        <SideTabs tabs={TABS} active={tab} onChange={setTab} />

        <div className="flex-1 min-w-0 px-4 sm:px-6 lg:px-10 py-6 lg:py-7 pb-24">
          <h1 className="page-title mb-7">{TABS.find((t) => t.value === tab)?.label}</h1>

          {tab === 'portal' && <PortalTab draft={draft} set={set} setGroup={setGroup} />}
          {tab === 'users' && <UsersTab draft={draft} setGroup={setGroup} />}
          {tab === 'types' && <UserTypesTab />}
          {tab === 'courses' && <CoursesTab draft={draft} setGroup={setGroup} />}
          {tab === 'categories' && <CategoriesTab />}
          {tab === 'skills' && <SkillsTab draft={draft} setGroup={setGroup} />}
          {tab === 'gamification' && <GamificationTab draft={draft} setGroup={setGroup} />}
          {tab === 'ecommerce' && <EcommerceTab draft={draft} set={set} setGroup={setGroup} />}
          {tab === 'integrations' && <IntegrationsTab draft={draft} set={set} setGroup={setGroup} />}
          {tab === 'security' && <SecurityTab draft={draft} setGroup={setGroup} />}
          {tab === 'importexport' && <ImportExportTab />}
          {tab === 'history' && <SettingsHistory />}
        </div>
      </div>

      {showFooter && (
        <div className="sticky bottom-0 z-10 bg-white border-t border-line px-4 sm:px-6 lg:pr-10 lg:pl-[230px] py-4 flex gap-4">
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
  const [domainOpen, setDomainOpen] = useState(false)
  const a = draft.announcements
  return (
    <>
      <Section title="Identity">
        <SettingRow label="Site name" hint="This will appear in search engine results as the title of your site.">
          <Input value={draft.siteName} onChange={(e) => set({ siteName: e.target.value })} className="bg-gray-50" />
        </SettingRow>
        <SettingRow
          label="Site description"
          hint="Briefly describe what your website is about. This will appear in search engine results as the description of your site."
        >
          <Textarea rows={5} value={draft.siteDescription} onChange={(e) => set({ siteDescription: e.target.value })} className="bg-gray-50" />
        </SettingRow>
        <SettingRow label="Domain name" hint="To change your domain name, contact our support team.">
          <Input value={draft.domain} disabled className="bg-gray-50 text-ink-500" />
        </SettingRow>
        <SettingRow label="Custom domain" hint="Change your portal domain name to a custom URL, anytime you want.">
          <button
            onClick={() => setDomainOpen(true)}
            className="w-full flex items-center justify-between border border-line rounded-md h-11 px-4 hover:bg-gray-50"
          >
            <span className="text-[14px] text-ink-700">Disabled</span>
            <Icon name="chevronRight" className="w-4 h-4 text-ink-500" strokeWidth={2.2} />
          </button>
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
        <SettingRow label="Theme" hint="The colours used across the portal.">
          <Select value={draft.theme} onChange={(e) => set({ theme: e.target.value })}>
            <option>GA Healthcare (default)</option>
            <option>Navy &amp; gold</option>
            <option>Light</option>
            <option>High contrast</option>
          </Select>
          <p className="hint mt-2">Only the default theme is available for now; other choices are saved for later.</p>
        </SettingRow>
        <SettingRow label="Website" hint="Shown in the Help Center and on certificates.">
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
        <SettingRow label="Default language">
          <Select value={draft.language} onChange={(e) => set({ language: e.target.value })}>
            <option>English (US)</option>
            <option>Spanish</option>
            <option>French</option>
          </Select>
          <p className="hint mt-2">The portal is in English for now; other choices are saved for later.</p>
        </SettingRow>
        <SettingRow label="Time zone">
          <Select value={draft.timezone} onChange={(e) => set({ timezone: e.target.value })}>
            <option>(GMT -05:00) Eastern Time (US &amp; Canada)</option>
            <option>(GMT -06:00) Central Time (US &amp; Canada)</option>
            <option>(GMT -07:00) Mountain Time (US &amp; Canada)</option>
            <option>(GMT -08:00) Pacific Time (US &amp; Canada)</option>
          </Select>
        </SettingRow>
        <SettingRow label="Date format">
          <Select value={draft.dateFormat} onChange={(e) => set({ dateFormat: e.target.value })}>
            <option>DD/MM/YYYY</option>
            <option>MM/DD/YYYY</option>
          </Select>
        </SettingRow>
        <SettingRow label="Currency" hint="Used for course prices.">
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
        <SettingRow label="Custom homepage" hint="A public welcome page in front of the sign-in page. Saved for later: visitors still land on the sign-in page.">
          <Toggle checked={draft.homepage.custom} onChange={(v) => setGroup('homepage', { custom: v })} />
        </SettingRow>
        {draft.homepage.custom && (
          <>
            <SettingRow label="Headline">
              <Input value={draft.homepage.headline} onChange={(e) => setGroup('homepage', { headline: e.target.value })} />
            </SettingRow>
            <SettingRow label="Introduction">
              <Textarea rows={4} value={draft.homepage.intro} onChange={(e) => setGroup('homepage', { intro: e.target.value })} />
            </SettingRow>
          </>
        )}
      </Section>

      <Modal open={domainOpen} onClose={() => setDomainOpen(false)} title="Custom domain" width="max-w-md">
        <p className="text-[14px] text-ink-700 leading-6">
          Point a CNAME record for your chosen subdomain at this portal, then contact GA Healthcare Training IT to
          have the certificate issued. Until then the portal stays on {draft.domain}.
        </p>
      </Modal>
    </>
  )
}

const SSO_FIELDS = [
  ['identityProvider', 'Identity provider', 'The address of the service that signs your staff in.'],
  ['certificate', 'Certificate fingerprint'],
  ['signInUrl', 'Remote sign-in address'],
  ['signOutUrl', 'Remote sign-out address'],
  ['emailAttribute', 'Email attribute', 'The field in the sign-in response that holds the user’s email address.'],
]

function UsersTab({ draft, setGroup }) {
  const { groups } = useData()
  const u = draft.users
  const sso = draft.sso
  return (
    <>
      <Section title="Registration">
        <SettingRow
          label="Self-registration"
          hint="GA Healthcare Training creates every account from the Users page, so this stays off."
        >
          <div className="flex items-center gap-3">
            <Toggle checked={false} onChange={() => {}} disabled />
            <Badge>Disabled by policy</Badge>
          </div>
        </SettingRow>
        <SettingRow label="Default user type" hint="Applied when an administrator adds a new account.">
          <Select value={u.defaultUserType} onChange={(e) => setGroup('users', { defaultUserType: e.target.value })}>
            <option>Learner-Type</option>
            <option>Trainer-Type</option>
            <option>Admin-Type</option>
          </Select>
        </SettingRow>
        <SettingRow label="Send welcome email" hint="Emails the new user their login details.">
          <Toggle checked={u.welcomeEmail} onChange={(v) => setGroup('users', { welcomeEmail: v })} />
        </SettingRow>
        <SettingRow label="Default group" hint="New accounts join this group and receive its courses. Saved for later: add new users to a group from the Groups page for now.">
          <Select value={u.defaultGroupId} onChange={(e) => setGroup('users', { defaultGroupId: e.target.value })}>
            <option value="">No group</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </SettingRow>
        <SettingRow label="Visible user format" hint="How names appear in lists and reports. Saved for later.">
          <Select value={u.nameFormat} onChange={(e) => setGroup('users', { nameFormat: e.target.value })}>
            <option>First name and last name</option>
            <option>First initial and last name</option>
            <option>Email address</option>
          </Select>
        </SettingRow>
      </Section>

      <Section title="Sign-up">
        <p className="hint -mt-3">
          These apply when people can create their own account. Self-registration is off, so they are saved for later.
        </p>
        <SettingRow label="Restrict sign-up to email domains" hint="Separate domains with commas. Leave empty to allow any address.">
          <Input value={u.allowedDomains} onChange={(e) => setGroup('users', { allowedDomains: e.target.value })} placeholder="gahealthcaretraining.com" />
        </SettingRow>
        <SettingRow label="User verification" hint="How a new account is confirmed before it can be used.">
          <Select value={u.verification} onChange={(e) => setGroup('users', { verification: e.target.value })}>
            <option>None</option>
            <option>CAPTCHA</option>
            <option>Email verification</option>
            <option>Administrator activation</option>
          </Select>
        </SettingRow>
        <SettingRow label="Terms of service" hint="Users accept these the first time they sign in.">
          <Toggle checked={u.termsOn} onChange={(v) => setGroup('users', { termsOn: v })} />
          {u.termsOn && (
            <Textarea rows={5} value={u.terms} onChange={(e) => setGroup('users', { terms: e.target.value })} className="mt-3" />
          )}
        </SettingRow>
        <SettingRow label="Sign in with a social account">
          <div className="space-y-3.5">
            <Toggle checked={u.socialGoogle} onChange={(v) => setGroup('users', { socialGoogle: v })} label="Google" />
            <Toggle checked={u.socialFacebook} onChange={(v) => setGroup('users', { socialFacebook: v })} label="Facebook" />
            <Toggle checked={u.socialLinkedIn} onChange={(v) => setGroup('users', { socialLinkedIn: v })} label="LinkedIn" />
          </div>
        </SettingRow>
      </Section>

      <Section title="Single sign-on">
        <SettingRow label="Single sign-on" hint="Staff sign in with their organization account instead of a portal password. Saved for later: everyone still signs in with a portal password.">
          <Select value={sso.type} onChange={(e) => setGroup('sso', { type: e.target.value })}>
            <option>None</option>
            <option>SAML 2.0</option>
            <option>OpenID Connect</option>
            <option>LDAP</option>
          </Select>
        </SettingRow>
        {sso.type !== 'None' &&
          SSO_FIELDS.map(([key, label, hint]) => (
            <SettingRow key={key} label={label} hint={hint}>
              <Input value={sso[key]} onChange={(e) => setGroup('sso', { [key]: e.target.value })} />
            </SettingRow>
          ))}
      </Section>

      <Section title="Custom user fields">
        <p className="hint -mt-3">Extra details to keep on every account, such as a student ID. Saved for later: they are not on the user form yet.</p>
        <CustomFields
          fields={u.customFields}
          onChange={(customFields) => setGroup('users', { customFields })}
          placeholder="Student ID"
        />
      </Section>

      <Section title="Passwords & inactivity">
        <SettingRow label="Minimum password length">
          <Input
            type="number"
            value={u.passwordMinLength}
            onChange={(e) => setGroup('users', { passwordMinLength: Number(e.target.value) })}
          />
        </SettingRow>
        <SettingRow label="Deactivate after inactivity (days)" hint="0 keeps accounts active indefinitely.">
          <Input
            type="number"
            value={u.inactivityDays}
            onChange={(e) => setGroup('users', { inactivityDays: Number(e.target.value) })}
          />
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
        {userTypes.map((t) => (
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
                {users.filter((u) => u.userType === t.name).length} accounts · access level:{' '}
                <span className="font-medium">{t.role}</span>
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
                    actions.userTypes.remove(t.id)
                    toast('User type removed.')
                  }}
                >
                  Delete
                </Button>
              </div>
            )}
          </div>
        ))}
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
                if (!draft.name.trim()) return
                if (editing.id) actions.userTypes.update(editing.id, draft)
                else actions.userTypes.add({ ...draft, system: false })
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
        <SettingRow label="Completion rule">
          <Select value={c.defaultCompletionRule} onChange={(e) => setGroup('courses', { defaultCompletionRule: e.target.value })}>
            <option>All units must be completed</option>
            <option>Only the final test must be passed</option>
            <option>Instructor marks the course complete</option>
          </Select>
        </SettingRow>
        <SettingRow label="Show progress bar to learners">
          <Toggle checked={c.showProgressBar} onChange={(v) => setGroup('courses', { showProgressBar: v })} />
        </SettingRow>
        <SettingRow label="Allow learners to self-enroll from the catalog" hint="When off, learners can only request enrollment.">
          <Toggle checked={c.allowSelfEnrollment} onChange={(v) => setGroup('courses', { allowSelfEnrollment: v })} />
        </SettingRow>
      </Section>

      <Section title="Learning experience">
        <p className="hint -mt-3">Saved for later: courses keep working as they do today until these are switched on.</p>
        <SettingRow label="Unit navigation" hint="Whether learners take units in order or open any unit they like.">
          <Select value={c.unitNavigation} onChange={(e) => setGroup('courses', { unitNavigation: e.target.value })}>
            <option>In order</option>
            <option>Any order</option>
          </Select>
        </SettingRow>
        <SettingRow label="Show a summary page" hint="Learners see the course outline before the first unit.">
          <Toggle checked={c.showSummary} onChange={(v) => setGroup('courses', { showSummary: v })} />
        </SettingRow>
        <SettingRow label="Discussions" hint="Learners and instructors can post questions inside a course.">
          <Toggle checked={c.discussions} onChange={(v) => setGroup('courses', { discussions: v })} />
        </SettingRow>
        <SettingRow label="Course ratings" hint="Learners rate a course once they complete it.">
          <Toggle checked={c.ratings} onChange={(v) => setGroup('courses', { ratings: v })} />
        </SettingRow>
      </Section>

      <Section title="Catalog">
        <p className="hint -mt-3">Saved for later: the catalog is still shown as cards, to signed-in learners only.</p>
        <SettingRow label="External catalog" hint="Shows the course catalog to visitors who have not signed in.">
          <Toggle checked={c.externalCatalog} onChange={(v) => setGroup('courses', { externalCatalog: v })} />
        </SettingRow>
        <SettingRow label="Catalog layout">
          <Select value={c.catalogLayout} onChange={(e) => setGroup('courses', { catalogLayout: e.target.value })}>
            <option>Cards</option>
            <option>List</option>
          </Select>
        </SettingRow>
        <SettingRow label="Social sharing" hint="Adds share buttons to catalog courses and certificates.">
          <Toggle checked={c.socialSharing} onChange={(v) => setGroup('courses', { socialSharing: v })} />
        </SettingRow>
      </Section>

      <Section title="Certificates">
        <SettingRow label="Issue certificates on completion">
          <Toggle checked={c.certificateEnabled} onChange={(v) => setGroup('courses', { certificateEnabled: v })} />
        </SettingRow>
        <SettingRow label="Certificate validity">
          <Select value={c.certificateValidity} onChange={(e) => setGroup('courses', { certificateValidity: e.target.value })}>
            <option>Never expires</option>
            <option>12 months</option>
            <option>24 months</option>
            <option>36 months</option>
          </Select>
        </SettingRow>
        <SettingRow label="Default certificate template" hint="Saved for later: new courses still start with Classic. Each course picks its own in Course options.">
          <Select value={c.certificateTemplate} onChange={(e) => setGroup('courses', { certificateTemplate: e.target.value })}>
            <option>Classic</option>
            <option>Fancy</option>
            <option>Modern</option>
            <option>Simple</option>
          </Select>
        </SettingRow>
      </Section>

      <Section title="Custom course fields">
        <p className="hint -mt-3">Extra details to keep on every course, such as clock hours. Saved for later: they are not on the course form yet.</p>
        <CustomFields
          fields={c.customFields}
          onChange={(customFields) => setGroup('courses', { customFields })}
          placeholder="Clock hours"
        />
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
  const s = draft.security
  return (
    <>
      <Section title="Access & audit">
        <SettingRow label="Two-factor authentication" hint="Requires a one-time code when signing in.">
          <Toggle checked={s.twoFactor} onChange={(v) => setGroup('security', { twoFactor: v })} />
        </SettingRow>
        {s.twoFactor && (
          <SettingRow label="Required for">
            <Select value={s.twoFactorFor} onChange={(e) => setGroup('security', { twoFactorFor: e.target.value })}>
              <option>Administrators</option>
              <option>Administrators and instructors</option>
              <option>Everyone</option>
            </Select>
          </SettingRow>
        )}
        <SettingRow label="Session timeout (minutes)">
          <Input type="number" value={s.sessionTimeout} onChange={(e) => setGroup('security', { sessionTimeout: Number(e.target.value) })} />
        </SettingRow>
        <SettingRow label="Failed login attempts before lockout">
          <Input type="number" value={s.loginAttempts} onChange={(e) => setGroup('security', { loginAttempts: Number(e.target.value) })} />
        </SettingRow>
        <SettingRow label="Keep an audit log" hint="Records sign-ins, enrollments and content changes in Reports.">
          <Toggle checked={s.auditLog} onChange={(v) => setGroup('security', { auditLog: v })} />
        </SettingRow>
      </Section>

      <Section title="Password policy">
        <p className="hint -mt-3">
          Saved for later: for now the only rule the portal checks is the minimum length in Account &amp; Settings → Users.
        </p>
        <SettingRow label="Strong passwords" hint="Passwords need an uppercase letter, a lowercase letter and a number.">
          <Toggle checked={s.strongPasswords} onChange={(v) => setGroup('security', { strongPasswords: v })} />
        </SettingRow>
        <SettingRow label="Passwords expire after" hint="0 means passwords never expire.">
          <NumberField value={s.passwordExpiryDays} onChange={(v) => setGroup('security', { passwordExpiryDays: v })} unit="days" />
        </SettingRow>
        <SettingRow label="New password at first sign-in" hint="Users replace the password an administrator gave them.">
          <Toggle checked={draft.users.forcePasswordReset} onChange={(v) => setGroup('users', { forcePasswordReset: v })} />
        </SettingRow>
      </Section>

      <Section title="Sessions">
        <p className="hint -mt-3">Saved for later: neither rule is checked at sign-in yet.</p>
        <SettingRow label="One session at a time" hint="Signing in on a new device signs the user out everywhere else.">
          <Toggle checked={s.singleSession} onChange={(v) => setGroup('security', { singleSession: v })} />
        </SettingRow>
        <SettingRow label="Allowed IP addresses" hint="One address or range per line. Leave empty to allow sign-in from anywhere.">
          <Textarea rows={3} value={s.allowedIps} onChange={(e) => setGroup('security', { allowedIps: e.target.value })} placeholder="203.0.113.0/24" />
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
    const { actions, backend, me, syncProblem, localCopy, ...state } = data
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
          Downloads users, courses, enrollments and settings as a JSON file. Passwords are never included. Media
          uploaded from this browser stays in its media library.
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
