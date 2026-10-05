/**
 * Everything the portal reaches outside itself for: email, webhooks, card
 * payments, video-conference rooms, the HR directory and sign-in providers.
 *
 * Keys and client secrets are kept in the server-only `_secrets` record (or in
 * environment variables) and are never sent to a browser.
 */
import { createHash } from 'node:crypto'

const TIMEOUT_MS = 8000

async function http(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeout || TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    const text = await res.text()
    let json = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = null
    }
    return { ok: res.ok, status: res.status, json, text }
  } catch (err) {
    return { ok: false, status: 0, json: null, text: err.name === 'AbortError' ? 'The service did not answer in time.' : String(err.message || err) }
  } finally {
    clearTimeout(timer)
  }
}

const problemOf = (res, fallback) =>
  res.json?.error?.message || res.json?.message || res.json?.error_description || (typeof res.json?.error === 'string' ? res.json.error : '') || res.text?.slice(0, 200) || fallback

/* ------------------------------------------------------------------ secrets */

/** Secret name -> the environment variable that can supply it instead of the portal. */
export const SECRET_NAMES = {
  emailApiKey: ['RESEND_API_KEY', 'SENDGRID_API_KEY'],
  stripeSecretKey: ['STRIPE_SECRET_KEY'],
  zoomClientSecret: ['ZOOM_CLIENT_SECRET'],
  bbbSecret: ['BBB_SECRET'],
  bambooApiKey: ['BAMBOOHR_API_KEY'],
  googleClientSecret: ['GOOGLE_CLIENT_SECRET'],
  facebookClientSecret: ['FACEBOOK_CLIENT_SECRET'],
  linkedinClientSecret: ['LINKEDIN_CLIENT_SECRET'],
  ssoClientSecret: ['SSO_CLIENT_SECRET'],
}

export async function loadSecrets(store) {
  const saved = (await store.get('_secrets', 'values')) || {}
  const out = {}
  const source = {}
  for (const [name, envNames] of Object.entries(SECRET_NAMES)) {
    const fromEnv = envNames.map((n) => process.env[n]).find(Boolean)
    out[name] = saved[name] || fromEnv || ''
    source[name] = saved[name] ? 'portal' : fromEnv ? 'environment' : null
  }
  return { values: out, source }
}

/** What an administrator may see of the secrets: whether each is set, never the value. */
export function secretStatus({ values, source }) {
  return Object.fromEntries(
    Object.keys(SECRET_NAMES).map((name) => [
      name,
      { set: !!values[name], source: source[name], hint: values[name] ? `••••${String(values[name]).slice(-4)}` : '' },
    ]),
  )
}

/* -------------------------------------------------------------------- email */

export function emailReady(settings, secrets) {
  const e = settings.email || {}
  return e.provider && e.provider !== 'None' && !!e.fromAddress && !!secrets.emailApiKey
}

export function emailProblem(settings, secrets) {
  const e = settings.email || {}
  if (!e.provider || e.provider === 'None') return 'No email service is connected (Account & Settings → Integrations → Email).'
  if (!e.fromAddress) return 'The email service has no “from” address.'
  if (!secrets.emailApiKey) return 'The email service has no API key.'
  return null
}

export async function sendEmail(settings, secrets, { to, subject, body }) {
  const problem = emailProblem(settings, secrets)
  if (problem) return { ok: false, skipped: true, error: problem }
  const e = settings.email
  const fromName = e.fromName || settings.siteName
  let res
  if (e.provider === 'SendGrid') {
    res = await http('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secrets.emailApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: e.fromAddress, name: fromName },
        subject,
        content: [{ type: 'text/plain', value: body }],
      }),
    })
  } else {
    res = await http('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secrets.emailApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `${fromName} <${e.fromAddress}>`, to: [to], subject, text: body }),
    })
  }
  return res.ok ? { ok: true } : { ok: false, error: problemOf(res, 'The email service refused the message.') }
}

/* ----------------------------------------------------------------- webhooks */

