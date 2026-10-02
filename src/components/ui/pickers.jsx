import { useState } from 'react'
import Icon from './Icon'
import { Button, SearchInput } from './controls'

/**
 * A list with Add / Remove on every row, for choosing users or courses inside a
 * drawer. `title`, `subtitle` and `leading` describe how to draw one item.
 */
export function PickList({ items, selected, onChange, title, subtitle, leading, empty = 'Nothing to choose from yet.' }) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const rows = items.filter((item) => `${title(item)} ${subtitle?.(item) || ''}`.toLowerCase().includes(q))

  if (!items.length) return <p className="hint py-6 text-center">{empty}</p>

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        {items.length > 6 && <SearchInput value={query} onChange={setQuery} className="flex-1" />}
        <span className="hint whitespace-nowrap ml-auto">{selected.length} selected</span>
      </div>
      <ul className="divide-y divide-line">
        {rows.map((item) => {
          const picked = selected.includes(item.id)
          return (
            <li key={item.id} className="py-3 flex items-center gap-3.5">
              {leading?.(item)}
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] truncate">{title(item)}</span>
                {subtitle && <span className="block hint truncate">{subtitle(item)}</span>}
              </span>
              <Button
                size="sm"
                variant={picked ? 'ghost' : 'outline'}
                onClick={() => onChange(picked ? selected.filter((id) => id !== item.id) : [...selected, item.id])}
              >
                {picked ? 'Remove' : 'Add'}
              </Button>
            </li>
          )
        })}
      </ul>
      {rows.length === 0 && <p className="hint py-6 text-center">No matches for “{query}”.</p>}
    </div>
  )
}

/** The note shown on pages whose rules are stored but not yet acted on by the portal. */
export function SetupNote({ children }) {
  return (
    <div className="flex items-start gap-3 rounded-md bg-brand-50 border border-brand-100 px-4 py-3.5 mb-5">
      <Icon name="info" className="w-[18px] h-[18px] text-brand-700 mt-0.5 shrink-0" />
      <p className="text-[13px] text-ink-700 leading-5">{children}</p>
    </div>
  )
}
