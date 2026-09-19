import { cx } from '../../lib/utils'
import Icon from './Icon'

export function Button({ variant = 'primary', size, className, icon, children, ...rest }) {
  const base =
    variant === 'primary'
      ? 'btn-primary'
      : variant === 'outline'
        ? 'btn-outline'
        : variant === 'danger'
          ? 'btn-danger'
          : 'btn-ghost'
  return (
    <button className={cx(base, size === 'sm' && 'btn-sm', className)} {...rest}>
      {icon && <Icon name={icon} className={size === 'sm' ? 'w-4 h-4' : 'w-[18px] h-[18px]'} />}
      {children}
    </button>
  )
}

export function Field({ label, hint, error, required, children, className }) {
  return (
    <div className={cx('mb-5', className)}>
      {label && (
        <label className="label">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      {hint && <p className="hint mb-2">{hint}</p>}
      {children}
      {error && <p className="text-[12.5px] text-red-600 mt-1.5">{error}</p>}
    </div>
  )
}

export function Input({ className, ...rest }) {
  return <input className={cx('field', className)} {...rest} />
}

export function Textarea({ className, rows = 4, ...rest }) {
  return <textarea rows={rows} className={cx('field', className)} {...rest} />
}

export function Select({ className, children, ...rest }) {
  return (
    <div className="relative">
      <select className={cx('field appearance-none pr-10', className)} {...rest}>
        {children}
      </select>
      <Icon
        name="chevronDown"
        className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-500 pointer-events-none"
      />
    </div>
  )
}

export function Toggle({ checked, onChange, label, hint, disabled }) {
  return (
    <label className={cx('flex items-start gap-3', disabled ? 'opacity-60' : 'cursor-pointer')}>
      <button
        type="button"
        role="switch"
        aria-checked={!!checked}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={cx(
          'mt-0.5 shrink-0 w-11 h-6 rounded-full transition relative',
          checked ? 'bg-brand-700' : 'bg-gray-300',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
            checked && 'translate-x-5',
          )}
        />
      </button>
      {(label || hint) && (
        <span>
          {label && <span className="block text-[14px] text-ink-900">{label}</span>}
          {hint && <span className="block hint">{hint}</span>}
        </span>
      )}
    </label>
  )
}

export function Checkbox({ checked, onChange, label, indeterminate, className }) {
  return (
    <label className={cx('inline-flex items-center gap-2.5 cursor-pointer select-none', className)}>
      <span
        onClick={(e) => {
          e.preventDefault()
          onChange?.(!checked)
        }}
        className={cx(
          'w-[18px] h-[18px] rounded-[4px] border flex items-center justify-center transition',
          checked || indeterminate ? 'bg-brand-700 border-brand-700 text-white' : 'border-gray-400 bg-white',
        )}
      >
        {indeterminate ? (
          <Icon name="minus" className="w-3 h-3" strokeWidth={3} />
        ) : checked ? (
          <Icon name="check" className="w-3 h-3" strokeWidth={3} />
        ) : null}
      </span>
      {label && <span className="text-[14px] text-ink-900">{label}</span>}
    </label>
  )
}

export function Radio({ checked, onChange, label, name, className }) {
  return (
    <label className={cx('inline-flex items-center gap-2.5 cursor-pointer select-none', className)}>
      <input type="radio" name={name} checked={!!checked} onChange={() => onChange?.(true)} className="sr-only" />
      <span
        className={cx(
          'w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition',
          checked ? 'border-brand-700' : 'border-gray-400',
        )}
      >
        {checked && <span className="w-2.5 h-2.5 rounded-full bg-brand-700" />}
      </span>
      {label && <span className="text-[14px] text-ink-900">{label}</span>}
    </label>
  )
}

export function SearchInput({ value, onChange, placeholder = 'Search', className }) {
  return (
    <div className={cx('relative', className)}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="field pr-11 italic placeholder:italic"
      />
      <Icon name="search" className="w-[18px] h-[18px] absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-700" />
    </div>
  )
}

export function FileButton({ onFile, accept, children = 'Upload file', multiple = false, className }) {
  return (
    <label className={cx('btn-ghost cursor-pointer', className)}>
      <Icon name="upload" className="w-[18px] h-[18px]" />
      {children}
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || [])
          if (files.length) onFile(multiple ? files : files[0])
          e.target.value = ''
        }}
      />
    </label>
  )
}
