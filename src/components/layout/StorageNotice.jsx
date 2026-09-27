import { Link } from 'react-router-dom'
import { Icon } from '../ui'
import { useData } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { isAdmin } from '../../lib/permissions'
import { cx, plural } from '../../lib/utils'

/**
 * A slim bar above the page when the portal's data is not safely shared:
 * changes failing to save, no database connected on the live site, or data
 * still sitting in this browser from before the database was connected.
 */
export default function StorageNotice() {
  const { backend, syncProblem, localCopy } = useData()
  const { user } = useAuth()
  const admin = isAdmin(user)

  let tone = 'amber'
  let text = null
  let action = null

  if (backend.mode === 'server' && syncProblem) {
    tone = 'red'
    text = `Your latest changes have not been saved yet — ${syncProblem} Retrying…`
  } else if (admin && backend.mode === 'local' && backend.api) {
    text =
      'No shared database is connected, so accounts and changes are saved in this browser only. Students on other devices cannot sign in until one is connected in Vercel.'
  } else if (admin && localCopy) {
    text = `This browser still holds portal data from before the shared database (${plural(localCopy.users, 'user')}, ${plural(localCopy.courses, 'course')}).`
    action = { to: '/settings?tab=importexport', label: 'Move it to the shared database' }
  }

  if (!text) return null
  return (
    <div
      role="status"
      className={cx(
        'px-4 sm:px-6 lg:px-8 py-2.5 flex items-start gap-2.5 text-[13px] leading-5 border-b',
        tone === 'red' ? 'bg-red-50 border-red-100 text-red-800' : 'bg-amber-50 border-amber-100 text-amber-900',
      )}
    >
      <Icon name="alert" className="w-[18px] h-[18px] shrink-0" />
      <span className="flex-1">
        {text}{' '}
        {action && (
          <Link to={action.to} className="font-semibold underline">
            {action.label}
          </Link>
        )}
      </span>
    </div>
  )
}
