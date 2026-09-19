export const uid = (prefix = 'id') =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

export const cx = (...parts) => parts.filter(Boolean).join(' ')

export function initials(user) {
  if (!user) return '?'
  const a = (user.firstName || '').trim()
  const b = (user.lastName || '').trim()
  return ((a[0] || '') + (b[0] || '')).toUpperCase() || (user.email || '?')[0].toUpperCase()
}

export function fullName(user) {
  if (!user) return 'Unknown user'
  return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email
}

/** "A. Goodrigge" style short name used across list views. */
export function shortName(user) {
  if (!user) return 'Unknown'
  const f = (user.firstName || '').trim()
  const l = (user.lastName || '').trim()
  if (!l) return f || user.email
  return `${f ? f[0] + '.' : ''} ${l}`.trim()
}

export function formatDate(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
}

export function formatDateTime(value) {
  if (!value) return '-'
  const d = new Date(value)
  return `${formatDate(value)}, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

/** Relative time, matching the "16 hours ago / Just now" style of the timeline. */
export function timeAgo(value) {
  if (!value) return '-'
  const diff = Date.now() - new Date(value).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'Just now'
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  return formatDate(value)
}

export function money(value) {
  if (value == null || value === '' || Number(value) === 0) return '-'
  return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function duration(minutes) {
  const m = Math.max(0, Math.round(minutes || 0))
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

export function fileSize(bytes) {
  if (!bytes) return '0 KB'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let v = bytes
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function randomPassword(length = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export function daysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString()
}

export function hoursAgo(n) {
  return new Date(Date.now() - n * 3600000).toISOString()
}

export function download(filename, content, type = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function toCSV(rows, columns) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const head = columns.map((c) => esc(c.label)).join(',')
  const body = rows.map((r) => columns.map((c) => esc(c.value(r))).join(',')).join('\n')
  return `${head}\n${body}`
}
