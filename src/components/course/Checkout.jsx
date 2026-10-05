import { useEffect, useState } from 'react'
import { Button, Icon, Input, Modal, Radio } from '../ui'
import { Alert } from '../layout/AuthShell'
import { useData } from '../../context/DataContext'
import { price } from '../../lib/utils'

/**
 * Buying a course, or the portal subscription when `kind` is 'subscription'.
 * The price always comes from the same rules the server uses (src/lib/commerce.js);
 * with the shared database the server works it out and takes the payment.
 */
export default function Checkout({ open, ...props }) {
  if (!open) return null
  return <CheckoutDialog {...props} />
}

function CheckoutDialog({ kind = 'course', course, onClose, onDone }) {
  const { settings, actions } = useData()
  const [coupon, setCoupon] = useState('')
  const [applied, setApplied] = useState('')
  const [info, setInfo] = useState(null)
  const [method, setMethod] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [waiting, setWaiting] = useState(null)

  async function load(code) {
    setError('')
    const res = await actions.getQuote({ kind, courseId: course?.id, coupon: code })
    if (!res.ok) return setError(res.error)
    if (res.quote.error) {
      setError(res.quote.error)
      // The price without the rejected coupon stays on screen.
      if (code) return load('')
    } else setApplied(code)
    setInfo(res)
    setMethod((m) => (res.methods.some((x) => x.id === m) ? m : res.methods[0]?.id || ''))
  }

  useEffect(() => {
    load('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function pay() {
    setBusy(true)
    setError('')
    const res = await actions.checkout({ kind, courseId: course?.id, coupon: applied, method })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    if (res.redirect && res.order?.method !== 'paypal') {
      window.location.href = res.redirect
      return
    }
    if (res.order?.status === 'paid') return onDone(res.order)
    setWaiting(res)
  }

  const title = kind === 'subscription' ? 'Subscribe' : course?.name
  const q = info?.quote
  const free = q && q.total === 0
  const sub = settings.ecommerce?.subscription || {}

  if (waiting) {
    return (
      <Modal open onClose={() => onDone(waiting.order)} title="Order placed" width="max-w-md" footer={<Button onClick={() => onDone(waiting.order)}>Done</Button>}>
        <Alert tone="blue">
          {waiting.order.method === 'paypal'
            ? 'Finish the payment on PayPal. You are enrolled as soon as the program office confirms it has arrived.'
            : 'Your place is reserved. You are enrolled as soon as the program office records your payment.'}
        </Alert>
        {waiting.instructions && <p className="text-[14px] leading-6 whitespace-pre-line mb-4">{waiting.instructions}</p>}
        <p className="text-[14px]">
          Amount due: <strong>{price(waiting.order.amount)}</strong>
        </p>
        {waiting.redirect && (
          <a href={waiting.redirect} target="_blank" rel="noreferrer" className="btn-primary mt-5 w-full">
            Pay with PayPal
          </a>
        )}
      </Modal>
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      subtitle={kind === 'subscription' ? `Access to every paid course, per ${sub.interval === 'Annually' ? 'year' : 'month'}. It does not renew by itself.` : 'Review your order'}
      width="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={pay} disabled={busy || !q || (!free && !method)}>
            {busy ? 'Working…' : free ? (info.trial ? 'Start free trial' : 'Enroll') : `Pay ${price(q?.total)}`}
          </Button>
        </>
      }
    >
      {!q ? (
        <p className="hint">{error || 'Working out the price…'}</p>
      ) : (
        <>
          <dl className="text-[14px] space-y-2 mb-5">
            <div className="flex justify-between gap-4">
              <dt>{kind === 'subscription' ? 'Subscription' : 'Course price'}</dt>
              <dd>{price(q.list)}</dd>
            </div>
            {q.lines.map((line) => (
              <div key={line.label} className="flex justify-between gap-4 text-emerald-700">
                <dt>{line.label}</dt>
                <dd>{line.amount ? `− ${price(-line.amount)}` : ''}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 pt-2.5 border-t border-line font-bold text-[15px]">
              <dt>Total</dt>
              <dd>{price(q.total)}</dd>
            </div>
          </dl>

          {!info.trial && !q.covered && q.list > 0 && settings.ecommerce?.hasCoupons !== false && (
            <div className="flex gap-2.5 mb-5">
              <Input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="Coupon code" className="h-10" />
              <Button variant="outline" size="sm" className="h-10" disabled={!coupon.trim()} onClick={() => load(coupon.trim())}>
                Apply
              </Button>
            </div>
          )}

          {!free && (
            <div className="space-y-2.5">
              <p className="label">How would you like to pay?</p>
              {info.methods.length === 0 && <p className="hint">No way to pay is set up yet. Ask the program office to enroll you.</p>}
              {info.methods.map((m) => (
                <label key={m.id} className="flex items-start gap-3 border border-line rounded-md px-4 py-3 cursor-pointer hover:bg-gray-50">
                  <Radio checked={method === m.id} onChange={() => setMethod(m.id)} className="mt-0.5" />
                  <span>
                    <span className="block text-[14px] text-ink-900">
                      {m.label}
                      {m.id === 'credits' && <span className="text-ink-500"> · you have {info.credits}</span>}
                    </span>
                    <span className="block hint whitespace-pre-line">{m.note}</span>
                  </span>
                </label>
              ))}
            </div>
          )}

          {error && (
            <p className="text-[13px] text-red-600 mt-4 flex items-start gap-2">
              <Icon name="alert" className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </p>
          )}
        </>
      )}
    </Modal>
  )
}
