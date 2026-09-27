import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, DataTable, EmptyState, SearchInput, Select } from '../../components/ui'
import { useData } from '../../context/DataContext'
import { auditVerb } from '../../lib/audit'
import { download, formatDateTime, toCSV } from '../../lib/utils'

const FILTERS = [
  { value: '', label: 'All activity' },
  { value: 'user.', label: 'Users' },
  { value: 'user.password', label: 'Passwords' },
  { value: 'course.', label: 'Courses' },
  { value: 'settings.', label: 'Settings' },
]

const TONES = { create: 'green', delete: 'red', password: 'amber', update: 'blue' }

/** Account & Settings → History: who changed users, passwords, courses and settings. Admins only. */
export default function SettingsHistory() {
  const { auditLog = [], backend, actions } = useData()
  const [filter, setFilter] = useState('')
  const [query, setQuery] = useState('')

  // Entries are written by the server, so fetch the latest when the tab opens.
  useEffect(() => {
    if (backend.mode === 'server') actions.reload({ background: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return auditLog.filter((e) => {
      if (filter && !e.action.startsWith(filter)) return false
      if (q && !`${e.actorName} ${e.targetName} ${e.note} ${e.changes.join(' ')}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [auditLog, filter, query])

  const describe = (e) =>
    e.action === 'settings.update'
      ? 'Changed portal settings'
      : `${auditVerb(e.action)} ${e.targetName}${e.action === 'user.password' && e.note ? ` (${e.note})` : ''}`
  const detail = (e) => (e.changes.length ? e.changes.join(', ') : e.action === 'user.password' ? '' : e.note)

  const columns = [
    {
      key: 'at',
      label: 'When',
      width: 180,
      render: (e) => <span className="whitespace-nowrap text-ink-700">{formatDateTime(e.at)}</span>,
    },
    { key: 'actorName', label: 'Who', width: 170 },
    {
      key: 'action',
      label: 'What',
      sortValue: (e) => describe(e),
      render: (e) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone={TONES[e.action.split('.')[1]] || 'gray'}>{e.action.split('.')[0]}</Badge>
            <span className="text-ink-900">{describe(e)}</span>
          </div>
          {detail(e) && <p className="hint mt-1">{detail(e)}</p>}
        </div>
      ),
    },
  ]

  return (
    <>
      <p className="hint -mt-4 mb-6 max-w-2xl">
        Every account, password, course and settings change, with who made it. Passwords themselves are never
        recorded. Edits to the same thing by the same person within ten minutes are grouped into one line.
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <SearchInput value={query} onChange={setQuery} placeholder="Search people or courses" className="w-[260px]" />
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-[180px]" aria-label="Filter">
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
        <span className="flex-1" />
        {backend.mode === 'server' && (
          <Button variant="ghost" icon="refresh" onClick={() => actions.reload({ background: true })}>
            Refresh
          </Button>
        )}
        <Button
          variant="ghost"
          icon="download"
          disabled={!rows.length}
          onClick={() =>
            download(
              'ga-portal-history.csv',
              toCSV(rows, [
                { label: 'When', value: (e) => formatDateTime(e.at) },
                { label: 'Who', value: (e) => e.actorName },
                { label: 'What', value: describe },
                { label: 'Details', value: detail },
              ]),
            )
          }
        >
          Export
        </Button>
      </div>

      <div className="card overflow-hidden">
        <DataTable
          columns={columns}
          rows={rows}
          defaultSort={{ key: 'at', dir: 'desc' }}
          empty={
            <EmptyState
              icon="clock"
              title={auditLog.length ? 'Nothing matches' : 'No changes recorded yet'}
              message={
                auditLog.length
                  ? 'Try another search or filter.'
                  : 'Creating, editing or deleting users and courses, setting passwords and changing settings will show up here.'
              }
            />
          }
        />
      </div>
    </>
  )
}
