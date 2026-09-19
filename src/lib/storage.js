const KEY = 'ga_lms_state_v1'
const SESSION_KEY = 'ga_lms_session_v1'

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch (err) {
    // Quota is the realistic failure here: large media lives in IndexedDB, not this store.
    console.warn('Could not persist portal state', err)
  }
}

export function clearState() {
  localStorage.removeItem(KEY)
  localStorage.removeItem(SESSION_KEY)
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveSession(session) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  else localStorage.removeItem(SESSION_KEY)
}
