import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Field, Icon, Input, Modal } from '../components/ui'
import Logo from '../components/layout/Logo'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { cx } from '../lib/utils'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { settings, users } = useData()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [helpOpen, setHelpOpen] = useState(false)
  const [accountsOpen, setAccountsOpen] = useState(false)

  const submit = (e) => {
    e.preventDefault()
    setError('')
    const result = login(email, password)
    if (!result.ok) setError(result.error)
    else navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex w-[46%] bg-navy-900 text-white flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute -right-24 -top-24 w-[420px] h-[420px] rounded-full border border-white/10" />
        <div className="absolute -right-10 top-40 w-[320px] h-[320px] rounded-full border border-white/10" />

        <Logo inverted boxed={false} />

        <div className="relative">
          <p className="text-gold-400 text-[13px] font-semibold tracking-[0.2em] uppercase mb-4">
            Nursing Assistant Program
          </p>
          <h1 className="text-[40px] leading-[1.15] font-semibold mb-5">
            Build a healthcare career
            <br />
            that lasts.
          </h1>
          <p className="text-white/75 text-[15px] leading-7 max-w-md">{settings.siteDescription}</p>

          <div className="flex flex-wrap gap-2.5 mt-8">
            {['Online Hybrid Format', 'Open Enrollment', 'Exam Prep Included'].map((tag) => (
              <span
                key={tag}
                className="px-4 py-2 rounded-full border border-white/25 text-[12.5px] text-white/85"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <p className="text-white/50 text-[12.5px] relative">
          © {new Date().getFullYear()} GA Healthcare Training &amp; Consulting. All rights reserved.
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-[400px]">
          <div className="lg:hidden mb-8">
            <Logo />
          </div>

          <h2 className="text-[26px] font-semibold text-ink-900">Sign in to your portal</h2>
          <p className="hint mt-2 mb-8">
            Use the email address and password issued to you by GA Healthcare Training.
          </p>

          <form onSubmit={submit} noValidate>
            <Field label="Email address">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="username"
              />
            </Field>

            <Field label="Password">
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-900"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Icon name="eye" className="w-[18px] h-[18px]" />
                </button>
              </div>
            </Field>

            {error && (
              <div className="flex items-start gap-2.5 rounded-md bg-red-50 border border-red-100 px-4 py-3 mb-5">
                <Icon name="alert" className="w-[18px] h-[18px] text-red-600 mt-0.5 shrink-0" />
                <p className="text-[13px] text-red-700 leading-5">{error}</p>
              </div>
            )}

            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </form>

          <button onClick={() => setHelpOpen(true)} className="link text-[13.5px] mt-5 inline-block">
            Forgot your password?
          </button>

          <div className="mt-10 pt-6 border-t border-line">
            <p className="text-[13px] text-ink-500 leading-6">
              New students do not sign up here. Your account is created by the program office and your login
              details are emailed to you.
            </p>
            <button
              onClick={() => setAccountsOpen(true)}
              className="link text-[13px] mt-2 inline-flex items-center gap-1.5"
            >
              <Icon name="info" className="w-4 h-4" />
              View portal accounts for testing
            </button>
          </div>
        </div>
      </div>

      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Password help" width="max-w-md">
        <p className="text-[14px] text-ink-700 leading-6">
          Passwords are reset by an administrator. Email{' '}
          <a className="link" href={`mailto:${settings.supportEmail}`}>
            {settings.supportEmail}
          </a>{' '}
          or call {settings.supportPhone} and a new password will be issued to you.
        </p>
      </Modal>

      <Modal
        open={accountsOpen}
        onClose={() => setAccountsOpen(false)}
        title="Portal accounts"
        subtitle="Seeded accounts you can use while evaluating the portal."
      >
        <div className="divide-y divide-line">
          {users
            .filter((u) => u.active)
            .map((u) => (
              <div key={u.id} className="py-3 flex items-center gap-4">
                <span
                  className={cx(
                    'w-2 h-2 rounded-full shrink-0',
                    u.role === 'learner' ? 'bg-emerald-500' : u.role === 'instructor' ? 'bg-amber-500' : 'bg-brand-700',
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-medium text-ink-900">{u.userType}</p>
                  <p className="text-[13px] text-ink-500 truncate">{u.email}</p>
                </div>
                <code className="text-[12.5px] bg-gray-100 rounded px-2.5 py-1">{u.password}</code>
                <button
                  className="link text-[12.5px]"
                  onClick={() => {
                    setEmail(u.email)
                    setPassword(u.password)
                    setAccountsOpen(false)
                  }}
                >
                  Use
                </button>
              </div>
            ))}
        </div>
      </Modal>
    </div>
  )
}
