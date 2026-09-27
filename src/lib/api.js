/** Talks to the portal API in /api (server/handler.js). */

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

async function request(method, route, body) {
  let res
  try {
    res = await fetch(`/api/${route}`, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'The portal server could not be reached. Check your connection.')
  }
  const data = await res.json().catch(() => null)
  if (!res.ok || !data) throw new ApiError(res.status, data?.error || 'The portal server returned an error.')
  return data
}

export const api = {
  get: (route) => request('GET', route),
  post: (route, body = {}) => request('POST', route, body),
}

/**
 * Which way this copy of the portal stores data:
 * - { api: true,  database: 'postgres' | 'file' } -> shared data on the server
 * - { api: true,  database: null }                 -> deployed, but no database connected yet
 * - { api: false }                                 -> no server (plain static hosting)
 */
export async function detectBackend() {
  try {
    const res = await fetch('/api/health', { headers: { Accept: 'application/json' } })
    const data = await res.json()
    return { api: !!data?.ok, database: data?.database || null }
  } catch {
    return { api: false, database: null }
  }
}
