import { cx } from '../../lib/utils'

const PALETTE = {
  cna: { tag: 'Nursing Assistant', accent: '#c9a227' },
  nclex: { tag: 'NCLEX Review', accent: '#5aa9e6' },
  compliance: { tag: 'Compliance', accent: '#4ade80' },
  default: { tag: 'GA Healthcare Training', accent: '#c9a227' },
}

/**
 * Course banner used in the builder preview, the catalog and the learner
 * course page — the same lockup GA uses on its program flyers.
 */
export default function CourseHero({ course, className, size = 'md', tags }) {
  const theme = PALETTE[course?.cover] || PALETTE.default
  const [first, ...rest] = (course?.name || 'New course').split(' ')
  const tail = rest.join(' ')

  return (
    <div
      className={cx(
        'relative overflow-hidden bg-navy-900 text-white',
        size === 'sm' ? 'p-5' : 'p-8',
        className,
      )}
      style={{ borderLeft: `4px solid ${theme.accent}` }}
    >
      <div className="absolute right-[-60px] top-[-60px] w-64 h-64 rounded-full border border-white/10" />
      <div className="absolute right-6 bottom-[-90px] w-56 h-56 rounded-full border border-white/10" />

      <div className="relative">
        <p
          className={cx('font-semibold tracking-tight leading-tight', size === 'sm' ? 'text-[19px]' : 'text-[30px]')}
        >
          {first}
        </p>
        {tail && (
          <p
            className={cx('font-semibold leading-tight inline-block', size === 'sm' ? 'text-[19px]' : 'text-[30px]')}
            style={{ color: theme.accent, borderBottom: `2px solid ${theme.accent}`, paddingBottom: 4 }}
          >
            {tail}
          </p>
        )}

        {course?.description && size !== 'sm' && (
          <p className="text-white/75 text-[13.5px] leading-6 max-w-xl mt-4 line-clamp-3">{course.description}</p>
        )}

        <div className="flex flex-wrap gap-2 mt-5">
          {(tags || defaultTags(course)).map((t) => (
            <span key={t} className="px-3.5 py-1.5 rounded-full border border-white/25 text-[11.5px] text-white/85">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function defaultTags(course) {
  const units = (course?.units || []).filter((u) => u.type !== 'section').length
  return [
    course?.level || 'All levels',
    `${units} unit${units === 1 ? '' : 's'}`,
    course?.certificate ? 'Certificate included' : 'No certificate',
  ]
}
