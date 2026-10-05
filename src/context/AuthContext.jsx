import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { loadSession, saveSession } from '../lib/storage'
import { useData } from './DataContext'
import { isAdmin } from '../lib/permissions'
import { needsTerms, passwordExpired, termsVersion } from '../lib/rules.js'
import { idleFor, touchActivity, watchActivity } from '../lib/activity'

const AuthContext = createContext(null)
const LOCK_KEY = 'ga_lms_lock_v1'

/** Failed sign-ins per email, for the lockout rule when there is no server to count them. */
function readLocks() {
  try {
    return JSON.parse(localStorage.getItem(LOCK_KEY)) || {}
  } catch {
    return {}
  }
}
function writeLocks(locks) {
  try {
    localStorage.setItem(LOCK_KEY, JSON.stringify(locks))
  } catch {
    // Without storage the lockout simply does not apply.
  }
}

export function AuthProvider({ children }) {
  const data = useData()
  const { users, actions, backend, me, settings } = data
  const serverMode = backend.mode === 'server'
  const [session, setSession] = useState(() => loadSession())
  const [reason, setReason] = useState('')

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

  /**
   * What stands between a signed-in user and the portal: two-factor set-up, a
   * new password, the terms of service. The server decides when there is one.
   */
  const gate = useMemo(() => {
    if (!user) return null
    if (serverMode) return data.gate
    const g = {}
    if (user.mustChangePassword) g.password = 'first'
    else if (passwordExpired(user.passwordChangedAt, settings)) g.password = 'expired'
    if (needsTerms(user, settings)) g.terms = termsVersion(settings.users.terms)
    return Object.keys(g).length ? g : null
  }, [user, serverMode, data.gate, settings])

  const started = (signedIn) => {
    setReason('')
    touchActivity()
    setSession({ userId: signedIn.id, view: isAdmin(signedIn) ? 'admin' : signedIn.role })
  }

  /** Returns { ok, user } — or { twoFactor: true, ticket } when a code from the authenticator app is needed next. */
  const login = useCallback(
    async (email, password) => {
      if (serverMode) {
        const result = await actions.signIn({ email, password })
        if (result.ok) started(result.user)
        return result
      }
      const key = String(email).trim().toLowerCase()
      const found = users.find((u) => u.email.toLowerCase() === key)
      if (!found) return { ok: false, error: 'No account found for that email address.' }

      const limit = Number(settings.security?.loginAttempts) || 0
      const lockFor = Math.max(1, Number(settings.security?.lockoutMinutes) || 15)
      const locks = readLocks()
      const lock = locks[key] || {}
      if (lock.until && lock.until > Date.now())
        return { ok: false, error: `This account is locked after too many failed attempts. Try again in ${Math.ceil((lock.until - Date.now()) / 60000)} minutes.` }

      // A space picked up when pasting from an email should not lock anyone out.
      const given = String(password ?? '')
      if (found.password !== given && found.password !== given.trim()) {
        const fails = (lock.fails || 0) + 1
        if (limit > 0 && fails >= limit) {
          writeLocks({ ...locks, [key]: { fails: 0, until: Date.now() + lockFor * 60000 } })
          return { ok: false, error: `Too many failed attempts. This account is locked for ${lockFor} minutes.` }
        }
        writeLocks({ ...locks, [key]: { fails } })
        const left = limit > 0 ? ` ${limit - fails} attempt${limit - fails === 1 ? '' : 's'} left.` : ''
        return { ok: false, error: `Incorrect password. Please try again.${left}` }
      }
      if (!found.active)
        return { ok: false, error: found.pending ? 'Your account is waiting for an administrator to activate it.' : 'This account is inactive. Contact your administrator.' }

      delete locks[key]
      writeLocks(locks)
      const now = new Date().toISOString()
      actions.updateUser(found.id, {
        lastLogin: now,
        loginCount: (Number(found.loginCount) || 0) + 1,
        passwordChangedAt: found.passwordChangedAt || now,
      })
      actions.logEvent('login', 'signed in', found.id)
      started(found)
      return { ok: true, user: found }
    },
    [users, actions, serverMode, settings],
  )

  /** Second step of signing in with two-factor authentication. */
  const loginWithCode = useCallback(
    async (ticket, code) => {
      const result = await actions.signIn({ ticket, code })
      if (result.ok) started(result.user)
      return result
    },
    [actions],
  )

  const logout = useCallback(() => {
    setSession(null)
    if (serverMode) actions.signOut()
  }, [actions, serverMode])

  // Account & Settings → Security → Session timeout.
  const timeout = Number(settings.security?.sessionTimeout) || 0
  const userId = user?.id
  useEffect(() => {
    if (!userId) return undefined
    watchActivity()
    touchActivity()
    if (!timeout) return undefined
    const timer = setInterval(() => {
      if (idleFor() < timeout * 60000) return
      setReason(`You were signed out after ${timeout} minutes without activity.`)
      logout()
    }, 15000)
    return () => clearInterval(timer)
  }, [userId, timeout, logout])

  const setView = useCallback(
    (next) => setSession((prev) => (user ? { ...(prev || {}), userId: user.id, view: next } : prev)),
    [user],
  )

  const value = useMemo(
    () => ({
      user,
      view,
      gate,
      login,
      loginWithCode,
      logout,
      setView,
      isAuthenticated: !!user,
      signedOutReason: reason || data.signedOutReason,
    }),
    [user, view, gate, login, loginWithCode, logout, setView, reason, data.signedOutReason],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
