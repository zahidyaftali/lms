import { formatDate } from '../../lib/utils'

export const CERTIFICATE_TYPES = [
  { value: 'classic', label: 'Classic' },
  { value: 'fancy', label: 'Fancy' },
  { value: 'modern', label: 'Modern' },
  { value: 'simple', label: 'Simple' },
]

const ISSUER = 'GA Healthcare Training & Consulting'
const SIGNATORY = { name: 'Dr. Yolaine Nozile, PhD, RN', title: 'Program Director' }

/**
 * The printable certificate. Every template carries the `certificate-sheet`
 * class, which the print stylesheet uses to hide the rest of the page.
 */
export default function CertificateView({ type = 'classic', recipient, courseName, issuedAt, code, settings }) {
  const props = { recipient, courseName, date: formatDate(issuedAt), code, settings }
  if (type === 'fancy') return <Fancy {...props} />
  if (type === 'modern') return <Modern {...props} />
  if (type === 'simple') return <Simple {...props} />
  return <Classic {...props} />
}

function Classic({ recipient, courseName, date, code, settings }) {
  return (
    <div className="certificate-sheet border-4 border-double border-gold-500 p-10 text-center bg-white">
      <p className="text-[11.5px] tracking-[0.3em] uppercase text-gold-600 font-semibold">{ISSUER}</p>
      <h3 className="text-[26px] font-semibold mt-6">Certificate of Completion</h3>
      <p className="hint mt-5">This certifies that</p>
      <p className="text-[22px] font-semibold mt-2">{recipient}</p>
      <p className="hint mt-5">has successfully completed</p>
      <p className="text-[18px] font-medium mt-2">{courseName}</p>
      <SignatureRow date={date} code={code} />
      <Verify settings={settings} />
    </div>
  )
}

function Fancy({ recipient, courseName, date, code, settings }) {
  return (
    <div className="certificate-sheet bg-navy-900 p-3">
      <div className="relative bg-[#fffcf2] border-2 border-gold-500 px-8 sm:px-12 py-12 text-center">
        <div className="absolute inset-2 border border-gold-400/60 pointer-events-none" />
        {['top-4 left-4', 'top-4 right-4', 'bottom-4 left-4', 'bottom-4 right-4'].map((spot) => (
          <span key={spot} className={`absolute ${spot} w-3 h-3 rotate-45 border-2 border-gold-500`} />
        ))}
        <p className="text-[11.5px] tracking-[0.35em] uppercase text-navy-700 font-semibold">{ISSUER}</p>
        <h3 className="font-serif italic text-[32px] leading-tight text-navy-900 mt-6">Certificate of Completion</h3>
        <div className="flex items-center justify-center gap-3 mt-4">
          <span className="h-px w-16 bg-gold-500" />
          <span className="w-2 h-2 rotate-45 bg-gold-500" />
          <span className="h-px w-16 bg-gold-500" />
        </div>
        <p className="hint mt-6">Proudly presented to</p>
        <p className="font-serif italic text-[30px] leading-tight text-navy-900 mt-2">{recipient}</p>
        <p className="hint mt-5">for successfully completing</p>
        <p className="text-[18px] font-semibold text-navy-900 mt-2">{courseName}</p>
        <SignatureRow date={date} code={code} />
        <Verify settings={settings} />
      </div>
    </div>
  )
}

function Modern({ recipient, courseName, date, code }) {
  return (
    <div className="certificate-sheet bg-white border border-line flex flex-col sm:flex-row sm:min-h-[380px]">
      <div className="sm:w-[34%] bg-navy-900 text-white p-8 flex flex-col justify-between gap-8 relative overflow-hidden">
        <div className="absolute -right-16 -bottom-16 w-48 h-48 rounded-full border border-white/10" />
        <p className="relative text-[10.5px] tracking-[0.3em] uppercase text-gold-400 font-semibold leading-5">{ISSUER}</p>
        <div className="relative">
          <p className="text-[32px] font-bold leading-none">Certificate</p>
          <p className="text-[15px] text-white/70 mt-2">of completion</p>
        </div>
        <p className="relative text-[11.5px] text-white/60">No. {code}</p>
      </div>
      <div className="flex-1 p-8 sm:p-10 flex flex-col">
        <span className="h-1 w-14 bg-gold-500" />
        <p className="hint mt-8">Awarded to</p>
        <p className="text-[28px] font-bold text-ink-900 leading-tight mt-1">{recipient}</p>
        <p className="hint mt-6">for completing</p>
        <p className="text-[18px] font-semibold text-ink-900 mt-1">{courseName}</p>
        <div className="mt-auto pt-10 flex justify-between items-end gap-6">
          <div>
            <p className="text-[13px] font-medium">{date}</p>
            <p className="text-[11.5px] text-ink-500">Date issued</p>
          </div>
          <div className="text-right">
            <p className="text-[13px] font-medium">{SIGNATORY.name}</p>
            <p className="text-[11.5px] text-ink-500">{SIGNATORY.title}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Simple({ recipient, courseName, date, code }) {
  return (
    <div className="certificate-sheet bg-white border border-[#d9dce2] p-8 sm:p-10">
      <p className="text-[12.5px] text-ink-500">{ISSUER}</p>
      <h3 className="text-[24px] font-bold text-ink-900 mt-8">Certificate of Completion</h3>
      <p className="text-[14.5px] text-ink-700 leading-7 mt-5">
        This certifies that <strong className="font-semibold text-ink-900">{recipient}</strong> has successfully
        completed <strong className="font-semibold text-ink-900">{courseName}</strong> on {date}.
      </p>
      <div className="mt-12 pt-5 border-t border-line flex flex-wrap justify-between gap-3 text-[12px] text-ink-500">
        <span>
          {SIGNATORY.name} · {SIGNATORY.title}
        </span>
        <span>Certificate no. {code}</span>
      </div>
    </div>
  )
}

function SignatureRow({ date, code }) {
  return (
    <div className="flex justify-between items-end gap-4 mt-12 pt-6 border-t border-line text-left">
      <div>
        <p className="text-[13px] font-medium">{date}</p>
        <p className="text-[11.5px] text-ink-500">Date issued</p>
      </div>
      <div className="text-center">
        <p className="text-[13px] font-medium">{SIGNATORY.name}</p>
        <p className="text-[11.5px] text-ink-500">{SIGNATORY.title}</p>
      </div>
      <div className="text-right">
        <p className="text-[13px] font-medium">{code}</p>
        <p className="text-[11.5px] text-ink-500">Certificate number</p>
      </div>
    </div>
  )
}

function Verify({ settings }) {
  if (!settings) return null
  return (
    <p className="text-[11px] text-ink-400 mt-8">
      Verify at {settings.domain} · {settings.supportEmail}
    </p>
  )
}
