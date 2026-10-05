import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Field, Icon, Input } from '../components/ui'
import AuthShell, { Alert, PasswordInput } from '../components/layout/AuthShell'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useT } from '../lib/i18n'

const SOCIAL = [
  ['socialGoogle', 'google', 'Google'],
  ['socialFacebook', 'facebook', 'Facebook'],
  ['socialLinkedIn', 'linkedin', 'LinkedIn'],
]

export default function Login() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { login, loginWithCode, signedOutReason } = useAuth()
  const { settings, backend } = useData()
  const t = useT()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(params.get('error') || '')
  const [busy, setBusy] = useState(false)
  // Set once the password is accepted and a code from the authenticator app is needed.
  const [ticket, setTicket] = useState(null)
  const [code, setCode] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    const result = ticket ? await loginWithCode(ticket, code) : await login(email, password)
    setBusy(false)
    if (result.twoFactor) {
      setTicket(result.ticket)
      setCode('')
    } else if (!result.ok) {
      setError(result.error)
      // An expired attempt starts again from the password.
      if (ticket && /expired|sign in again/i.test(result.error || '')) setTicket(null)
    } else navigate('/', { replace: true })
  }

  const u = settings.users || {}
  const providers = backend.mode === 'server' ? SOCIAL.filter(([key]) => u[key]) : []
  const sso = backend.mode === 'server' && settings.signIn?.sso

  return (
    <AuthShell>
      <h2 className="text-[26px] font-semibold text-ink-900">{ticket ? t('Enter your sign-in code') : t('Sign in to your portal')}</h2>
      <p className="hint mt-2 mb-8">
        {ticket
          ? t('Open your authenticator app and type the 6-digit code for this portal. A backup code works too.')
          : t('Use the email address and password issued to you by GA Healthcare Training.')}
      </p>

      {!ticket && settings.announcements?.externalOn && settings.announcements.external?.trim() && (
        <Alert tone="blue" icon="megaphone">
          {settings.announcements.external.trim()}
        </Alert>
      )}
      {!error && signedOutReason && <Alert tone="amber">{signedOutReason}</Alert>}

      <form onSubmit={submit} noValidate>
        {ticket ? (
          <Field label={t('Code')}>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123 456"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              className="tracking-[0.3em] text-[18px]"
            />
          </Field>
        ) : (
          <>
            <Field label={t('Email address')}>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </Field>
            <Field label={t('Password')}>
              <PasswordInput value={password} onChange={setPassword} placeholder={t('Enter your password')} />
            </Field>
          </>
        )}

        {error && <Alert>{error}</Alert>}

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? t('Signing in…') : ticket ? t('Verify') : t('Sign in')}
        </Button>
        {ticket && (
          <button type="button" className="link text-[13.5px] mt-4" onClick={() => setTicket(null)}>
            {t('Use a different account')}
          </button>
        )}
      </form>

      {!ticket && (providers.length > 0 || sso) && (
        <div className="mt-6">
          <p className="text-[12.5px] text-ink-500 text-center mb-3">{t('or continue with')}</p>
          <div className="space-y-2.5">
            {sso && (
              <a href="/api/oauth?provider=sso" className="btn-ghost w-full">
                <Icon name="building" className="w-[18px] h-[18px]" />
                {t('Your organization account')}
              </a>
            )}
            {providers.map(([, id, label]) => (
              <a key={id} href={`/api/oauth?provider=${id}`} className="btn-ghost w-full">
                {label}
              </a>
            ))}
          </div>
        </div>
      )}

      {!ticket && (
        <div className="mt-10 pt-6 border-t border-line">
          {u.selfRegistration ? (
            <p className="text-[13.5px] text-ink-700">
              {t('New here?')}{' '}
              <Link to="/signup" className="link font-semibold">
                {t('Create an account')}
              </Link>
            </p>
          ) : (
            <p className="text-[13px] text-ink-500 leading-6">
              {t('New students do not sign up here. Your account is created by the program office and your login details are emailed to you. If you forget your password, contact the program office for a new one.')}
            </p>
          )}
          {settings.courses?.externalCatalog && (
            <p className="text-[13.5px] mt-3">
              <Link to="/explore" className="link">
                {t('Browse the course catalog')}
              </Link>
            </p>
          )}
        </div>
      )}
    </AuthShell>
  )
}
