import { useId } from 'react'
import { cx } from '../../lib/utils'

const BLUE = '#1a56db'
const GREEN = '#16a34a'

/**
 * Grouped bar chart used by the "Portal activity" widget — gridlines, integer
 * ticks and a two-line date label per group, as in the portal dashboard.
 */
export function ActivityChart({ data, series = [{ key: 'logins', label: 'Logins', color: BLUE }, { key: 'completions', label: 'Course completions', color: GREEN }], height = 230 }) {
  const id = useId()
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => d[s.key] || 0)))
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1]
  const width = 640
  const padLeft = 28
  const padBottom = 46
  const chartH = height - padBottom
  const chartW = width - padLeft
  const groupW = chartW / Math.max(1, data.length)
  const barW = Math.min(18, groupW / (series.length + 1.6))

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} role="img" aria-label="Portal activity">
        {ticks.map((t) => {
          const y = chartH - (t / top) * chartH
          return (
            <g key={t}>
              <line x1={padLeft} x2={width} y1={y} y2={y} stroke="#eef0f4" strokeWidth="1" />
              <text x={padLeft - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#9ca3af">
                {t}
              </text>
            </g>
          )
        })}
        <line x1={padLeft} x2={width} y1={chartH} y2={chartH} stroke="#e5e7eb" />

        {data.map((d, i) => {
          const groupX = padLeft + i * groupW
          return (
            <g key={`${id}-${i}`}>
              {series.map((s, j) => {
                const value = d[s.key] || 0
                const h = value === 0 ? 0 : Math.max(2, (value / top) * chartH)
                const x = groupX + groupW / 2 - (series.length * barW) / 2 + j * barW
                return (
                  <rect
                    key={s.key}
                    x={x}
                    y={chartH - h}
                    width={barW}
                    height={h}
                    fill={s.color}
                    rx="1"
                  >
                    <title>{`${d.label}: ${value} ${s.label.toLowerCase()}`}</title>
                  </rect>
                )
              })}
              {d.label && (
                <>
                  <text x={groupX + groupW / 2} y={chartH + 18} textAnchor="middle" fontSize="11.5" fill="#6b7280">
                    {d.label}
                  </text>
                  <text x={groupX + groupW / 2} y={chartH + 33} textAnchor="middle" fontSize="11.5" fill="#9ca3af">
                    {d.sublabel}
                  </text>
                </>
              )}
            </g>
          )
        })}
      </svg>
      <div className="flex items-center gap-6 mt-1">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-2 text-[12.5px] text-ink-700">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export function DonutChart({ segments, size = 168, thickness = 22, centerLabel, centerValue }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <div className="flex items-center gap-7 flex-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#eef0f4" strokeWidth={thickness} />
          {total > 0 &&
            segments.map((s) => {
              const length = (s.value / total) * circumference
              const dash = `${length} ${circumference - length}`
              const circle = (
                <circle
                  key={s.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={thickness}
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                />
              )
              offset += length
              return circle
            })}
        </g>
        <text x="50%" y="47%" textAnchor="middle" fontSize="24" fontWeight="600" fill="#111827">
          {centerValue}
        </text>
        <text x="50%" y="62%" textAnchor="middle" fontSize="11.5" fill="#6b7280">
          {centerLabel}
        </text>
      </svg>
      <ul className="space-y-2.5">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2.5 text-[13.5px] text-ink-700">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
            <span className="flex-1">{s.label}</span>
            <span className="font-semibold text-ink-900 ml-3">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function MiniBars({ data, className }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <ul className={cx('space-y-3.5', className)}>
      {data.map((d) => (
        <li key={d.label}>
          <div className="flex justify-between text-[13px] mb-1.5">
            <span className="text-ink-700 truncate pr-3">{d.label}</span>
            <span className="font-medium text-ink-900">{d.display ?? d.value}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-brand-700 rounded-full" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function niceTicks(max) {
  const step = max <= 4 ? 1 : max <= 10 ? 2 : Math.ceil(max / 5)
  const top = Math.ceil(max / step) * step
  const out = []
  for (let v = 0; v <= top; v += step) out.push(v)
  return out
}
