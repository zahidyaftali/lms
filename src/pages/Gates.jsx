import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Button, Checkbox, Field, Input } from '../components/ui'
import { Alert, CenterCard, PasswordInput } from '../components/layout/AuthShell'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { passwordHint, passwordPolicy, passwordProblem } from '../lib/rules.js'
import { copyText } from '../lib/utils'
import { useT } from '../lib/i18n'

/**
 * The steps between signing in and the portal, in the order they are asked:
 * setting up two-factor authentication, choosing a new password, accepting the
 * terms of service. Which ones apply comes from Account & Settings.
 */
export default function Gates() {
  const { gate } = useAuth()
  if (gate.twoFactor) return <TwoFactorSetup />
  if (gate.password) return <NewPassword kind={gate.password} />
  return <Terms />
}

function SignOutLink() {
  const { logout } = useAuth()
  const t = useT()
  return (
    <button className="link" onClick={logout}>
      {t('Sign out')}
    </button>
  )
}

function TwoFactorSetup() {
  const { actions } = useData()
  const t = useT()
  const [setup, setSetup] = useState(null)
  const [qr, setQr] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [backupCodes, setBackupCodes] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let live = true
    actions.rpc('twofactor.setup', {}, { refresh: false }).then(async (res) => {
      if (!live) return
      if (!res.ok) return setError(res.error)
      setSetup(res)
      setQr(await QRCode.toDataURL(res.uri, { margin: 1, width: 220 }))
    })
    return () => {
      live = false
    }
  }, [actions])

  async function enable(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const res = await actions.rpc('twofactor.enable', { code }, { refresh: false })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setBackupCodes(res.backupCodes)
  }

  if (backupCodes) {
    return (
      <CenterCard
        title={t('Save your backup codes')}
        subtitle={t('Each code signs you in once if you do not have your phone. Keep them somewhere safe: they are not shown again.')}
      >
        <ul className="grid grid-cols-2 gap-2.5 mb-5">
          {backupCodes.map((c) => (
            <li key={c} className="font-mono text-[14px] tracking-wide bg-gray-100 rounded px-3 py-2 text-center select-all">
              {c}
            </li>
          ))}
        </ul>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="ghost"
            icon={copied ? 'check' : 'copy'}
            onClick={async () => setCopied(await copyText(backupCodes.join('\n')))}
            className="flex-1"
          >
            {copied ? t('Copied') : t('Copy codes')}
          </Button>
          <Button className="flex-1" onClick={() => actions.reload()}>
            {t('Continue to the portal')}
          </Button>
        </div>
      </CenterCard>
    )
  }

  return (
    <CenterCard
      title={t('Set up two-factor authentication')}
      subtitle={t('Your account needs a second step when signing in. Scan the code with an authenticator app (Google Authenticator, Microsoft Authenticator, Authy), then type the 6-digit code it shows.')}
      footer={<SignOutLink />}
    >
      {error && <Alert>{error}</Alert>}
      {setup && (
        <form onSubmit={enable}>
          <div className="flex flex-col items-center mb-5">
            {qr ? <img src={qr} alt="QR code for your authenticator app" width={200} height={200} className="rounded-md border border-line" /> : <div className="w-[200px] h-[200px] rounded-md bg-gray-100 animate-pulse" />}
            <p className="hint mt-3 text-center">{t('Cannot scan it? Enter this key in the app instead:')}</p>
            <code className="mt-1.5 font-mono text-[13.5px] tracking-[0.12em] bg-gray-100 rounded px-3 py-1.5 select-all break-all text-center">
              {setup.secret.match(/.{1,4}/g).join(' ')}
            </code>
          </div>
          <Field label={t('Code from the app')}>
            <Input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="123 456" className="tracking-[0.3em] text-[18px]" />
          </Field>
          <Button type="submit" className="w-full" disabled={busy || code.replace(/\D/g, '').length < 6}>
            {busy ? t('Checking…') : t('Turn on two-factor authentication')}
          </Button>
        </form>
      )}
    </CenterCard>
  )
}

function NewPassword({ kind }) {
  const { user } = useAuth()
  const { settings, actions } = useData()
  const t = useT()
  const policy = passwordPolicy(settings)
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    const problem = passwordProblem(form.next, policy)
    if (problem) return setError(problem)
    if (form.next !== form.confirm) return setError(t('The new passwords do not match.'))
    setBusy(true)
    const res = await actions.changePassword(user.id, form.current, form.next)
    setBusy(false)
    if (!res.ok) setError(res.error)
  }

  return (
    <CenterCard
      title={t('Choose a new password')}
      subtitle={
        kind === 'first'
          ? t('Your password was set by the program office. Choose one only you know before you continue.')
          : t('Your password has expired. Choose a new one to continue.')
      }
      footer={<SignOutLink />}
    >
      <form onSubmit={submit}>
        <Field label={t('Current password')}>
          <PasswordInput value={form.current} onChange={(v) => setForm({ ...form, current: v })} />
        </Field>
        <Field label={t('New password')} hint={passwordHint(policy)}>
          <PasswordInput value={form.next} onChange={(v) => setForm({ ...form, next: v })} autoComplete="new-password" placeholder="" />
        </Field>
        <Field label={t('Confirm new password')}>
          <PasswordInput value={form.confirm} onChange={(v) => setForm({ ...form, confirm: v })} autoComplete="new-password" placeholder="" />
        </Field>
        {error && <Alert>{error}</Alert>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? t('Saving…') : t('Save password')}
        </Button>
      </form>
    </CenterCard>
  )
}

function Terms() {
  const { user } = useAuth()
  const { settings, actions } = useData()
  const t = useT()
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  return (
    <CenterCard title={t('Terms of service')} subtitle={t('Please read and accept these terms to use the portal.')} width="max-w-[640px]" footer={<SignOutLink />}>
      <div className="border border-line rounded-md bg-[#f7f8fa] p-4 max-h-[46vh] overflow-y-auto scroll-thin text-[14px] leading-6 text-ink-900 whitespace-pre-line mb-5">
        {settings.users?.terms}
      </div>
      {error && <Alert>{error}</Alert>}
      <Checkbox label={t('I have read and accept the terms of service')} checked={agreed} onChange={setAgreed} />
      <Button
        className="w-full mt-5"
        disabled={!agreed || busy}
        onClick={async () => {
          setBusy(true)
          const res = await actions.acceptTerms(user.id)
          setBusy(false)
          if (res && res.ok === false) setError(res.error)
        }}
      >
        {t('Continue')}
      </Button>
    </CenterCard>
  )
}
