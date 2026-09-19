import { useData } from '../../context/DataContext'
import { cx } from '../../lib/utils'

/**
 * Portal wordmark. Falls back to the built-in GA Healthcare lockup when no
 * logo file has been uploaded in Account & Settings.
 */
export default function Logo({ className, boxed = true, size = 'md', inverted = false }) {
  const { settings } = useData()

  const inner = settings.logo ? (
    <img src={settings.logo} alt={settings.siteName} className={size === 'sm' ? 'h-8' : 'h-11'} />
  ) : (
    <span className="flex items-center gap-2.5">
      <Emblem size={size === 'sm' ? 24 : 30} />
      <span className="leading-none">
        <span
          className={cx(
            'block font-bold tracking-tight',
            size === 'sm' ? 'text-[15px]' : 'text-[19px]',
            inverted ? 'text-white' : 'text-navy-900',
          )}
        >
          GA HEALTHCARE
        </span>
        <span
          className={cx(
            'block font-semibold tracking-[0.18em] mt-0.5',
            size === 'sm' ? 'text-[7px]' : 'text-[8.5px]',
            inverted ? 'text-gold-400' : 'text-gold-500',
          )}
        >
          TRAINING &amp; CONSULTING
        </span>
      </span>
    </span>
  )

  if (!boxed) return <span className={className}>{inner}</span>

  return (
    <span
      className={cx(
        'inline-flex items-center rounded-md border px-3.5 py-1.5',
        inverted ? 'border-white/25' : 'border-line',
        className,
      )}
    >
      {inner}
    </span>
  )
}

function Emblem({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="shrink-0">
      <rect x="1.5" y="1.5" width="37" height="37" rx="5" fill="#012053" stroke="#c9a227" strokeWidth="2" />
      <path d="M20 9c5 4 9 5 11 5 0 8-3 13-11 17C12 27 9 22 9 14c2 0 6-1 11-5Z" fill="#0f3c8c" />
      <path d="M20 13v10M15 18h10" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}
