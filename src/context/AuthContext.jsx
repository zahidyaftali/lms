import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { loadSession, saveSession } from '../lib/storage'
import { useData } from './DataContext'
import { isAdmin } from '../lib/permissions'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const { users, actions, backend, me } = useData()
  const serverMode = backend.mode === 'server'
  const [session, setSession] = useState(() => loadSession())

  useEffect(() => {
    saveSession(session)
  }, [session])

  // With the shared database the server's session cookie says who is signed in;
  // the local session then only remembers which role an admin is previewing.
  const user = useMemo(() => {
    const id = serverMode ? me : session?.userId
    return users.find((u) => u.id === id) || null
  }, [users, session, me, serverMode])

  /** The role the portal is currently rendered as — admins can preview other roles. */
  const view = useMemo(() => {
    if (!user) return null
    if (session?.userId === user.id && session.view) return session.view
    return isAdmin(user) ? 'admin' : user.role
  }, [user, session])

  const login = useCallback(
    async (email, password) => {
      if (serverMode) {
        const result = await actions.signIn(email, password)
        if (result.ok) setSession({ userId: result.user.id, view: isAdmin(result.user) ? 'admin' : result.user.role })
        return result
      }
      const found = users.find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase())
      if (!found) return { ok: false, error: 'No account found for that email address.' }
      // A space picked up when pasting from an email should not lock anyone out.
      const given = String(password ?? '')
      if (found.password !== given && found.password !== given.trim())
        return { ok: false, error: 'Incorrect password. Please try again.' }
      if (!found.active)
        return { ok: false, error: 'This account is inactive. Contact your administrator.' }
      actions.updateUser(found.id, { lastLogin: new Date().toISOString() })
      actions.logEvent('login', 'signed in', found.id)
      setSession({ userId: found.id, view: isAdmin(found) ? 'admin' : found.role })
      return { ok: true, user: found }
    },
    [users, actions, serverMode],
  )

  const logout = useCallback(() => {
    setSession(null)
    if (serverMode) actions.signOut()
  }, [actions, serverMode])

  const setView = useCallback(
    (next) => setSession((prev) => (user ? { ...(prev || {}), userId: user.id, view: next } : prev)),
    [user],
  )

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
