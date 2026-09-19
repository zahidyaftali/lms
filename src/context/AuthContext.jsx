import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { loadSession, saveSession } from '../lib/storage'
import { useData } from './DataContext'
import { isAdmin } from '../lib/permissions'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const { users, actions } = useData()
  const [session, setSession] = useState(() => loadSession())

  useEffect(() => {
    saveSession(session)
  }, [session])

  const user = useMemo(() => users.find((u) => u.id === session?.userId) || null, [users, session])

  /** The role the portal is currently rendered as — admins can preview other roles. */
  const view = useMemo(() => {
    if (!user) return null
    if (!session?.view) return isAdmin(user) ? 'admin' : user.role
    return session.view
  }, [user, session])

  const login = useCallback(
    (email, password) => {
      const found = users.find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase())
      if (!found) return { ok: false, error: 'No account found for that email address.' }
      if (found.password !== password) return { ok: false, error: 'Incorrect password. Please try again.' }
      if (!found.active)
        return { ok: false, error: 'This account is inactive. Contact your administrator.' }
      actions.updateUser(found.id, { lastLogin: new Date().toISOString() })
      actions.logEvent('login', 'signed in', found.id)
      setSession({ userId: found.id, view: isAdmin(found) ? 'admin' : found.role })
      return { ok: true, user: found }
    },
    [users, actions],
  )

  const logout = useCallback(() => setSession(null), [])

  const setView = useCallback((next) => setSession((prev) => (prev ? { ...prev, view: next } : prev)), [])

  const value = useMemo(
    () => ({ user, view, login, logout, setView, isAuthenticated: !!user }),
    [user, view, login, logout, setView],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
