import { Button, Icon, Progress } from '../ui'
import { unitIcon, unitLabel } from './unitTypes'
import { cx } from '../../lib/utils'

/** Unit list with a progress summary, shared by the learner player and the public course page. */
export default function CourseOutline({ course, completedUnits, activeId, onSelect, lockedIds = [], showProgress = true }) {
  const contentUnits = course.units.filter((u) => u.type !== 'section')
  const done = contentUnits.filter((u) => completedUnits.includes(u.id)).length
  const progress = contentUnits.length ? Math.round((done / contentUnits.length) * 100) : 0

  return (
    <aside className="card">
      {showProgress && (
        <div className="p-5 border-b border-line">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] text-ink-500">Your progress</span>
            <span className="text-[13px] font-semibold">{progress}%</span>
          </div>
          <Progress value={progress} tone={progress === 100 ? 'green' : 'brand'} />
          <p className="hint mt-2.5">
            {done} of {contentUnits.length} units completed
          </p>
        </div>
      )}

      <ul className="py-2 max-h-[560px] overflow-y-auto scroll-thin">
        {course.units.map((unit) => {
          if (unit.type === 'section') {
            return (
              <li key={unit.id} className="px-5 pt-4 pb-2">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-500">{unit.name}</span>
              </li>
            )
          }
          const isDone = completedUnits.includes(unit.id)
          const locked = lockedIds.includes(unit.id)
          return (
            <li key={unit.id}>
              <button
                onClick={() => onSelect(unit.id)}
                disabled={locked}
                title={locked ? 'Complete the units before this one first' : undefined}
                className={cx(
                  'w-full flex items-center gap-3 px-5 py-3 text-left transition',
                  unit.id === activeId ? 'bg-brand-50' : locked ? 'opacity-55 cursor-not-allowed' : 'hover:bg-gray-50',
                )}
              >
                <span
                  className={cx(
                    'w-7 h-7 rounded-full flex items-center justify-center shrink-0',
                    isDone ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-ink-700',
                  )}
                >
                  <Icon name={isDone ? 'check' : locked ? 'lock' : unitIcon(unit.type)} className="w-3.5 h-3.5" strokeWidth={2.2} />
                </span>
                <span className="flex-1 min-w-0">
                  <span
                    className={cx(
                      'block text-[13.5px] truncate',
                      unit.id === activeId ? 'text-brand-700 font-medium' : 'text-ink-900',
                    )}
                  >
                    {unit.name}
                  </span>
                  <span className="block text-[11.5px] text-ink-500">{unitLabel(unit.type)}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}

/** Previous / next buttons under the open unit. */
export function UnitPager({ units, index, onSelect, nextLocked = false }) {
  return (
    <div className="flex justify-between gap-3 mt-8 pt-6 border-t border-line">
      <Button variant="ghost" icon="arrowLeft" disabled={index <= 0} onClick={() => onSelect(units[index - 1].id)}>
        Previous
      </Button>
      <Button
        variant="ghost"
        disabled={index >= units.length - 1 || nextLocked}
        title={nextLocked ? 'Complete this unit to open the next one' : undefined}
        onClick={() => onSelect(units[index + 1].id)}
      >
        Next unit
        <Icon name="arrowRight" className="w-[18px] h-[18px]" />
      </Button>
    </div>
  )
}