export async function postWebhook(url, payload) {
  if (!/^https?:\/\//i.test(url || '')) return { ok: false, error: 'Not a web address.' }
  const res = await http(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'GA-LMS-Webhook/1' },
    body: JSON.stringify(payload),
    timeout: 5000,
  })
  return res.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status || 'error'}` }
}

/* ------------------------------------------------------------------- Stripe */

function form(params, prefix = '', out = new URLSearchParams()) {
  for (const [key, value] of Object.entries(params)) {
    const name = prefix ? `${prefix}[${key}]` : key
    if (value && typeof value === 'object') form(value, name, out)
    else if (value != null) out.append(name, String(value))
  }
  return out
}

export async function stripeCheckout(key, { order, name, email, currency, origin }) {
  const res = await http('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({
      mode: 'payment',
      success_url: `${origin}/catalog?paid={CHECKOUT_SESSION_ID}&order=${order.id}`,
      cancel_url: `${origin}/catalog?cancelled=${order.id}`,
      client_reference_id: order.id,
      customer_email: email,
      metadata: { orderId: order.id },
      line_items: [
        {
          quantity: 1,
          price_data: { currency: currency.toLowerCase(), unit_amount: Math.round(Number(order.amount) * 100), product_data: { name } },
        },
      ],
    }),
  })
  if (!res.ok || !res.json?.url) return { ok: false, error: problemOf(res, 'Stripe could not start the payment.') }
  return { ok: true, url: res.json.url, sessionId: res.json.id }
}

/** Asks Stripe whether a checkout session was paid. Never trusts what the browser says. */
export async function stripeSessionPaid(key, sessionId, orderId) {
  if (!/^cs_[\w]+$/.test(sessionId || '')) return { ok: false, error: 'Not a Stripe checkout session.' }
  const res = await http(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, { headers: { Authorization: `Bearer ${key}` } })
  if (!res.ok) return { ok: false, error: problemOf(res, 'Stripe could not confirm the payment.') }
  const paid = res.json.payment_status === 'paid' && res.json.client_reference_id === orderId
  return { ok: true, paid, ref: res.json.payment_intent || sessionId }
}

export { paypalLink as paypalUrl } from '../src/lib/commerce.js'

/* ------------------------------------------------------- video conferencing */

/** Zoom, with a Server-to-Server OAuth app (account ID, client ID and client secret). */
export async function zoomMeeting(config, secret, { topic, start, durationMin }) {
  if (!config?.accountId || !config?.clientId || !secret) return { ok: false, error: 'Zoom needs an account ID, a client ID and a client secret.' }
  const token = await http(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(config.accountId)}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${config.clientId}:${secret}`).toString('base64')}` },
  })
  if (!token.ok || !token.json?.access_token) return { ok: false, error: problemOf(token, 'Zoom did not accept the credentials.') }
  const res = await http('https://api.zoom.us/v2/users/me/meetings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token.json.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, type: start ? 2 : 3, start_time: start ? new Date(start).toISOString() : undefined, duration: durationMin || 60 }),
  })
  if (!res.ok || !res.json?.join_url) return { ok: false, error: problemOf(res, 'Zoom could not create the meeting.') }
  return { ok: true, url: res.json.join_url, id: String(res.json.id) }
}

function bbbCall(config, secret, name, params) {
  const query = new URLSearchParams(params).toString()
  const checksum = createHash('sha1').update(`${name}${query}${secret}`).digest('hex')
  const base = String(config.serverUrl).replace(/\/+$/, '').replace(/\/api$/, '')
  return `${base}/api/${name}?${query}&checksum=${checksum}`
}

/** BigBlueButton: makes sure the room exists, then returns this person's own way in. */
export async function bbbJoin(config, secret, { meetingId, name, fullName, moderator }) {
  if (!config?.serverUrl || !secret) return { ok: false, error: 'BigBlueButton needs a server address and its shared secret.' }
  const created = await http(bbbCall(config, secret, 'create', { name, meetingID: meetingId, attendeePW: 'ap', moderatorPW: 'mp' }))
  if (!created.ok || !/<returncode>SUCCESS<\/returncode>/.test(created.text || ''))
    return { ok: false, error: 'The BigBlueButton server did not open the room. Check the address and shared secret.' }
  return { ok: true, url: bbbCall(config, secret, 'join', { fullName, meetingID: meetingId, password: moderator ? 'mp' : 'ap', redirect: 'true' }) }
}

/* ----------------------------------------------------------------- BambooHR */

export async function bambooEmployees(config, apiKey) {
  if (!config?.subdomain || !apiKey) return { ok: false, error: 'BambooHR needs your company subdomain and an API key.' }
  const res = await http(`https://api.bamboohr.com/api/gateway.php/${encodeURIComponent(config.subdomain)}/v1/employees/directory`, {
    headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:x`).toString('base64')}`, Accept: 'application/json' },
  })
  if (!res.ok || !Array.isArray(res.json?.employees)) return { ok: false, error: problemOf(res, 'BambooHR did not return the employee directory.') }
  return {
    ok: true,
    employees: res.json.employees
      .map((e) => ({ firstName: e.firstName || e.preferredName || '', lastName: e.lastName || '', email: String(e.workEmail || '').trim(), phone: e.workPhone || e.mobilePhone || '' }))
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.email)),
  }
}

