/**
 * Passwords, sign-in sessions and two-factor codes. Passwords are stored as
 * scrypt hashes; a session is a signed, HttpOnly cookie. Each token carries a
 * fingerprint of the user's current password hash, so setting a new password
 * signs out every other device, plus a session id (for "one session at a
 * time") and the time of the last activity (for the session timeout).
 */
import { createHash, createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { passwordPolicy, passwordProblem as problemIn } from '../src/lib/rules.js'

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

/** A signed value that expires: session tokens, two-factor tickets, email links, sign-up challenges. */
export function signTicket(secret, data, ttlMs) {
  const payload = b64url(JSON.stringify({ ...data, e: Date.now() + ttlMs }))
  return `${payload}.${sign(secret, payload)}`
}

/** Returns the payload of a valid, unexpired ticket, or null. */
export function readTicket(secret, token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null
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

export function createToken(secret, userId, passwordHash, { sid = '', at = Date.now() } = {}) {
  return signTicket(secret, { u: userId, v: fingerprint(secret, passwordHash), s: sid, a: at }, SESSION_DAYS * 86400000)
}

export const readToken = readTicket

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

/** The password rules in Account & Settings (minimum length, strong passwords), enforced on the server. */
export function passwordProblem(password, settings) {
  const problem = problemIn(password, passwordPolicy(settings))
  return problem === 'Type a password or click Generate.' ? 'A password is required.' : problem
}

export const newSecret = () => randomBytes(32).toString('base64url')
export const newId = (prefix) => `${prefix}_${Date.now().toString(36)}${randomBytes(4).toString('hex')}`
export const sha256 = (text) => createHash('sha256').update(String(text)).digest('hex')

/** The address the request came from, as Vercel (or a local server) reports it. */
export function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  return String((Array.isArray(forwarded) ? forwarded[0] : forwarded) || req.socket?.remoteAddress || '')
    .split(',')[0]
    .trim()
}

export function originOf(req) {
  const proto = req.headers['x-forwarded-proto'] || (isHttps(req) ? 'https' : 'http')
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost'
  return `${String(proto).split(',')[0]}://${String(host).split(',')[0]}`
}

/* ------------------------------------------------- two-factor (TOTP, RFC 6238) */

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Encode(buf) {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return out
}

function base32Decode(text) {
  let bits = 0
  let value = 0
  const out = []
  for (const ch of String(text).toUpperCase().replace(/[^A-Z2-7]/g, '')) {
    value = (value << 5) | B32.indexOf(ch)
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

export const newTotpSecret = () => base32Encode(randomBytes(20))

function totpAt(secret, counter) {
  const msg = Buffer.alloc(8)
  msg.writeBigUInt64BE(BigInt(counter))
  const mac = createHmac('sha1', base32Decode(secret)).update(msg).digest()
  const offset = mac[mac.length - 1] & 15
  const code = (mac.readUInt32BE(offset) & 0x7fffffff) % 1000000
  return String(code).padStart(6, '0')
}

/** Accepts the current 30-second code and the ones just before and after it, for clocks that are slightly off. */
export function verifyTotp(secret, code, now = Date.now()) {
  const given = String(code || '').replace(/\s/g, '')
  if (!/^\d{6}$/.test(given) || !secret) return false
  const counter = Math.floor(now / 30000)
  return [-1, 0, 1].some((drift) => totpAt(secret, counter + drift) === given)
}

export const totpNow = (secret, now = Date.now()) => totpAt(secret, Math.floor(now / 30000))

export function totpUri(secret, email, issuer) {
  const label = encodeURIComponent(`${issuer}:${email}`)
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`
}

/** One-time codes for when the authenticator app is unavailable. Only their hashes are stored. */
export function newBackupCodes(count = 8) {
  return Array.from({ length: count }, () => {
    const raw = randomBytes(5).toString('hex').toUpperCase()
    return `${raw.slice(0, 5)}-${raw.slice(5)}`
  })
}

export const backupHash = (code) => sha256(String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''))
