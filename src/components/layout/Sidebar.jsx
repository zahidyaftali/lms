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

export default function Sidebar({ collapsed, onHelp }) {
  const { view } = useAuth()
  const items = NAV[view] || NAV.learner

  return (
    <aside
      className={cx(
        'bg-rail text-white shrink-0 flex flex-col transition-all duration-200',
        collapsed ? 'w-[76px]' : 'w-[256px]',
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
                'relative flex items-center gap-3.5 h-12 rounded-md transition-colors',
                collapsed ? 'justify-center px-0' : 'px-4',
                isActive
                  ? 'bg-rail-active text-white font-semibold'
                  : 'text-white hover:bg-rail-hover',
              )
            }
          >
            <Icon name={item.icon} className="w-[21px] h-[21px] shrink-0" strokeWidth={1.6} />
            {!collapsed && <span className="text-[14px] leading-[22px] truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="p-3">
        <button
          onClick={onHelp}
          className={cx(
            'w-full flex items-center gap-3.5 h-12 rounded-md bg-rail-hover hover:bg-rail-active transition-colors',
            collapsed ? 'justify-center px-0' : 'px-4',
          )}
        >
          <Icon name="help" className="w-[21px] h-[21px] shrink-0" strokeWidth={1.6} />
          {!collapsed && <span className="text-[14px] leading-[22px]">Help Center</span>}
        </button>
      </div>
    </aside>
  )
}
