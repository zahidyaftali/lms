/**
 * When the person at this device last did something. The session timeout in
 * Account & Settings → Security signs people out after a stretch without it.
 */
const state = { last: Date.now() }

export const touchActivity = () => {
  state.last = Date.now()
}

export const idleFor = () => Date.now() - state.last

let watching = false

/** Starts listening once; safe to call from more than one place. */
export function watchActivity() {
  if (watching || typeof window === 'undefined') return
  watching = true
  let lastMove = 0
  const move = () => {
    const now = Date.now()
    if (now - lastMove > 5000) {
      lastMove = now
      state.last = now
    }
  }
  for (const type of ['mousedown', 'keydown', 'touchstart', 'wheel']) window.addEventListener(type, touchActivity, { passive: true, capture: true })
  window.addEventListener('mousemove', move, { passive: true })
  window.addEventListener('scroll', move, { passive: true, capture: true })
  // A lesson video that is playing counts: "timeupdate" does not bubble, so it is caught on the way down.
  document.addEventListener('timeupdate', move, true)
  // Working inside an embedded lesson (a YouTube player, a SCORM package) sends no events to this page.
  setInterval(() => {
    if (document.visibilityState === 'visible' && document.activeElement?.tagName === 'IFRAME') state.last = Date.now()
  }, 20000)
}
