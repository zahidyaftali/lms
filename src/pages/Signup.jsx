import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Button, Checkbox, Field, Input, Modal } from '../components/ui'
import AuthShell, { Alert, PasswordInput } from '../components/layout/AuthShell'
import CustomFieldInputs, { customFieldErrors } from '../components/users/CustomFieldInputs'
import { useData } from '../context/DataContext'
import { emailDomainAllowed, passwordHint, passwordPolicy, passwordProblem, termsVersion } from '../lib/rules.js'
import { useT } from '../lib/i18n'

const DONE = {
  active: ['Your account is ready', 'Sign in with the email address and password you just chose.'],
  email: ['Check your email', 'We sent you a link to confirm your email address. Open it to activate your account, then sign in.'],
  approval: ['Almost there', 'Your account has been created and is waiting for the program office to activate it. You will be able to sign in once they do.'],
}

/** Self-registration, when it is switched on in Account & Settings → Users. */
export default function Signup() {
  const { settings, backend, users, userTypes, actions } = useData()
  const t = useT()
  const u = settings.users || {}
  const policy = passwordPolicy(settings)
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', custom: {}, acceptTerms: false, answer: '' })
  const [challenge, setChallenge] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const [termsOpen, setTermsOpen] = useState(false)
  const server = backend.mode === 'server'
  const captcha = u.verification === 'CAPTCHA'

  async function newChallenge() {
    if (!captcha) return
    if (server) {
      const res = await actions.rpc('signup.challenge', {}, { refresh: false })
      if (res.ok) setChallenge(res)
    } else {
      const a = 2 + Math.floor(Math.random() * 8)
      const b = 1 + Math.floor(Math.random() * 9)
      setChallenge({ question: `What is ${a} + ${b}?`, sum: a + b })
    }
  }
  useEffect(() => {
    newChallenge()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captcha, server])

  if (!u.selfRegistration) return <Navigate to="/login" replace />

  const set = (changes) => setForm((f) => ({ ...f, ...changes }))

  async function submit(e) {
    e.preventDefault()
    setError('')
    const email = form.email.trim().toLowerCase()
    const missing = Object.values(customFieldErrors(u.customFields, form.custom))[0]
    const problem = !form.firstName.trim() || !form.lastName.trim()
      ? 'Enter your first and last name.'
      : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ? 'Enter a valid email address.'
        : passwordProblem(form.password, policy) || missing || (u.termsOn && u.terms?.trim() && !form.acceptTerms ? 'Accept the terms of service to continue.' : '')
    if (problem) return setError(problem)

    setBusy(true)
    if (server) {
      const res = await actions.rpc(
        'signup',
        { firstName: form.firstName, lastName: form.lastName, email, password: form.password, custom: form.custom, acceptTerms: form.acceptTerms, challenge: challenge?.ticket, answer: form.answer },
        { refresh: false },
      )
      setBusy(false)
      if (!res.ok) {
        setError(res.error)
        newChallenge()
        return
      }
      return setDone(res.status)
    }

    // Without the shared database the account is kept in this browser, like every other record.
    setBusy(false)
    if (captcha && Number(form.answer) !== challenge?.sum) {
      newChallenge()
      return setError('That answer is not right. Try the question again.')
    }
    if (!emailDomainAllowed(email, u.allowedDomains)) return setError('Sign-up is limited to approved email addresses. Use the address your organization gave you.')
    if (users.some((x) => x.email.toLowerCase() === email)) return setError('An account with this email address already exists. Sign in instead.')
    const pending = u.verification === 'Email verification' || u.verification === 'Administrator activation' ? 'approval' : null
    const wanted = userTypes.find((x) => x.name === u.defaultUserType)
    const type = wanted?.role === 'learner' ? wanted : userTypes.find((x) => x.role === 'learner')
    actions.addUser({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email,
      password: form.password,
      role: 'learner',
      userType: type?.name || 'Learner-Type',
      active: !pending,
      pending,
      selfRegistered: true,
      custom: form.custom,
      ...(form.acceptTerms && u.termsOn ? { termsAccepted: termsVersion(u.terms), termsAcceptedAt: new Date().toISOString() } : {}),
    })
    setDone(pending || 'active')
  }

  if (done) {
    const [title, text] = DONE[done] || DONE.active
    return (
      <AuthShell>
        <h2 className="text-[26px] font-semibold text-ink-900">{t(title)}</h2>
        <p className="hint mt-2 mb-8">{t(text)}</p>
        <Link to="/login" className="btn-primary w-full">
          {t('Go to sign in')}
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell wide>
      <h2 className="text-[26px] font-semibold text-ink-900">{t('Create your account')}</h2>
      <p className="hint mt-2 mb-7">{t('Sign up to browse courses and start learning.')}</p>

      <form onSubmit={submit} noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Field label={t('First name')} required>
            <Input value={form.firstName} onChange={(e) => set({ firstName: e.target.value })} autoComplete="given-name" />
          </Field>
          <Field label={t('Last name')} required>
            <Input value={form.lastName} onChange={(e) => set({ lastName: e.target.value })} autoComplete="family-name" />
          </Field>
        </div>
        <Field label={t('Email address')} required hint={u.allowedDomains ? undefined : undefined}>
          <Input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="you@example.com" />
        </Field>
        <Field label={t('Password')} required hint={passwordHint(policy)}>
          <PasswordInput value={form.password} onChange={(v) => set({ password: v })} autoComplete="new-password" placeholder="" />
        </Field>

        <CustomFieldInputs fields={u.customFields} values={form.custom} onChange={(custom) => set({ custom })} />

        {captcha && challenge && (
          <Field label={challenge.question} required hint={t('A quick check that you are a person.')}>
            <Input value={form.answer} onChange={(e) => set({ answer: e.target.value })} inputMode="numeric" className="w-32" />
          </Field>
        )}

        {u.termsOn && u.terms?.trim() && (
          <div className="mb-5 flex items-start gap-2.5">
            <Checkbox checked={form.acceptTerms} onChange={(v) => set({ acceptTerms: v })} />
            <span className="text-[14px] leading-[22px]">
              {t('I accept the')}{' '}
              <button type="button" className="link" onClick={() => setTermsOpen(true)}>
                {t('terms of service')}
              </button>
            </span>
          </div>
        )}

        {error && <Alert>{error}</Alert>}

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? t('Creating your account…') : t('Create account')}
        </Button>
      </form>

      <p className="text-[13.5px] text-ink-700 mt-8 pt-6 border-t border-line">
        {t('Already have an account?')}{' '}
        <Link to="/login" className="link font-semibold">
          {t('Sign in')}
        </Link>
      </p>

      <Modal open={termsOpen} onClose={() => setTermsOpen(false)} title={t('Terms of service')}>
        <p className="text-[14px] leading-6 whitespace-pre-line">{u.terms}</p>
      </Modal>
    </AuthShell>
  )
}
