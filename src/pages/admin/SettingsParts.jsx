import { useState } from 'react'
import { Button, Checkbox, Icon, Input, Select } from '../../components/ui'
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

const FIELD_TYPES = ['Text', 'Dropdown', 'Checkbox', 'Date']

/** Extra profile or course fields: a name, a type and whether they must be filled in. */
export function CustomFields({ fields, onChange, placeholder }) {
  const [name, setName] = useState('')
  const [type, setType] = useState(FIELD_TYPES[0])

  const add = () => {
    if (!name.trim()) return
    onChange([...fields, { id: uid('cf'), name: name.trim(), type, required: false }])
    setName('')
    setType(FIELD_TYPES[0])
  }

  return (
    <div>
      {fields.length > 0 && (
        <ul className="border border-line rounded-md divide-y divide-line mb-4">
          {fields.map((f) => (
            <li key={f.id} className="flex items-center gap-3.5 px-4 py-2.5">
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] truncate">{f.name}</span>
                <span className="block hint">{f.type}</span>
              </span>
              <Checkbox
                label="Required"
                checked={f.required}
                onChange={(v) => onChange(fields.map((x) => (x.id === f.id ? { ...x, required: v } : x)))}
              />
              <button
                type="button"
                title="Remove field"
                aria-label={`Remove ${f.name}`}
                onClick={() => onChange(fields.filter((x) => x.id !== f.id))}
                className="p-1.5 rounded text-ink-700 hover:text-red-600 hover:bg-red-50"
              >
                <Icon name="trash" className="w-[18px] h-[18px]" />
              </button>
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
