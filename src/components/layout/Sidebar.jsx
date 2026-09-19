import { NavLink } from 'react-router-dom'
import { Icon } from '../ui'
import { cx } from '../../lib/utils'
import { useAuth } from '../../context/AuthContext'

const NAV = {
  admin: [
    { to: '/', label: 'Home', icon: 'home', end: true },
    { to: '/users', label: 'Users', icon: 'users' },
    { to: '/courses', label: 'Courses', icon: 'book' },
    { to: '/course-store', label: 'Course store', icon: 'store' },
    { to: '/groups', label: 'Groups', icon: 'group' },
    { to: '/branches', label: 'Branches', icon: 'branch' },
    { to: '/notifications', label: 'Notifications', icon: 'bell' },
    { to: '/reports', label: 'Reports', icon: 'report' },
    { to: '/settings', label: 'Account & Settings', icon: 'settings' },
  ],
  instructor: [
    { to: '/', label: 'Home', icon: 'home', end: true },
    { to: '/courses', label: 'My courses', icon: 'book' },
    { to: '/learners', label: 'Learners', icon: 'users' },
    { to: '/grading', label: 'Grading', icon: 'clipboard' },
    { to: '/reports', label: 'Reports', icon: 'report' },
    { to: '/profile', label: 'My profile', icon: 'user' },
  ],
  learner: [
    { to: '/', label: 'Home', icon: 'home', end: true },
    { to: '/my-courses', label: 'My courses', icon: 'book' },
    { to: '/catalog', label: 'Course catalog', icon: 'store' },
    { to: '/certificates', label: 'Certificates', icon: 'certificate' },
    { to: '/profile', label: 'My profile', icon: 'user' },
  ],
}

export default function Sidebar({ collapsed, mobileOpen, onHelp }) {
  const { view } = useAuth()
  const items = NAV[view] || NAV.learner

  return (
    <aside
      className={cx(
        'bg-rail text-white flex flex-col z-30 w-[256px] shrink-0',
        'transition-transform duration-300 lg:transition-all',
        /* Off-canvas below lg, part of the layout from lg up. */
        'fixed inset-y-0 top-16 left-0 lg:static lg:top-0',
        mobileOpen ? 'translate-x-0 shadow-pop' : '-translate-x-full lg:translate-x-0',
        collapsed ? 'lg:w-[76px]' : 'lg:w-[256px]',
      )}
    >
      <nav className="flex-1 overflow-y-auto scroll-thin py-3 px-3 space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              cx(
                'relative flex items-center gap-3.5 h-12 rounded-md px-4 transition-colors',
                /* Collapsing only applies from lg up — the mobile drawer always shows labels. */
                collapsed && 'lg:justify-center lg:px-0',
                isActive
                  ? 'bg-rail-active text-white font-semibold'
                  : 'text-white hover:bg-rail-hover',
              )
            }
          >
            <Icon name={item.icon} className="w-[21px] h-[21px] shrink-0" strokeWidth={1.6} />
            <span className={cx('text-[14px] leading-[22px] truncate', collapsed && 'lg:hidden')}>
              {item.label}
            </span>
          </NavLink>
        ))}
      </nav>

      <div className="p-3">
        <button
          onClick={onHelp}
          className={cx(
            'w-full flex items-center gap-3.5 h-12 rounded-md px-4 bg-rail-hover hover:bg-rail-active transition-colors',
            collapsed && 'lg:justify-center lg:px-0',
          )}
        >
          <Icon name="help" className="w-[21px] h-[21px] shrink-0" strokeWidth={1.6} />
          <span className={cx('text-[14px] leading-[22px]', collapsed && 'lg:hidden')}>Help Center</span>
        </button>
      </div>
    </aside>
  )
}
