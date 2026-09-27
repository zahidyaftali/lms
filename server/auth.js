/**
 * Passwords and sign-in sessions. Passwords are stored as scrypt hashes; a
 * session is a signed, HttpOnly cookie. Each token carries a fingerprint of the
 * user's current password hash, so setting a new password signs out every
 * other device.
 */
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCb)
const COOKIE = 'lms_session'
export const SESSION_DAYS = 14

export async function hashPassword(password) {
  const salt = randomBytes(16)
  const key = await scrypt(String(password), salt, 64)
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`
}

export async function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false
  const [, salt, expected] = stored.split('$')
  const key = await scrypt(String(password), Buffer.from(salt, 'base64'), 64)
  const want = Buffer.from(expected, 'base64')
  return want.length === key.length && timingSafeEqual(key, want)
}

const b64url = (buf) => Buffer.from(buf).toString('base64url')
const sign = (secret, text) => createHmac('sha256', secret).update(text).digest('base64url')
const fingerprint = (secret, hash) => sign(secret, `pw:${hash}`).slice(0, 16)

export function createToken(secret, userId, passwordHash) {
  const payload = b64url(
    JSON.stringify({ u: userId, v: fingerprint(secret, passwordHash), e: Date.now() + SESSION_DAYS * 86400000 }),
  )
  return `${payload}.${sign(secret, payload)}`
}

/** Returns the payload of a valid, unexpired token, or null. */
export function readToken(secret, token) {
  if (!token || !token.includes('.')) return null
  const [payload, sig] = token.split('.')
  const want = Buffer.from(sign(secret, payload))
  const got = Buffer.from(sig || '')
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return data.e > Date.now() ? data : null
  } catch {
    return null
  }
}

export const tokenMatchesHash = (secret, data, passwordHash) => data.v === fingerprint(secret, passwordHash)

export function readCookie(req) {
  const header = req.headers.cookie || ''
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === COOKIE) return decodeURIComponent(rest.join('='))
  }
  return null
}

const isHttps = (req) =>
  req.headers['x-forwarded-proto'] === 'https' || !!process.env.VERCEL || req.socket?.encrypted === true

export function sessionCookie(req, token) {
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${isHttps(req) ? '; Secure' : ''}`
}

export function clearedCookie(req) {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isHttps(req) ? '; Secure' : ''}`
}

/** The rule the Users page applies, enforced again here. */
export function passwordProblem(password, minLength = 8) {
  if (typeof password !== 'string' || !password) return 'A password is required.'
  if (password !== password.trim()) return 'Passwords cannot start or end with a space.'
  if (password.length < minLength) return `Use at least ${minLength} characters.`
  return null
}

export const newSecret = () => randomBytes(32).toString('base64url')
