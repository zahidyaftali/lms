import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  DataTable,
  Drawer,
  Dropdown,
  EmptyState,
  Field,
  Icon,
  Input,
  MenuDivider,
  MenuItem,
  Modal,
  OptionList,
  PageHeader,
  SearchInput,
  Select,
  Textarea,
  Toggle,
} from '../../components/ui'
import { useData } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatDate, fullName, randomPassword, shortName, timeAgo, toCSV, download } from '../../lib/utils'

const emptyDraft = () => ({
  firstName: '',
  lastName: '',
  email: '',
  password: randomPassword(),
  userType: 'Learner-Type',
  branchId: '',
  groupIds: [],
  bio: '',
  phone: '',
  active: true,
  notify: true,
})

export default function Users() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { users, userTypes, branches, groups, courses, actions } = useData()
  const { user: me } = useAuth()
  const toast = useToast()

  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({ type: '', status: '', branch: '', group: '' })
  const [filterOpen, setFilterOpen] = useState(false)
  const [selected, setSelected] = useState([])
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState(emptyDraft)
  const [errors, setErrors] = useState({})
  const [credentials, setCredentials] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [enrollTarget, setEnrollTarget] = useState(null)

  useEffect(() => {
    if (params.get('new') === '1') {
      openCreate()
      params.delete('new')
      setParams(params, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return users.filter((u) => {
      if (q && !`${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q)) return false
      if (filters.type && u.userType !== filters.type) return false
      if (filters.status === 'active' && !u.active) return false
      if (filters.status === 'inactive' && u.active) return false
      if (filters.branch && u.branchId !== filters.branch) return false
      if (filters.group && !(u.groupIds || []).includes(filters.group)) return false
      return true
    })
  }, [users, query, filters])

  const activeFilterCount = Object.values(filters).filter(Boolean).length

  function openCreate() {
    setEditing(null)
    setDraft(emptyDraft())
    setErrors({})
    setFormOpen(true)
  }

  function openEdit(u) {
    setEditing(u)
    setDraft({ ...emptyDraft(), ...u, notify: false })
    setErrors({})
    setFormOpen(true)
  }

  function validate() {
    const next = {}
    if (!draft.firstName.trim()) next.firstName = 'First name is required.'
    if (!draft.lastName.trim()) next.lastName = 'Last name is required.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) next.email = 'Enter a valid email address.'
    else if (users.some((u) => u.email.toLowerCase() === draft.email.toLowerCase() && u.id !== editing?.id))
      next.email = 'Another account already uses this email.'
    if (!editing && (draft.password || '').length < 8) next.password = 'Use at least 8 characters.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function save() {
    if (!validate()) return
    const type = userTypes.find((t) => t.name === draft.userType)
    const payload = {
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      email: draft.email.trim(),
      userType: draft.userType,
      role: type?.role || 'learner',
      branchId: draft.branchId || null,
      groupIds: draft.groupIds,
      bio: draft.bio,
      phone: draft.phone,
      active: draft.active,
    }

    if (editing) {
      actions.updateUser(editing.id, payload)
      actions.logEvent('user', `updated the profile of ${shortName(editing)}`, me.id, editing.id)
      toast(`${fullName(payload)} updated.`)
    } else {
      const created = actions.addUser({ ...payload, password: draft.password })
      // Group enrollment mirrors what group membership grants.
      const courseIds = draft.groupIds.flatMap((gid) => groups.find((g) => g.id === gid)?.courseIds || [])
      if (courseIds.length) actions.enroll([created.id], [...new Set(courseIds)])
      actions.logEvent('user', `registered a new user`, me.id, created.id)
      if (draft.notify) setCredentials({ user: created, password: draft.password })
      toast(`${fullName(created)} added to the portal.`)
    }
    setFormOpen(false)
  }

  function runImport() {
    const lines = importText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    let count = 0
    lines.forEach((line) => {
      const [firstName, lastName, email, type = 'Learner-Type'] = line.split(',').map((s) => (s || '').trim())
      if (!email || users.some((u) => u.email.toLowerCase() === email.toLowerCase())) return
      const role = userTypes.find((t) => t.name === type)?.role || 'learner'
      actions.addUser({ firstName, lastName, email, userType: type, role, password: randomPassword(), active: true })
      count += 1
    })
    setImportOpen(false)
    setImportText('')
    toast(count ? `${count} user${count === 1 ? '' : 's'} imported.` : 'No new users found in that list.', count ? 'success' : 'info')
  }

  const columns = [
    {
      key: 'user',
      label: 'User',
      sortValue: (u) => `${u.lastName} ${u.firstName}`,
      render: (u) => (
        <div className="flex items-center gap-3">
          <button className="link font-normal" onClick={() => navigate(`/users/${u.id}`)}>
            {shortName(u)}
          </button>
          {!u.active && <Badge>Inactive</Badge>}
        </div>
      ),
    },
    { key: 'email', label: 'Email', render: (u) => <span className="text-ink-700">{u.email}</span> },
    { key: 'userType', label: 'Type' },
    {
      key: 'registeredAt',
      label: 'Registration',
      sortValue: (u) => new Date(u.registeredAt).getTime(),
      render: (u) => (Date.now() - new Date(u.registeredAt) < 86400000 ? timeAgo(u.registeredAt) : formatDate(u.registeredAt)),
    },
    {
      key: 'lastLogin',
      label: 'Last login',
      sortValue: (u) => (u.lastLogin ? new Date(u.lastLogin).getTime() : 0),
      render: (u) => (u.lastLogin ? timeAgo(u.lastLogin) : '-'),
    },
  ]

  return (
    <div>
      <PageHeader title="Users">
        <div className="flex">
          <Button className="rounded-r-none" onClick={openCreate}>
            Add user
          </Button>
          <Dropdown
            trigger={
              <button className="btn-primary rounded-l-none border-l border-white/25 px-3">
                <Icon name="chevronDown" className="w-4 h-4" strokeWidth={2.4} />
              </button>
            }
          >
            <MenuItem icon="upload" onClick={() => setImportOpen(true)}>
              Import user(s)
            </MenuItem>
            <MenuItem
              icon="download"
              onClick={() =>
                download(
                  'ga-users.csv',
                  toCSV(rows, [
                    { label: 'First name', value: (u) => u.firstName },
                    { label: 'Last name', value: (u) => u.lastName },
                    { label: 'Email', value: (u) => u.email },
                    { label: 'Type', value: (u) => u.userType },
                    { label: 'Registered', value: (u) => formatDate(u.registeredAt) },
                  ]),
                )
              }
            >
              Export list
            </MenuItem>
          </Dropdown>
        </div>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <SearchInput value={query} onChange={setQuery} className="w-[250px]" />
        <button
          onClick={() => setFilterOpen(true)}
          className="relative w-11 h-11 rounded-md flex items-center justify-center text-navy-900 hover:bg-gray-100"
          aria-label="Filters"
        >
          <Icon name="filter" className="w-[22px] h-[22px]" strokeWidth={1.5} />
          {activeFilterCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-brand-700 text-white text-[11px] flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>

        {selected.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[13px] text-ink-500">{selected.length} selected</span>
            <Button size="sm" variant="ghost" icon="book" onClick={() => setEnrollTarget(selected)}>
              Enroll in course
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon="check"
              onClick={() => {
                selected.forEach((id) => actions.updateUser(id, { active: true }))
                toast('Selected users activated.')
                setSelected([])
              }}
            >
              Activate
            </Button>
            <Button
              size="sm"
              variant="danger"
              icon="trash"
              onClick={() =>
                setConfirm({
                  title: 'Delete users',
                  message: `Delete ${selected.length} user account${selected.length === 1 ? '' : 's'}? Their enrollments and progress will be removed.`,
                  onConfirm: () => {
                    actions.deleteUsers(selected.filter((id) => id !== me.id))
                    toast('Users deleted.')
                    setSelected([])
                  },
                })
              }
            >
              Delete
            </Button>
          </div>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        selectable
        selected={selected}
        onSelectedChange={setSelected}
        defaultSort={{ key: 'user', dir: 'asc' }}
        quickActions={(u) => [
          { icon: 'eye', title: 'View profile', onClick: () => navigate(`/users/${u.id}`) },
          { icon: 'book', title: 'Enroll in course', onClick: () => setEnrollTarget([u.id]) },
          { icon: 'pencil', title: 'Edit', onClick: () => openEdit(u) },
          {
            icon: 'trash',
            title: 'Delete',
            danger: true,
            onClick: () =>
              u.id === me.id
                ? toast('You cannot delete the account you are signed in with.', 'info')
                : setConfirm({
                    title: 'Delete user',
                    message: `Delete ${fullName(u)}? This also removes their course progress.`,
                    onConfirm: () => {
                      actions.deleteUsers([u.id])
                      actions.logEvent('delete', `deleted the account of ${shortName(u)}`, me.id)
                      toast('User deleted.')
                    },
                  }),
          },
        ]}
        empty={
          <EmptyState
            icon="users"
            title="No users match your search"
            message="Adjust the filters, or add a new account for a student, trainer or administrator."
            action={<Button onClick={openCreate}>Add user</Button>}
          />
        }
        actions={(u) => (
          <>
            <MenuItem icon="eye" onClick={() => navigate(`/users/${u.id}`)}>
              View profile
            </MenuItem>
            <MenuItem icon="pencil" onClick={() => openEdit(u)}>
              Edit
            </MenuItem>
            <MenuItem icon="book" onClick={() => setEnrollTarget([u.id])}>
              Enroll in course
            </MenuItem>
            <MenuItem
              icon="refresh"
              onClick={() => {
                const password = randomPassword()
                actions.updateUser(u.id, { password })
                setCredentials({ user: u, password })
              }}
            >
              Reset password
            </MenuItem>
            <MenuItem
              icon={u.active ? 'lock' : 'check'}
              onClick={() => {
                actions.updateUser(u.id, { active: !u.active })
                toast(`${shortName(u)} ${u.active ? 'deactivated' : 'activated'}.`)
              }}
            >
              {u.active ? 'Deactivate' : 'Activate'}
            </MenuItem>
            <MenuDivider />
            <MenuItem
              icon="trash"
              danger
              disabled={u.id === me.id}
              onClick={() =>
                setConfirm({
                  title: 'Delete user',
                  message: `Delete ${fullName(u)}? This also removes their course progress.`,
                  onConfirm: () => {
                    actions.deleteUsers([u.id])
                    actions.logEvent('delete', `deleted the account of ${shortName(u)}`, me.id)
                    toast('User deleted.')
                  },
                })
              }
            >
              Delete
            </MenuItem>
          </>
        )}
      />

      <button
        onClick={openCreate}
        className="mt-5 text-navy-900 hover:text-brand-700"
        aria-label="Add user"
        title="Add user"
      >
        <Icon name="userPlus" className="w-[22px] h-[22px]" strokeWidth={1.5} />
      </button>

      {/* ------------------------------------------------------------ form */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${fullName(editing)}` : 'Add user'}
        subtitle={
          editing
            ? 'Update the account details and access level.'
            : 'The portal has no public sign-up — every account is created here.'
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>{editing ? 'Save changes' : 'Create user'}</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5">
          <Field label="First name" required error={errors.firstName}>
            <Input value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} />
          </Field>
          <Field label="Last name" required error={errors.lastName}>
            <Input value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} />
          </Field>
          <Field label="Email address" required error={errors.email} className="sm:col-span-2">
            <Input
              type="email"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              placeholder="student@example.com"
            />
          </Field>

          {!editing && (
            <Field
              label="Password"
              required
              error={errors.password}
              hint="Share this with the user — they can change it from their profile."
              className="sm:col-span-2"
            >
              <div className="flex gap-3">
                <Input value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} />
                <Button variant="ghost" icon="refresh" onClick={() => setDraft({ ...draft, password: randomPassword() })}>
                  Generate
                </Button>
              </div>
            </Field>
          )}

          <Field label="User type" hint="Controls what this account can access.">
            <Select value={draft.userType} onChange={(e) => setDraft({ ...draft, userType: e.target.value })}>
              {userTypes.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Branch" hint="Optional campus this account belongs to.">
            <Select value={draft.branchId || ''} onChange={(e) => setDraft({ ...draft, branchId: e.target.value })}>
              <option value="">No branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Phone" className="sm:col-span-2">
            <Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
          </Field>

          <Field label="Groups" hint="Members inherit every course assigned to the group." className="sm:col-span-2">
            <OptionList>
              {groups.map((g) => (
                <Checkbox
                  key={g.id}
                  label={g.name}
                  checked={draft.groupIds.includes(g.id)}
                  onChange={(checked) =>
                    setDraft({
                      ...draft,
                      groupIds: checked ? [...draft.groupIds, g.id] : draft.groupIds.filter((id) => id !== g.id),
                    })
                  }
                />
              ))}
            </OptionList>
          </Field>

          <Field label="Bio" className="sm:col-span-2">
            <Textarea value={draft.bio} onChange={(e) => setDraft({ ...draft, bio: e.target.value })} rows={3} />
          </Field>

          <div className="sm:col-span-2 space-y-4">
            <Toggle
              checked={draft.active}
              onChange={(v) => setDraft({ ...draft, active: v })}
              label="Account is active"
              hint="Inactive accounts cannot sign in."
            />
            {!editing && (
              <Toggle
                checked={draft.notify}
                onChange={(v) => setDraft({ ...draft, notify: v })}
                label="Show login details to send"
                hint="Displays the credentials so you can email them to the user."
              />
            )}
          </div>
        </div>
      </Modal>

      {/* ----------------------------------------------------- credentials */}
      <Modal
        open={!!credentials}
        onClose={() => setCredentials(null)}
        title="Login details"
        subtitle="Send these to the user — the portal has no self-service sign-up."
        width="max-w-md"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                navigator.clipboard?.writeText(
                  `Portal: ${window.location.origin}\nEmail: ${credentials.user.email}\nPassword: ${credentials.password}`,
                )
                toast('Login details copied to clipboard.')
              }}
            >
              Copy
            </Button>
            <Button
              onClick={() => {
                window.location.href = `mailto:${credentials.user.email}?subject=${encodeURIComponent('Your GA Healthcare Training portal account')}&body=${encodeURIComponent(`Hello ${credentials.user.firstName},\n\nYour account is ready.\n\nPortal: ${window.location.origin}\nEmail: ${credentials.user.email}\nPassword: ${credentials.password}\n\nGA Healthcare Training & Consulting`)}`
                setCredentials(null)
              }}
            >
              Send by email
            </Button>
          </>
        }
      >
        {credentials && (
          <dl className="space-y-3.5 text-[14px]">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">User</dt>
              <dd className="font-medium">{fullName(credentials.user)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">Email</dt>
              <dd className="font-medium">{credentials.user.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">Password</dt>
              <dd>
                <code className="bg-gray-100 rounded px-2.5 py-1">{credentials.password}</code>
              </dd>
            </div>
          </dl>
        )}
      </Modal>

      {/* --------------------------------------------------------- filters */}
      <Drawer open={filterOpen} onClose={() => setFilterOpen(false)} title="Filter users" width="max-w-md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFilters({ type: '', status: '', branch: '', group: '' })}>
              Clear all
            </Button>
            <Button onClick={() => setFilterOpen(false)}>Apply</Button>
          </>
        }
      >
        <Field label="User type">
          <Select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
            <option value="">All types</option>
            {userTypes.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </Field>
        <Field label="Branch">
          <Select value={filters.branch} onChange={(e) => setFilters({ ...filters, branch: e.target.value })}>
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Group">
          <Select value={filters.group} onChange={(e) => setFilters({ ...filters, group: e.target.value })}>
            <option value="">All groups</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
      </Drawer>

      {/* ---------------------------------------------------------- import */}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import users"
        subtitle="One user per line: First name, Last name, Email, User type"
        footer={
          <>
            <Button variant="ghost" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={runImport}>Import</Button>
          </>
        }
      >
        <Field label="Paste your list" hint="Each imported account gets a generated password you can reset afterwards.">
          <Textarea
            rows={8}
            value={importText}
            placeholder={'Maria, Lopez, maria.lopez@example.com, Learner-Type\nJames, Carter, james.carter@example.com, Learner-Type'}
            onChange={(e) => setImportText(e.target.value)}
          />
        </Field>
        <label className="btn-ghost cursor-pointer">
          <Icon name="upload" className="w-[18px] h-[18px]" />
          Choose CSV file
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const text = await file.text()
              const lines = text.split('\n').filter((l) => !/first\s*name/i.test(l))
              setImportText(lines.join('\n'))
              e.target.value = ''
            }}
          />
        </label>
      </Modal>

      {/* --------------------------------------------------------- enroll */}
      <EnrollModal
        open={!!enrollTarget}
        userIds={enrollTarget || []}
        courses={courses}
        onClose={() => setEnrollTarget(null)}
        onEnroll={(courseIds) => {
          actions.enroll(enrollTarget, courseIds)
          toast('Users enrolled.')
          setEnrollTarget(null)
          setSelected([])
        }}
      />

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

export function EnrollModal({ open, userIds, courses, onClose, onEnroll }) {
  const [picked, setPicked] = useState([])

  useEffect(() => {
    if (open) setPicked([])
  }, [open])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Enroll in courses"
      subtitle={`${userIds.length} user${userIds.length === 1 ? '' : 's'} selected`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!picked.length} onClick={() => onEnroll(picked)}>
            Enroll
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {courses
          .filter((c) => c.status === 'active')
          .map((c) => (
            <label
              key={c.id}
              className="flex items-center gap-3 rounded-md border border-line px-4 py-3 cursor-pointer hover:bg-gray-50"
            >
              <Checkbox
                checked={picked.includes(c.id)}
                onChange={(v) => setPicked(v ? [...picked, c.id] : picked.filter((id) => id !== c.id))}
              />
              <span className="flex-1">
                <span className="block text-[14px] text-ink-900">{c.name}</span>
                <span className="block text-[12.5px] text-ink-500">
                  {c.units.filter((u) => u.type !== 'section').length} units
                </span>
              </span>
            </label>
          ))}
      </div>
    </Modal>
  )
}
