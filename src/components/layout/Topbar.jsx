import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Icon, MenuDivider, MenuItem } from '../ui'
import Logo from './Logo'
import { cx, shortName } from '../../lib/utils'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import { switchableRoles, VIEW_LABEL } from '../../lib/permissions'

export default function Topbar({ onToggleSidebar }) {
  const navigate = useNavigate()
  const { user, view, setView, logout } = useAuth()
  const { users, courses, messages } = useData()
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [resultsOpen, setResultsOpen] = useState(false)
  const menuRef = useRef(null)
  const searchRef = useRef(null)

  const unread = messages.filter((m) => m.toId === user?.id && !m.read).length

  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
      if (searchRef.current && !searchRef.current.contains(e.target)) setResultsOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return { users: [], courses: [] }
    const canSeeUsers = view === 'admin'
    return {
      users: canSeeUsers
        ? users
            .filter((u) => `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q))
            .slice(0, 4)
        : [],
      courses: courses.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 4),
    }
  }, [query, users, courses, view])

  const goto = (path) => {
    setQuery('')
    setResultsOpen(false)
    navigate(path)
  }

  const roles = switchableRoles(user)

  return (
    <header className="h-16 lg:h-[72px] shrink-0 bg-white border-b border-line flex items-center gap-2 sm:gap-4 px-3 sm:px-5 relative z-40">
      <button
        onClick={onToggleSidebar}
        className="p-2 -ml-1 rounded text-navy-900 hover:bg-gray-100 shrink-0"
        aria-label="Toggle navigation"
      >
        <Icon name="menu" className="w-6 h-6" strokeWidth={1.8} />
      </button>

      <button onClick={() => navigate('/')} className="shrink-0 hidden sm:block">
        <Logo />
      </button>
      <button onClick={() => navigate('/')} className="shrink-0 sm:hidden">
        <Logo boxed={false} size="sm" />
      </button>

      <div className="flex-1 flex justify-center px-1 sm:px-4 min-w-0" ref={searchRef}>
        <div className="relative w-full max-w-[430px] min-w-0">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setResultsOpen(true)
            }}
            onFocus={() => setResultsOpen(true)}
            placeholder="Search"
            className="field h-10 lg:h-11 pr-11 italic placeholder:italic placeholder:text-ink-500"
          />
          <Icon name="search" className="w-[19px] h-[19px] absolute right-3.5 top-1/2 -translate-y-1/2 text-navy-900" />

          {resultsOpen && query.trim().length >= 2 && (
            <div className="absolute left-0 right-0 top-[50px] bg-white border border-line rounded-md shadow-pop py-2 animate-scale-in origin-top max-h-[360px] overflow-y-auto scroll-thin z-50">
              {results.users.length === 0 && results.courses.length === 0 && (
                <p className="px-4 py-3 text-[13.5px] text-ink-500">No matches for “{query}”.</p>
              )}
              {results.users.length > 0 && (
                <>
                  <p className="px-4 py-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-ink-400">Users</p>
                  {results.users.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => goto(`/users/${u.id}`)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left"
                    >
                      <Avatar user={u} size={28} />
                      <span className="text-[13.5px]">
                        {shortName(u)}
                        <span className="text-ink-500"> · {u.email}</span>
                      </span>
                    </button>
                  ))}
                </>
              )}
              {results.courses.length > 0 && (
                <>
                  <p className="px-4 py-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-ink-400">Courses</p>
                  {results.courses.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => goto(view === 'learner' ? `/my-courses/${c.id}` : `/courses/${c.id}`)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left"
                    >
                      <Icon name="book" className="w-[18px] h-[18px] text-ink-700" />
                      <span className="text-[13.5px]">{c.name}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => navigate('/messages')}
        className="relative p-2 rounded text-navy-900 hover:bg-gray-100 shrink-0 transition-colors"
        aria-label="Messages"
      >
        <Icon name="mail" className="w-[22px] h-[22px]" strokeWidth={1.5} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white" />
        )}
      </button>

      <div className="relative shrink-0" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className={cx(
            'flex items-center gap-3 pl-2 sm:pl-3 pr-1 sm:pr-2 py-1.5 rounded-md transition-colors',
            menuOpen ? 'bg-brand-50' : 'hover:bg-gray-50',
          )}
        >
          <span className="text-right leading-tight hidden md:block">
            <span className="block text-[14px] font-semibold text-ink-900">{shortName(user)}</span>
            <span className="block text-[12px] text-ink-500">{VIEW_LABEL[view] || 'Learner'}</span>
          </span>
          <Avatar user={user} size={36} />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-[54px] w-[248px] bg-white border border-line rounded-md shadow-pop py-2 animate-scale-in origin-top-right">
            {roles.length > 1 && (
              <>
                <p className="px-4 py-2 text-[13px] font-semibold text-ink-900">Switch role</p>
                {roles.map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      setView(r)
                      setMenuOpen(false)
                      navigate('/')
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left"
                  >
                    <span
                      className={cx(
                        'w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center',
                        view === r ? 'border-brand-700' : 'border-gray-400',
                      )}
                    >
                      {view === r && <span className="w-2.5 h-2.5 rounded-full bg-brand-700" />}
                    </span>
                    <span className="text-[13.5px]">{VIEW_LABEL[r]}</span>
                  </button>
                ))}
                <MenuDivider />
              </>
            )}
            <MenuItem
              icon="user"
              onClick={() => {
                setMenuOpen(false)
                navigate('/profile')
              }}
            >
              My profile
            </MenuItem>
            <MenuDivider />
            <MenuItem
              icon="logout"
              onClick={() => {
                logout()
                navigate('/login')
              }}
            >
              Log out
            </MenuItem>
          </div>
        )}
      </div>
    </header>
  )
}
