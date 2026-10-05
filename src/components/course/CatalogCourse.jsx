import { useState } from 'react'
import { Icon } from '../ui'
import CourseHero from './CourseHero'
import { hasIntroVideo } from './IntroVideo'
import { contentUnits } from '../../lib/rules.js'
import { copyText, cx, formatDate, plainText, plural } from '../../lib/utils'

/** Average rating and number of ratings for one course. */
export function ratingOf(ratings = [], courseId) {
  const mine = ratings.filter((r) => r.courseId === courseId)
  if (!mine.length) return { average: 0, count: 0 }
  return { average: mine.reduce((sum, r) => sum + Number(r.stars || 0), 0) / mine.length, count: mine.length }
}

export function Stars({ value = 0, size = 'w-4 h-4', onChange }) {
  return (
    <span className="inline-flex items-center gap-0.5" role={onChange ? 'radiogroup' : 'img'} aria-label={`${Math.round(value * 10) / 10} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const star = <Icon name="star" className={cx(size, n <= Math.round(value) ? 'text-gold-500' : 'text-gray-300')} fill={n <= Math.round(value) ? 'currentColor' : 'none'} />
        return onChange ? (
          <button key={n} type="button" onClick={() => onChange(n)} aria-label={plural(n, 'star')} className="p-0.5">
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        )
      })}
    </span>
  )
}

/** Share buttons shown when Account & Settings → Courses → Social sharing is on. */
export function ShareButtons({ url, text, className }) {
  const [copied, setCopied] = useState(false)
  const u = encodeURIComponent(url)
  const t = encodeURIComponent(text)
  const links = [
    ['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${u}`],
    ['LinkedIn', `https://www.linkedin.com/sharing/share-offsite/?url=${u}`],
    ['X', `https://twitter.com/intent/tweet?url=${u}&text=${t}`],
  ]
  return (
    <span className={cx('inline-flex flex-wrap items-center gap-1.5 text-[12.5px]', className)}>
      <Icon name="share" className="w-4 h-4 text-ink-500" />
      {links.map(([label, href]) => (
        <a key={label} href={href} target="_blank" rel="noreferrer" className="px-2 py-1 rounded border border-line text-ink-700 hover:bg-gray-50">
          {label}
        </a>
      ))}
      <button
        type="button"
        onClick={async () => {
          setCopied(await copyText(url))
          setTimeout(() => setCopied(false), 2000)
        }}
        className="px-2 py-1 rounded border border-line text-ink-700 hover:bg-gray-50"
      >
        {copied ? 'Copied' : 'Copy link'}
      </button>
    </span>
  )
}

export function runsLabel(course) {
  const from = course.startDate ? formatDate(course.startDate) : null
  const to = course.endDate ? formatDate(course.endDate) : null
  if (from && to) return `Runs ${from} – ${to}`
  return from ? `Opens ${from}` : `Open until ${to}`
}

/**
 * One course in a catalog, as a card or as a row of the list layout.
 * `priceLabel` is the price as text; `children` is the action (Enroll, Buy, Sign in …).
 */
export default function CatalogCourse({ course, layout = 'Cards', rating, priceLabel, was, onPreview, share, children }) {
  const list = layout === 'List'
  const units = contentUnits(course).length
  const meta = (
    <>
      {rating?.count > 0 && (
        <p className="flex items-center gap-2 mb-2 text-[12.5px] text-ink-500">
          <Stars value={rating.average} />
          {rating.average.toFixed(1)} ({rating.count})
        </p>
      )}
      <p className={cx('hint mb-4', list ? 'line-clamp-2' : 'line-clamp-3')}>{plainText(course.description)}</p>
      {course.timeMode === 'timeframe' && (course.startDate || course.endDate) && (
        <p className="hint -mt-2 mb-4 flex items-center gap-1.5">
          <Icon name="calendar" className="w-4 h-4 shrink-0" />
          {runsLabel(course)}
        </p>
      )}
      {share && <div className="mb-4">{share}</div>}
    </>
  )
  const priceRow = (
    <div className={cx('flex items-center justify-between gap-3', list ? 'sm:flex-col sm:items-end sm:justify-center sm:min-w-[170px]' : 'mt-auto')}>
      <span className="text-[15px] font-semibold whitespace-nowrap">
        {was && <span className="text-ink-400 font-normal line-through mr-2">{was}</span>}
        {priceLabel}
      </span>
      {children}
    </div>
  )
  const play = hasIntroVideo(course.introVideo) && onPreview && (
    <button
      onClick={onPreview}
      aria-label={`Watch the introduction to ${course.name}`}
      title="Watch intro video"
      className="absolute top-3.5 right-3.5 w-10 h-10 rounded-full bg-white/15 text-white border border-white/25 flex items-center justify-center hover:bg-white/25 transition"
    >
      <Icon name="play" className="w-4 h-4 ml-0.5" fill="currentColor" />
    </button>
  )

  if (list) {
    return (
      <article className="card overflow-hidden flex flex-col sm:flex-row">
        <div className="relative sm:w-[230px] shrink-0">
          <CourseHero course={course} size="sm" tags={[course.level]} className="h-full" />
          {play}
        </div>
        <div className="p-5 flex-1 min-w-0 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-[15.5px] font-semibold leading-6 mb-1">{course.name}</h3>
            <p className="text-[12.5px] text-ink-500 mb-2">{plural(units, 'unit')}</p>
            {meta}
          </div>
          {priceRow}
        </div>
      </article>
    )
  }

  return (
    <article className="card card-interactive overflow-hidden flex flex-col relative">
      <CourseHero course={course} size="sm" tags={[course.level]} />
      {play}
      <div className="p-5 flex-1 flex flex-col">
        <h3 className="text-[15.5px] font-semibold leading-6 mb-2">{course.name}</h3>
        {meta}
        {priceRow}
      </div>
    </article>
  )
}
