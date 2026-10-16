/**
 * The portal's service worker. It does two jobs for course packages and nothing else:
 *
 * 1. /scorm/<packageId>/<path>: serves a package's files from this browser's cache
 *    (packages stored without the shared database), or passes the request on to the
 *    server (packages stored in the database).
 * 2. /xapi/*: a small Learning Record Store for xAPI and cmi5 packages. Statements are
 *    handed to the open portal pages, which record progress; state documents are kept
 *    in this browser so a learner can resume where they stopped.
 */
const PACKAGES = 'lms-packages-v1'
const XAPI = 'lms-xapi-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/scorm/')) event.respondWith(packageFile(event.request, url))
  else if (url.pathname.startsWith('/xapi/')) event.respondWith(lrs(event.request, url))
})

async function packageFile(request, url) {
  const cache = await caches.open(PACKAGES)
  const hit = await cache.match(url.origin + url.pathname)
  if (hit) return hit
  return fetch(request)
}

/* ------------------------------------------------------------------- xAPI */

const json = (body, status = 200) =>
  new Response(body == null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Experience-API-Version': '1.0.3' },
  })
const empty = (status = 204) => new Response(null, { status, headers: { 'X-Experience-API-Version': '1.0.3' } })

const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })

async function tell(message) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  clients.forEach((c) => c.postMessage(message))
}

/** Documents (activity state, profiles) live under a key made of the parameters that identify them. */
function documentKey(url) {
  const p = url.searchParams
  const parts = ['stateId', 'profileId', 'activityId', 'registration', 'agent'].map((k) => `${k}=${p.get(k) || ''}`)
  return `${url.origin}/xapi-doc${url.pathname}?${parts.join('&')}`
}

async function body(request, url) {
  // Some packages send everything as a POST form ("alternate request syntax").
  const method = url.searchParams.get('method')
  if (request.method === 'POST' && method) {
    const form = new URLSearchParams(await request.text())
    return { method: method.toUpperCase(), text: form.get('content') || '' }
  }
  return { method: request.method, text: request.method === 'GET' || request.method === 'HEAD' ? '' : await request.text() }
}

async function lrs(request, url) {
  const path = url.pathname.replace(/^\/xapi/, '').replace(/\/+$/, '') || '/'
  const { method, text } = await body(request, url)

  if (path === '/about') return json({ version: ['1.0.3', '1.0.0'] })

  // cmi5: the package trades the fetch address for a token, then sends it as its authorization.
  if (path === '/fetch') return json({ 'auth-token': btoa(`lms:${uuid()}`) })

  if (path === '/statements') {
    if (method === 'GET') return json({ statements: [], more: '' })
    let statements = []
    try {
      const parsed = JSON.parse(text || 'null')
      statements = Array.isArray(parsed) ? parsed : parsed ? [parsed] : []
    } catch {
      return json({ error: 'The statement is not valid JSON.' }, 400)
    }
    const given = url.searchParams.get('statementId')
    const ids = statements.map((s, i) => (s.id ||= i === 0 && given ? given : uuid()))
    await tell({ type: 'xapi-statements', statements })
    return method === 'PUT' ? empty() : json(ids)
  }

  if (path === '/activities/state' || path === '/activities/profile' || path === '/agents/profile') {
    const cache = await caches.open(XAPI)
    const key = documentKey(url)
    const stateId = url.searchParams.get('stateId')
    if (method === 'GET') {
      const hit = await cache.match(key)
      if (hit) return hit
      if (stateId === 'LMS.LaunchData') {
        const registration = url.searchParams.get('registration') || ''
        return json({
          contextTemplate: { extensions: { 'https://w3id.org/xapi/cmi5/context/extensions/sessionid': registration } },
          launchMode: 'Normal',
          launchMethod: 'AnyWindow',
          moveOn: 'CompletedOrPassed',
        })
      }
      // Asking for the list of stored state ids.
      if (path === '/activities/state' && !stateId) return json([])
      return empty(404)
    }
    if (method === 'DELETE') {
      await cache.delete(key)
      return empty()
    }
    await cache.put(key, new Response(text, { headers: { 'Content-Type': request.headers.get('Content-Type') || 'application/json' } }))
    return empty()
  }

  if (path === '/activities' || path === '/agents') return json({})
  return empty(404)
}
