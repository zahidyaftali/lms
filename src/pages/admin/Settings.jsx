import { useEffect, useState } from 'react'
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
import { readAsDataURL } from '../../lib/fileStore'
import { download, uid } from '../../lib/utils'

const TABS = [
  { value: 'portal', label: 'Portal' },
  { value: 'users', label: 'Users' },
  { value: 'types', label: 'User types' },
  { value: 'courses', label: 'Courses' },
  { value: 'categories', label: 'Categories' },
  { value: 'security', label: 'Security' },
  { value: 'importexport', label: 'Import-Export' },
]

export default function Settings() {
  const data = useData()
  const { settings, actions } = data
  const { user } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('portal')
  const [draft, setDraft] = useState(settings)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setDraft(settings)
    setDirty(false)
  }, [settings, tab])

  const set = (changes) => {
    setDraft((d) => ({ ...d, ...changes }))
    setDirty(true)
  }
  const setGroup = (group, changes) => {
    setDraft((d) => ({ ...d, [group]: { ...d[group], ...changes } }))
    setDirty(true)
  }

  const save = () => {
    actions.updateSettings(draft)
    actions.logEvent('settings', 'updated the portal settings', user.id)
    setDirty(false)
    toast('Settings saved.')
  }

  const showFooter = ['portal', 'users', 'courses', 'security'].includes(tab)

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-5 lg:-my-7 min-h-[calc(100vh-64px)] lg:min-h-[calc(100vh-72px)] flex flex-col">
      <div className="flex-1 flex flex-col lg:flex-row">
        <SideTabs tabs={TABS} active={tab} onChange={setTab} />

        <div className="flex-1 min-w-0 px-4 sm:px-6 lg:px-10 py-6 lg:py-7 pb-24">
          <h1 className="page-title mb-7">{TABS.find((t) => t.value === tab)?.label}</h1>

          {tab === 'portal' && <PortalTab draft={draft} set={set} />}
          {tab === 'users' && <UsersTab draft={draft} setGroup={setGroup} />}
          {tab === 'types' && <UserTypesTab />}
          {tab === 'courses' && <CoursesTab draft={draft} setGroup={setGroup} />}
          {tab === 'categories' && <CategoriesTab />}
          {tab === 'security' && <SecurityTab draft={draft} setGroup={setGroup} />}
          {tab === 'importexport' && <ImportExportTab />}
        </div>
      </div>

      {showFooter && (
        <div className="sticky bottom-0 z-10 bg-white border-t border-line px-4 sm:px-6 lg:px-10 py-4 flex gap-4">
          <Button onClick={save} disabled={!dirty}>
            Save
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setDraft(settings)
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

function Section({ title, children }) {
  return (
    <section className="card mb-6">
      <div className="px-5 sm:px-7 py-6">
        <h2 className="text-[13px] font-semibold tracking-[0.12em] uppercase text-ink-700 mb-6">{title}</h2>
        <div className="space-y-7">{children}</div>
      </div>
    </section>
  )
}

function SettingRow({ label, hint, children }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-4 md:gap-10 items-start">
      <div>
        <p className="text-[14.5px] font-medium text-ink-900">{label}</p>
        {hint && <p className="hint mt-1">{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  )
}

function PortalTab({ draft, set }) {
  const [domainOpen, setDomainOpen] = useState(false)
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
        <SettingRow label="Logo" hint="Accepted file format: gif, jpg, jpeg, png. Size: 3MB">
          <div className="flex items-center gap-4">
            <span className="flex-1">
              {draft.logo ? <img src={draft.logo} alt="Portal logo" className="h-12" /> : <Logo size="sm" />}
            </span>
            <label className="p-2 rounded text-ink-700 hover:bg-gray-100 cursor-pointer" title="Upload logo">
              <Icon name="upload" className="w-[20px] h-[20px]" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (file) set({ logo: await readAsDataURL(file) })
                  e.target.value = ''
                }}
              />
            </label>
            <button onClick={() => set({ logo: null })} className="p-2 rounded text-ink-700 hover:bg-gray-100" title="Remove logo">
              <Icon name="trash" className="w-[20px] h-[20px]" />
            </button>
          </div>
        </SettingRow>
        <SettingRow label="Website" hint="Shown in the Help Center and on certificates.">
          <Input value={draft.website} onChange={(e) => set({ website: e.target.value })} />
        </SettingRow>
      </Section>

      <Section title="Contact & localization">
        <SettingRow label="Support email">
          <Input value={draft.supportEmail} onChange={(e) => set({ supportEmail: e.target.value })} />
        </SettingRow>
        <SettingRow label="Support phone">
          <Input value={draft.supportPhone} onChange={(e) => set({ supportPhone: e.target.value })} />
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

function UsersTab({ draft, setGroup }) {
  const u = draft.users
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
      </Section>

      <Section title="Passwords & inactivity">
        <SettingRow label="Minimum password length">
          <Input
            type="number"
            value={u.passwordMinLength}
            onChange={(e) => setGroup('users', { passwordMinLength: Number(e.target.value) })}
          />
        </SettingRow>
        <SettingRow label="Force password change on first login">
          <Toggle checked={u.forcePasswordReset} onChange={(v) => setGroup('users', { forcePasswordReset: v })} />
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
    <Section title="Access & audit">
      <SettingRow label="Two-factor authentication" hint="Requires a one-time code for administrators.">
        <Toggle checked={s.twoFactor} onChange={(v) => setGroup('security', { twoFactor: v })} />
      </SettingRow>
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
  )
}

function ImportExportTab() {
  const data = useData()
  const toast = useToast()
  const [confirmReset, setConfirmReset] = useState(false)

  const exportState = () => {
    const { actions, ...state } = data
    download('ga-lms-backup.json', JSON.stringify(state, null, 2), 'application/json')
    toast('Portal data exported.')
  }

  return (
    <>
      <div className="card card-pad mb-6">
        <h2 className="card-title mb-2">Export portal data</h2>
        <p className="hint mb-5">
          Downloads users, courses, enrollments and settings as a JSON file. Uploaded media stays in the browser
          media library.
        </p>
        <Button icon="download" onClick={exportState}>
          Export JSON
        </Button>
      </div>

      <div className="card card-pad mb-6">
        <h2 className="card-title mb-2">Import portal data</h2>
        <p className="hint mb-5">Replaces the current portal contents with a previously exported file.</p>
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
          removed.
        </p>
        <Button variant="danger" icon="refresh" onClick={() => setConfirmReset(true)}>
          Reset to sample data
        </Button>
      </div>

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
