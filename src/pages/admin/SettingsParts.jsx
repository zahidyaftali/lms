import { useCallback, useEffect, useState } from 'react'
import { Badge, Button, Checkbox, Icon, Input, Select } from '../../components/ui'
import { useData } from '../../context/DataContext'
import { useToast } from '../../context/ToastContext'
import { cx, uid } from '../../lib/utils'

/** Building blocks shared by the Account & Settings tabs. */

export function Section({ title, children, muted }) {
  return (
    <section className={cx('card mb-6 transition-opacity', muted && 'opacity-55')}>
      <div className="px-5 sm:px-7 py-6">
        <h2 className="text-[13px] font-semibold tracking-[0.12em] uppercase text-ink-700 mb-6">{title}</h2>
        <div className="space-y-7">{children}</div>
      </div>
    </section>
  )
}

export function SettingRow({ label, hint, children }) {
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

/** A whole number with its unit after it, e.g. "25 points". */
export function NumberField({ value, onChange, unit, min = 0, max }) {
  return (
    <div className="flex items-center gap-3">
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Math.max(min, Number(e.target.value) || 0)
          onChange(max == null ? n : Math.min(max, n))
        }}
        className="w-28"
      />
      {unit && <span className="text-[14px] text-ink-700">{unit}</span>}
    </div>
  )
}

/**
 * Whether this portal has its shared database (and so a server). Sign-in
 * security, email, payments and connections to other services are the
 * server's work; a browser on its own cannot do them.
 */
export function useServer() {
  const { backend } = useData()
  return backend.mode === 'server'
}

/** Shown on settings that only take effect once the shared database is connected. */
export function NeedsServer({ children }) {
  const server = useServer()
  if (server) return null
  return (
    <p className="mt-2 flex gap-2 text-[13px] leading-5 text-amber-900 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
      <Icon name="alert" className="w-4 h-4 mt-0.5 shrink-0" />
      <span>{children || 'Takes effect once the shared database is connected: a browser on its own cannot do this.'}</span>
    </p>
  )
}

/** The keys and client secrets kept on the server: which are set, and a way to change them. */
export function useSecrets() {
  const { actions } = useData()
  const server = useServer()
  const [status, setStatus] = useState(null)

  const refresh = useCallback(async () => {
    if (!server) return
    const res = await actions.rpc('secrets.status', {}, { refresh: false })
    if (res.ok) setStatus(res)
  }, [actions, server])

  useEffect(() => {
    refresh()
  }, [refresh])

  const save = useCallback(
    async (name, value) => {
      const res = await actions.rpc('secrets.set', { name, value }, { refresh: false })
      if (res.ok) await refresh()
      return res
    },
    [actions, refresh],
  )

  return { server, secrets: status?.secrets || {}, emailReady: !!status?.email, signIn: status?.signIn || {}, save, refresh }
}

/**
 * A key or client secret. It is saved straight to the server, which never
 * sends it back: only "saved, ending in 1234" is ever shown.
 */
export function SecretField({ name, secrets, placeholder = 'Paste the key', label = 'Save key' }) {
  const toast = useToast()
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const current = secrets.secrets[name]

  if (!secrets.server) return <NeedsServer>Keys are kept on the server, so this needs the shared database.</NeedsServer>

  async function save(next) {
    setBusy(true)
    const res = await secrets.save(name, next)
    setBusy(false)
    if (!res.ok) return toast(res.error, 'error')
    setValue('')
    toast(next ? 'Saved on the server.' : 'Removed.')
  }

  return (
    <div>
      {current?.set && (
        <p className="flex flex-wrap items-center gap-2.5 mb-2.5 text-[13.5px]">
          <Badge tone="green">Saved</Badge>
          <code className="text-ink-700">{current.hint}</code>
          {current.source === 'environment' ? (
            <span className="hint">from the hosting environment</span>
          ) : (
            <button type="button" className="link text-[13px]" onClick={() => save('')} disabled={busy}>
              Remove
            </button>
          )}
        </p>
      )}
      <div className="flex gap-2.5">
        <Input type="password" value={value} onChange={(e) => setValue(e.target.value)} placeholder={current?.set ? 'Paste a new one to replace it' : placeholder} autoComplete="off" />
        <Button variant="outline" disabled={busy || !value.trim()} onClick={() => save(value.trim())}>
          {label}
        </Button>
      </div>
    </div>
  )
}

const FIELD_TYPES = ['Text', 'Dropdown', 'Checkbox', 'Date']

/** Extra profile or course fields: a name, a type, the choices of a dropdown and whether they must be filled in. */
export function CustomFields({ fields, onChange, placeholder }) {
  const [name, setName] = useState('')
  const [type, setType] = useState(FIELD_TYPES[0])
  const update = (id, changes) => onChange(fields.map((x) => (x.id === id ? { ...x, ...changes } : x)))

  const add = () => {
    if (!name.trim()) return
    onChange([...fields, { id: uid('cf'), name: name.trim(), type, required: false, options: [] }])
    setName('')
    setType(FIELD_TYPES[0])
  }

  return (
    <div>
      {fields.length > 0 && (
        <ul className="border border-line rounded-md divide-y divide-line mb-4">
          {fields.map((f) => (
            <li key={f.id} className="px-4 py-2.5">
              <div className="flex items-center gap-3.5">
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] truncate">{f.name}</span>
                  <span className="block hint">{f.type}</span>
                </span>
                <Checkbox label="Required" checked={f.required} onChange={(v) => update(f.id, { required: v })} />
                <button
                  type="button"
                  title="Remove field"
                  aria-label={`Remove ${f.name}`}
                  onClick={() => onChange(fields.filter((x) => x.id !== f.id))}
                  className="p-1.5 rounded text-ink-700 hover:text-red-600 hover:bg-red-50"
                >
                  <Icon name="trash" className="w-[18px] h-[18px]" />
                </button>
              </div>
              {f.type === 'Dropdown' && (
                <Input
                  className="mt-2 h-10"
                  value={(f.options || []).join(', ')}
                  onChange={(e) => update(f.id, { options: e.target.value.split(',').map((o) => o.trimStart()) })}
                  onBlur={() => update(f.id, { options: (f.options || []).map((o) => o.trim()).filter(Boolean) })}
                  placeholder="Choices, separated by commas"
                  aria-label={`Choices for ${f.name}`}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder={placeholder}
          className="flex-1 min-w-[160px]"
        />
        <div className="w-36">
          <Select value={type} onChange={(e) => setType(e.target.value)} aria-label="Field type">
            {FIELD_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </div>
        <Button variant="outline" onClick={add} disabled={!name.trim()}>
          Add field
        </Button>
      </div>
    </div>
  )
}