/* --------------------------------------------- sign-in with another account */

const PROVIDERS = {
  google: {
    auth: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    profile: 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid email profile',
  },
  facebook: {
    auth: 'https://www.facebook.com/v19.0/dialog/oauth',
    token: 'https://graph.facebook.com/v19.0/oauth/access_token',
    profile: 'https://graph.facebook.com/me?fields=id,first_name,last_name,email',
    scope: 'email public_profile',
  },
  linkedin: {
    auth: 'https://www.linkedin.com/oauth/v2/authorization',
    token: 'https://www.linkedin.com/oauth/v2/accessToken',
    profile: 'https://api.linkedin.com/v2/userinfo',
    scope: 'openid profile email',
  },
}

/** The sign-in providers that are switched on and have everything they need. */
export function signInProviders(settings, secrets) {
  const u = settings.users || {}
  const sso = settings.sso || {}
  return {
    google: !!(u.socialGoogle && u.googleClientId && secrets.googleClientSecret),
    facebook: !!(u.socialFacebook && u.facebookClientId && secrets.facebookClientSecret),
    linkedin: !!(u.socialLinkedIn && u.linkedinClientId && secrets.linkedinClientSecret),
    sso: !!(sso.type === 'OpenID Connect' && sso.identityProvider && sso.clientId && secrets.ssoClientSecret),
  }
}

async function providerConfig(provider, settings, secrets) {
  if (provider === 'sso') {
    const issuer = String(settings.sso.identityProvider || '').replace(/\/+$/, '')
    const found = await http(`${issuer}/.well-known/openid-configuration`)
    if (!found.ok || !found.json?.authorization_endpoint) return null
    return {
      auth: found.json.authorization_endpoint,
      token: found.json.token_endpoint,
      profile: found.json.userinfo_endpoint,
      scope: 'openid email profile',
      clientId: settings.sso.clientId,
      clientSecret: secrets.ssoClientSecret,
      emailField: settings.sso.emailAttribute || 'email',
    }
  }
  const base = PROVIDERS[provider]
  if (!base) return null
  return { ...base, clientId: settings.users[`${provider}ClientId`], clientSecret: secrets[`${provider}ClientSecret`], emailField: 'email' }
}

export async function oauthStartUrl(provider, settings, secrets, { redirectUri, state }) {
  const config = await providerConfig(provider, settings, secrets)
  if (!config?.clientId) return null
  const q = new URLSearchParams({ response_type: 'code', client_id: config.clientId, redirect_uri: redirectUri, scope: config.scope, state })
  return `${config.auth}?${q}`
}

/** Trades the code a provider sent back for the person's email address and name. */
export async function oauthProfile(provider, settings, secrets, { code, redirectUri }) {
  const config = await providerConfig(provider, settings, secrets)
  if (!config?.clientId || !config.clientSecret) return { ok: false, error: 'This sign-in method is not set up.' }
  const token = await http(config.token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: config.clientId, client_secret: config.clientSecret }),
  })
  if (!token.ok || !token.json?.access_token) return { ok: false, error: problemOf(token, 'The sign-in provider refused the request.') }
  const profile = await http(config.profile, { headers: { Authorization: `Bearer ${token.json.access_token}`, Accept: 'application/json' } })
  const p = profile.json || {}
  const email = String(p[config.emailField] || p.email || '').trim().toLowerCase()
  if (!profile.ok || !email) return { ok: false, error: 'The sign-in provider did not share an email address.' }
  if (p.email_verified === false) return { ok: false, error: 'That email address has not been verified with the sign-in provider.' }
  return { ok: true, email, firstName: p.given_name || p.first_name || p.localizedFirstName || '', lastName: p.family_name || p.last_name || p.localizedLastName || '' }
}
