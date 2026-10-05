import { CURRENCIES } from './commerce.js'
import { displayName } from './rules.js'

export const uid = (prefix = 'id') =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

export const cx = (...parts) => parts.filter(Boolean).join(' ')

export function initials(user) {
  if (!user) return '?'
  const a = (user.firstName || '').trim()
  const b = (user.lastName || '').trim()
  return ((a[0] || '') + (b[0] || '')).toUpperCase() || (user.email || '?')[0].toUpperCase()
}

const ZONES = [
  ['Eastern', 'America/New_York'],
  ['Central', 'America/Chicago'],
  ['Mountain', 'America/Denver'],
  ['Pacific', 'America/Los_Angeles'],
  ['Alaska', 'America/Anchorage'],
  ['Hawaii', 'Pacific/Honolulu'],
  ['Atlantic', 'America/Halifax'],
  ['UTC', 'UTC'],
]

/**
 * How dates, money and names are written, taken from Account & Settings →
 * Portal and Users. Set whenever the portal's settings load or change.
 */
const locale = { dateFormat: 'DD/MM/YYYY', timeZone: undefined, currency: 'USD', nameFormat: 'First name and last name' }

export function configureLocale(settings) {
  locale.dateFormat = settings?.dateFormat === 'MM/DD/YYYY' ? 'MM/DD/YYYY' : 'DD/MM/YYYY'
  locale.timeZone = ZONES.find(([label]) => String(settings?.timezone || '').includes(label))?.[1]
  locale.currency = CURRENCIES[settings?.currency] || 'USD'
  locale.nameFormat = settings?.users?.nameFormat || 'First name and last name'
}

export function fullName(user) {
  return displayName(user, locale.nameFormat)
}

/** "A. Goodrigge" style short name used across list views. */
export function shortName(user) {
  if (!user) return 'Unknown'
  if (locale.nameFormat === 'Email address') return user.email || 'Unknown'
  const f = (user.firstName || '').trim()
  const l = (user.lastName || '').trim()
  if (!l) return f || user.email
  return `${f ? f[0] + '.' : ''} ${l}`.trim()
}

function dateParts(d, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(d)
    const get = (type) => parts.find((p) => p.type === type)?.value
    return { day: get('day'), month: get('month'), year: get('year') }
  } catch {
    const p = (n) => String(n).padStart(2, '0')
    return { day: p(d.getDate()), month: p(d.getMonth() + 1), year: String(d.getFullYear()) }
  }
}

const arrange = ({ day, month, year }) =>
  locale.dateFormat === 'MM/DD/YYYY' ? `${month}/${day}/${year}` : `${day}/${month}/${year}`

/** A moment in time, shown in the portal's time zone and date format. */
export function formatDate(value) {
  if (!value) return '-'
  // A calendar day ("2026-10-01") has no time zone: it is written as it stands.
  const day = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})-(\d{2})(T00:00)?$/)
  if (day) return arrange({ year: day[1], month: day[2], day: day[3] })
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return arrange(dateParts(d, locale.timeZone))
}

/** A day worked out on this device's clock (course start and end dates), in the portal's date format. */
export function formatDay(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return arrange(dateParts(d, undefined))
}

export function formatDateTime(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  let time
  try {
    time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: locale.timeZone })
  } catch {
    time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return `${formatDate(value)}, ${time}`
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

/** An amount in the portal's currency. */
export function price(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: locale.currency }).format(Number(value) || 0)
}

/** Like `price`, but nothing to charge shows as a dash. */
export function money(value) {
  if (value == null || value === '' || Number(value) === 0) return '-'
  return price(value)
}

export const currencySymbol = () => price(0).replace(/[\d.,\s]/g, '')

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
  // Always holds an uppercase letter, a lowercase letter and a number, so it passes the strong-password rule.
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789']
  const all = sets.join('')
  const pick = (chars) => chars[Math.floor(Math.random() * chars.length)]
  const out = sets.map(pick)
  while (out.length < Math.max(length, sets.length)) out.push(pick(all))
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out.join('')
}

/**
 * Copies text and reports whether it worked. The Clipboard API only exists on
 * HTTPS and localhost, so plain-HTTP deployments fall back to a hidden textarea.
 */
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the textarea route
  }
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  area.remove()
  return ok
}

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

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
