import { useMemo, useState } from 'react'
import { cx, initials } from '../../lib/utils'
import Icon from './Icon'
import { Checkbox } from './controls'
import { Dropdown } from './overlays'

export function Avatar({ user, size = 36, className }) {
  const dimension = { width: size, height: size }
  if (user?.avatar) {
    return (
      <img
        src={user.avatar}
        alt=""
        style={dimension}
        className={cx('rounded-full object-cover shrink-0', className)}
      />
    )
  }
  return (
    <span
      style={{ ...dimension, fontSize: size * 0.38 }}
      className={cx(
        'rounded-full bg-navy-600 text-white font-medium flex items-center justify-center shrink-0',
        className,
      )}
    >
      {initials(user)}
    </span>
  )
}

export function Badge({ children, tone = 'gray', className }) {
  const tones = {
    gray: 'bg-gray-200 text-ink-700',
    blue: 'bg-brand-50 text-brand-700 border border-brand-100',
    green: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border border-amber-100',
    red: 'bg-red-50 text-red-700 border border-red-100',
    navy: 'bg-navy-900 text-white',
  }
  return (
    <span
      className={cx(
        'inline-flex items-center px-2.5 py-1 rounded text-[12px] font-medium leading-none',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function PageHeader({ title, subtitle, children, className }) {
  return (
    <div className={cx('flex flex-wrap items-center justify-between gap-4 mb-6', className)}>
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="hint mt-1.5">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  )
}

export function EmptyState({ icon = 'folder', title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <span className="text-brand-700 mb-3">
        <Icon name={icon} className="w-9 h-9" strokeWidth={1.4} />
      </span>
      <p className="text-[15px] font-semibold text-brand-700">{title}</p>
      {message && <p className="hint mt-1.5 max-w-md">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Progress({ value, className, tone = 'brand' }) {
  return (
    <div className={cx('h-2 rounded-full bg-gray-200 overflow-hidden', className)}>
      <div
        className={cx('h-full rounded-full transition-all', tone === 'green' ? 'bg-emerald-500' : 'bg-brand-700')}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

export function Tabs({ tabs, active, onChange, className }) {
  return (
    <div className={cx('flex gap-7 border-b border-line', className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cx(
            'relative pb-3 text-[14px] transition whitespace-nowrap',
            active === t.value
              ? 'text-ink-900 font-semibold after:absolute after:-bottom-px after:left-0 after:right-0 after:h-[3px] after:bg-brand-700 after:rounded-t'
              : 'text-ink-500 hover:text-ink-900',
          )}
        >
          {t.label}
          {t.count != null && <span className="ml-1.5 text-ink-400">({t.count})</span>}
        </button>
      ))}
    </div>
  )
}

/** Vertical tab rail used by Account & Settings. */
export function SideTabs({ tabs, active, onChange }) {
  return (
    <nav className="w-[190px] shrink-0">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cx(
            'w-full text-left px-4 py-3 text-[14px] transition',
            active === t.value
              ? 'bg-navy-900 text-white font-medium'
              : 'text-ink-700 hover:bg-gray-50',
          )}
        >
          {t.label}
        </button>
      ))}
    </nav>
  )
}

export function DataTable({
  columns,
  rows,
  rowKey = (r) => r.id,
  selectable = false,
  selected = [],
  onSelectedChange,
  actions,
  empty,
  defaultSort,
  onRowClick,
}) {
  const [sort, setSort] = useState(defaultSort || { key: columns[0]?.key, dir: 'asc' })

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort.key)
    if (!col || col.sortable === false) return rows
    const get = col.sortValue || ((r) => r[col.key])
    return [...rows].sort((a, b) => {
      const av = get(a)
      const bv = get(b)
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      const res = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return sort.dir === 'asc' ? res : -res
    })
  }, [rows, columns, sort])

  const allSelected = rows.length > 0 && selected.length === rows.length
  const toggleAll = () => onSelectedChange?.(allSelected ? [] : rows.map(rowKey))
  const toggleOne = (id) =>
    onSelectedChange?.(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])

  return (
    <div className="w-full overflow-x-auto scroll-thin">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr className="table-head border-y border-line">
            {selectable && (
              <th className="w-12 px-4 py-3.5">
                <Checkbox checked={allSelected} indeterminate={!allSelected && selected.length > 0} onChange={toggleAll} />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className={cx('px-4 py-3.5 text-left font-semibold', col.className)}
              >
                {col.sortable === false ? (
                  col.label
                ) : (
                  <button
                    className="inline-flex items-center gap-1.5 hover:text-brand-700"
                    onClick={() =>
                      setSort((s) => ({ key: col.key, dir: s.key === col.key && s.dir === 'asc' ? 'desc' : 'asc' }))
                    }
                  >
                    {col.label}
                    {sort.key === col.key && (
                      <Icon name={sort.dir === 'asc' ? 'chevronUp' : 'chevronDown'} className="w-3.5 h-3.5" strokeWidth={2.4} />
                    )}
                  </button>
                )}
              </th>
            ))}
            {actions && <th className="w-14 px-4 py-3.5" />}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, index) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cx(
                'border-b border-line/70 text-[14px] text-ink-900',
                index % 2 === 1 && 'bg-gray-50/70',
                onRowClick && 'cursor-pointer hover:bg-brand-50/50',
              )}
            >
              {selectable && (
                <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={selected.includes(rowKey(row))} onChange={() => toggleOne(rowKey(row))} />
                </td>
              )}
              {columns.map((col) => (
                <td key={col.key} className={cx('px-4 py-3.5 align-middle', col.cellClassName)}>
                  {col.render ? col.render(row) : (row[col.key] ?? '-')}
                </td>
              ))}
              {actions && (
                <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                  <Dropdown
                    trigger={
                      <button className="p-1.5 rounded text-ink-700 hover:bg-gray-100">
                        <Icon name="dots" strokeWidth={2.6} />
                      </button>
                    }
                  >
                    {actions(row)}
                  </Dropdown>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (empty || <EmptyState title="Nothing to show yet" message="Try adjusting your search or filters." />)}
    </div>
  )
}

export function StatRow({ icon, label, value }) {
  return (
    <div className="flex items-center gap-4 py-3.5">
      <span className="text-ink-700">
        <Icon name={icon} className="w-[22px] h-[22px]" strokeWidth={1.5} />
      </span>
      <span className="flex-1 text-[14.5px] text-ink-900">{label}</span>
      <span className="text-[15px] font-semibold text-ink-900">{value}</span>
    </div>
  )
}
