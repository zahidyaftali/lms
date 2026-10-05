import { useState } from 'react'
import { Icon, Input } from '../ui'
import Logo from './Logo'
import { useData } from '../../context/DataContext'

/** The split screen shared by the sign-in and sign-up pages: brand panel on the left, form on the right. */
export default function AuthShell({ children, wide = false }) {
  const { settings } = useData()
  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex w-[46%] bg-navy-900 text-white flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute -right-24 -top-24 w-[420px] h-[420px] rounded-full border border-white/10" />
        <div className="absolute -right-10 top-40 w-[320px] h-[320px] rounded-full border border-white/10" />

        <Logo inverted boxed={false} />

        <div className="relative">
          <p className="text-gold-400 text-[13px] font-semibold tracking-[0.2em] uppercase mb-4">Nursing Assistant Program</p>
          <h1 className="text-[40px] leading-[1.15] font-semibold mb-5">
            Build a healthcare career
            <br />
            that lasts.
          </h1>
          <p className="text-white/75 text-[15px] leading-7 max-w-md">{settings.siteDescription}</p>

          <div className="flex flex-wrap gap-2.5 mt-8">
            {['Online Hybrid Format', 'Open Enrollment', 'Exam Prep Included'].map((tag) => (
              <span key={tag} className="px-4 py-2 rounded-full border border-white/25 text-[12.5px] text-white/85">
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
        <div className={wide ? 'w-full max-w-[480px]' : 'w-full max-w-[400px]'}>
          <div className="lg:hidden mb-8">
            <Logo />
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

/** A centred card on a plain page: the steps between signing in and the portal, and the small public pages. */
export function CenterCard({ title, subtitle, children, footer, width = 'max-w-[460px]' }) {
  return (
    <div className="min-h-screen bg-[#f7f8fa] flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="mb-7">
        <Logo />
      </div>
      <div className={`w-full ${width} card p-6 sm:p-8`}>
        {title && <h1 className="text-[22px] leading-7 font-bold text-ink-900">{title}</h1>}
        {subtitle && <p className="hint mt-2 mb-6">{subtitle}</p>}
        {children}
      </div>
      {footer && <div className="mt-5 text-[13px] text-ink-500">{footer}</div>}
    </div>
  )
}

export function PasswordInput({ value, onChange, placeholder = 'Enter your password', autoComplete = 'current-password' }) {
  const [shown, setShown] = useState(false)
  return (
    <div className="relative">
      <Input
        type={shown ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className="pr-11"
      />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-900"
        aria-label={shown ? 'Hide password' : 'Show password'}
      >
        <Icon name="eye" className="w-[18px] h-[18px]" />
      </button>
    </div>
  )
}

export function Alert({ tone = 'red', icon, children }) {
  const tones = {
    red: 'bg-red-50 border-red-100 text-red-700',
    blue: 'bg-brand-50 border-brand-100 text-ink-900',
    green: 'bg-emerald-50 border-emerald-100 text-emerald-800',
    amber: 'bg-amber-50 border-amber-100 text-amber-900',
  }
  return (
    <div className={`flex items-start gap-2.5 rounded-md border px-4 py-3 mb-5 ${tones[tone]}`}>
      <Icon name={icon || (tone === 'red' ? 'alert' : tone === 'green' ? 'checkCircle' : 'info')} className="w-[18px] h-[18px] mt-0.5 shrink-0" />
      <p className="text-[13px] leading-5 whitespace-pre-line">{children}</p>
    </div>
  )
}
