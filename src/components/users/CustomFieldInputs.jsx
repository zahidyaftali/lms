import { Checkbox, Field, Input, Select } from '../ui'

/**
 * Inputs for the custom fields defined in Account & Settings (Users or Courses).
 * `values` is { [fieldId]: value }.
 */
export default function CustomFieldInputs({ fields = [], values = {}, onChange, errors = {}, className }) {
  if (!fields.length) return null
  const set = (id, value) => onChange({ ...values, [id]: value })
  return fields.map((f) => (
    <Field key={f.id} label={f.type === 'Checkbox' ? undefined : f.name} required={f.required && f.type !== 'Checkbox'} error={errors[f.id]} className={className}>
      {f.type === 'Dropdown' ? (
        <Select value={values[f.id] || ''} onChange={(e) => set(f.id, e.target.value)}>
          <option value="">Choose…</option>
          {(f.options || []).map((o) => (
            <option key={o}>{o}</option>
          ))}
        </Select>
      ) : f.type === 'Checkbox' ? (
        <Checkbox label={`${f.name}${f.required ? ' *' : ''}`} checked={!!values[f.id]} onChange={(v) => set(f.id, v)} />
      ) : (
        <Input type={f.type === 'Date' ? 'date' : 'text'} value={values[f.id] || ''} onChange={(e) => set(f.id, e.target.value)} />
      )}
    </Field>
  ))
}

/** Required custom fields that are still empty: { [fieldId]: message }. */
export function customFieldErrors(fields = [], values = {}) {
  const errors = {}
  for (const f of fields) {
    const v = values[f.id]
    if (f.required && (v == null || v === '' || v === false)) errors[f.id] = `${f.name} is required.`
  }
  return errors
}

/** A stored value as text, for profile and course summaries. */
export function customFieldText(field, value) {
  if (value == null || value === '') return ''
  if (field.type === 'Checkbox') return value ? 'Yes' : 'No'
  return String(value)
}
