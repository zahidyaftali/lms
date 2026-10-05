/**
 * Prices, discounts, coupons, credits and orders.
 *
 * Plain JavaScript with no imports: the server prices every order itself, so a
 * browser can never choose what it pays.
 */

export const CURRENCIES = {
  'US Dollar ($)': 'USD',
  'Euro (€)': 'EUR',
  'British Pound (£)': 'GBP',
  'Canadian Dollar (C$)': 'CAD',
}

export const currencyCode = (settings) => CURRENCIES[settings?.currency] || 'USD'

const round = (n) => Math.round(n * 100) / 100
const DAY = 86400000

/** An active subscription gives access to every paid course without paying for each one. */
export function hasSubscription(user, now = Date.now()) {
  return !!user?.subscribedUntil && new Date(user.subscribedUntil).getTime() > now
}

/** Looks a coupon code up. Returns { coupon } or { error }. */
export function findCoupon(settings, code, now = Date.now()) {
  const wanted = String(code || '').trim().toUpperCase()
  if (!wanted) return { coupon: null }
  const coupon = (settings?.ecommerce?.coupons || []).find((c) => c.code === wanted)
  if (!coupon || !coupon.active) return { error: 'That coupon code is not valid.' }
  if (coupon.expires && now > new Date(`${coupon.expires}T23:59:59`).getTime()) return { error: 'That coupon has expired.' }
  if (Number(coupon.limit) > 0 && (Number(coupon.used) || 0) >= Number(coupon.limit))
    return { error: 'That coupon has been used the maximum number of times.' }
  return { coupon }
}

/**
 * What a learner pays for a course (or for the portal subscription when
 * `kind` is 'subscription'). The global discount comes off first; then the
 * coupon, or, with no coupon, any reward the learner has earned.
 */
export function quote({ kind = 'course', course, user, settings, couponCode, rewardPercent = 0, now = Date.now() }) {
  const e = settings?.ecommerce || {}
  const list = kind === 'subscription' ? Number(e.subscription?.fee) || 0 : Number(course?.price) || 0
  const lines = []
  let total = list

  if (kind === 'course' && list > 0 && hasSubscription(user, now)) {
    return { list, total: 0, lines: [{ label: 'Included in your subscription', amount: -list }], coupon: null, covered: 'subscription' }
  }

  const global = Math.min(100, Number(e.globalDiscount) || 0)
  if (kind === 'course' && global > 0 && total > 0) {
    const off = round((total * global) / 100)
    lines.push({ label: `Portal discount (${global}%)`, amount: -off })
    total = round(total - off)
  }

  const found = findCoupon(settings, couponCode, now)
  if (found.error) return { list, total, lines, coupon: null, error: found.error }
  if (found.coupon && total > 0) {
    const off = round((total * Number(found.coupon.percent || 0)) / 100)
    lines.push({ label: `Coupon ${found.coupon.code} (${found.coupon.percent}%)`, amount: -off })
    total = round(total - off)
  } else if (rewardPercent > 0 && total > 0 && kind === 'course') {
    const off = round((total * rewardPercent) / 100)
    lines.push({ label: `Your reward (${rewardPercent}%)`, amount: -off })
    total = round(total - off)
  }

  return { list, total: Math.max(0, total), lines, coupon: found.coupon || null }
}

/** The ways a learner can pay right now. */
export function paymentMethods(settings, { stripeReady = false } = {}) {
  const e = settings?.ecommerce || {}
  const methods = []
  if (e.processor === 'Stripe' && stripeReady) methods.push({ id: 'stripe', label: 'Pay by card', note: 'Secure checkout with Stripe.' })
  if (e.processor === 'PayPal' && e.paypalEmail) methods.push({ id: 'paypal', label: 'Pay with PayPal', note: 'You are enrolled once the program office confirms the payment.' })
  if (e.offline?.enabled) methods.push({ id: 'offline', label: 'Pay the program office', note: e.offline.instructions || 'You are enrolled once your payment is recorded.' })
  if (e.credits) methods.push({ id: 'credits', label: 'Use credits', note: 'One credit is worth one unit of the portal currency.' })
  return methods
}

export const sellsCourses = (settings) => paymentMethods(settings, { stripeReady: true }).length > 0

export function invoiceNumber(orders, now = Date.now()) {
  const year = new Date(now).getFullYear()
  const count = (orders || []).filter((o) => o.invoiceNo && o.invoiceNo.startsWith(`INV-${year}-`)).length
  return `INV-${year}-${String(count + 1).padStart(4, '0')}`
}

/**
 * The record changes that follow from an order being paid: the learner is
 * enrolled (or their subscription extended), the coupon is counted, credits
 * are taken and an invoice number is issued.
 * Returns { order, user?, enrollment?, settings? } with only what changed.
 */
export function settleOrder(state, order, { now = Date.now(), makeId }) {
  const out = {}
  const at = new Date(now).toISOString()
  const settings = state.settings
  const user = (state.users || []).find((u) => u.id === order.userId)
  let nextUser = user ? { ...user } : null

  out.order = {
    ...order,
    status: 'paid',
    paidAt: at,
    invoiceNo: order.invoiceNo || (Number(order.amount) > 0 ? invoiceNumber(state.orders, now) : ''),
  }

  if (order.method === 'credits' && nextUser) nextUser.credits = round((Number(nextUser.credits) || 0) - Number(order.amount || 0))

  if (order.kind === 'subscription' && nextUser) {
    const sub = settings?.ecommerce?.subscription || {}
    const from = Math.max(now, nextUser.subscribedUntil ? new Date(nextUser.subscribedUntil).getTime() : 0)
    const days = order.trial ? Number(sub.trialDays) || 0 : sub.interval === 'Annually' ? 365 : 30
    nextUser.subscribedUntil = new Date(from + days * DAY).toISOString()
    if (order.trial) nextUser.trialUsed = true
  } else if (order.courseId) {
    const exists = (state.enrollments || []).some((e) => e.userId === order.userId && e.courseId === order.courseId)
    if (!exists) {
      out.enrollment = {
        id: makeId('en'),
        userId: order.userId,
        courseId: order.courseId,
        enrolledAt: at,
        completedUnits: [],
        status: 'not_started',
        score: null,
        completedAt: null,
        timeSpentMin: 0,
        orderId: order.id,
      }
    }
  }

  if (order.coupon) {
    const coupons = (settings?.ecommerce?.coupons || []).map((c) =>
      c.code === order.coupon ? { ...c, used: (Number(c.used) || 0) + 1 } : c,
    )
    out.settings = { ...settings, ecommerce: { ...settings.ecommerce, coupons } }
  }

  if (nextUser && JSON.stringify(nextUser) !== JSON.stringify(user)) out.user = nextUser
  return out
}
