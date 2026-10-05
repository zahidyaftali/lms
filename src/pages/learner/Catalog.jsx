import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Badge, Button, EmptyState, Icon, Modal, PageHeader, Progress, SearchInput, Select } from '../../components/ui'
import CatalogCourse, { ShareButtons, ratingOf } from '../../components/course/CatalogCourse'
import Checkout from '../../components/course/Checkout'
import IntroVideo from '../../components/course/IntroVideo'
import { useData, useSelectors } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { canSelfEnroll, isCourseFull, publicCourseURL, timeframeEnded } from '../../lib/courseAccess'
import { hasSubscription, paymentMethods } from '../../lib/commerce.js'
import { pathProgress } from '../../lib/rules.js'
import { formatDate, plural, price } from '../../lib/utils'
import { useT } from '../../lib/i18n'

export default function Catalog() {
  const data = useData()
  const { courses, categories, users, enrollmentRequests, enrollmentCounts, ratings = [], orders = [], learningPaths = [], settings, server, backend, actions } = data
  const { enrollment, enrollmentsIn } = useSelectors()
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const t = useT()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [preview, setPreview] = useState(null)
  const [buying, setBuying] = useState(null)

  const options = settings.courses || {}
  const shop = settings.ecommerce || {}
  // The portal sells courses once there is at least one way to pay.
  const selling = paymentMethods(settings, { stripeReady: backend.mode === 'server' && !!server?.stripe }).length > 0
  const subscribed = hasSubscription(user)

  // Coming back from the card payment page.
  useEffect(() => {
    const orderId = params.get('order')
    const cancelled = params.get('cancelled')
    if (!orderId && !cancelled) return
    const paid = params.get('paid')
    setParams({}, { replace: true })
    if (cancelled) {
      actions.cancelOrder(cancelled)
      toast(t('The payment was cancelled. Nothing was charged.'), 'info')
    } else if (paid) {
      actions.confirmPayment(orderId, paid).then((res) => {
        if (res.ok && res.order?.status === 'paid') toast(t('Payment received — the course is now in My courses.'))
        else toast(res.error || t('The payment has not been confirmed yet. It will appear in My courses once it is.'), 'info')
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const requestFor = (courseId) =>
    (enrollmentRequests || [])
      .filter((r) => r.userId === user.id && r.courseId === courseId)
      .sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt))[0] || null
  const pendingOrder = (courseId) => orders.find((o) => o.userId === user.id && o.courseId === courseId && o.status === 'pending')

  /**
   * Hidden courses never show. A full course, or one whose timeframe has
   * ended, stays visible only to learners already enrolled or waiting on a request.
   */
  const q = query.trim().toLowerCase()
  const rows = courses.filter((c) => {
    if (c.status !== 'active' || c.showInCatalog === false) return false
    if (q && !c.name.toLowerCase().includes(q)) return false
    if (category && c.categoryId !== category) return false
    const involved = !!enrollment(user.id, c.id) || requestFor(c.id)?.status === 'pending' || !!pendingOrder(c.id)
    const enrolledCount = enrollmentCounts?.[c.id] ?? enrollmentsIn(c.id).length
    if (!involved && (isCourseFull(c, enrolledCount) || timeframeEnded(c))) return false
    return true
  })

  const paths = learningPaths.filter((p) => p.status === 'active' && p.selfEnroll && (p.courseIds || []).some((id) => courses.some((c) => c.id === id)))

  function request(course) {
    actions.requestEnrollment(user.id, course.id)
    const admin = users.find((u) => u.role === 'superadmin') || users.find((u) => u.role === 'admin')
    if (admin) {
      actions.messages.add({
        fromId: user.id,
        toId: admin.id,
        subject: `Enrollment request: ${course.name}`,
        body: `${user.firstName} ${user.lastName} would like to be enrolled in ${course.name}.`,
        sentAt: new Date().toISOString(),
        read: false,
      })
    }
    actions.logEvent('user', `requested enrollment in ${course.name}`, user.id)
    toast(t('Request sent — the program office will review it.'))
  }

  function enrollNow(course) {
    actions.enroll([user.id], [course.id])
    actions.logEvent('user', `enrolled in ${course.name}`, user.id)
    toast(t('You are enrolled — the course is now in My courses.'))
  }

  /** The button under a course, for someone who is not in it yet. */
  function action(course) {
    const pending = requestFor(course.id)
    const order = pendingOrder(course.id)
    const paid = Number(course.price) > 0
    if (order) {
      return (
        <span className="flex items-center gap-2">
          <Badge tone="amber">
            <Icon name="clock" className="w-3.5 h-3.5 mr-1" />
            {t('Awaiting payment')}
          </Badge>
          <button className="link text-[12.5px]" onClick={() => actions.cancelOrder(order.id)}>
            {t('Cancel')}
          </button>
        </span>
      )
    }
    if (pending?.status === 'pending')
      return (
        <Badge tone="amber">
          <Icon name="clock" className="w-3.5 h-3.5 mr-1" />
          {t('Awaiting approval')}
        </Badge>
      )
    if (paid && selling) {
      return (
        <Button size="sm" icon={subscribed ? undefined : 'cart'} onClick={() => setBuying({ kind: 'course', course })}>
          {subscribed ? t('Enroll') : t('Buy')}
        </Button>
      )
    }
    if (canSelfEnroll(course, settings))
      return (
        <Button size="sm" onClick={() => enrollNow(course)}>
          {t('Enroll')}
        </Button>
      )
    return (
      <Button size="sm" variant="outline" onClick={() => request(course)}>
        {pending?.status === 'declined' ? t('Request again') : t('Request enrollment')}
      </Button>
    )
  }

  const discount = Math.min(100, Number(shop.globalDiscount) || 0)
  const priceOf = (course) => {
    const list = Number(course.price) || 0
    if (!list) return { label: t('Included') }
    if (subscribed && selling) return { label: t('Included in your subscription'), was: price(list) }
    if (discount > 0 && selling) return { label: price(Math.round(list * (100 - discount)) / 100), was: price(list) }
    return { label: price(list) }
  }

  return (
    <div>
      <PageHeader
        title={t('Course catalog')}
        subtitle={selling ? t('Everything GA Healthcare Training currently offers.') : t('Everything GA Healthcare Training currently offers. Enrollment is handled by the program office.')}
      />

      {shop.subscription?.enabled && selling && (
        <div className="card card-pad mb-6 flex flex-wrap items-center gap-4 border-brand-100 bg-brand-50/50">
          <span className="w-11 h-11 rounded-md bg-white text-brand-700 flex items-center justify-center shrink-0 border border-brand-100">
            <Icon name="card" className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-[220px]">
            <p className="text-[15px] font-semibold">
              {subscribed ? t('Your subscription is active') : `${t('Every paid course for')} ${price(shop.subscription.fee)} / ${shop.subscription.interval === 'Annually' ? t('year') : t('month')}`}
            </p>
            <p className="hint">
              {subscribed
                ? `${t('Access to every paid course until')} ${formatDate(user.subscribedUntil)}.`
                : Number(shop.subscription.trialDays) > 0 && !user.trialUsed
                  ? `${t('Start with a free trial of')} ${plural(Number(shop.subscription.trialDays), 'day')}.`
                  : t('Subscribe once and enroll in any paid course at no extra cost.')}
            </p>
          </div>
          <Button variant={subscribed ? 'ghost' : 'primary'} onClick={() => setBuying({ kind: 'subscription' })}>
            {subscribed ? t('Extend') : t('Subscribe')}
          </Button>
        </div>
      )}

      {paths.length > 0 && (
        <section className="mb-8">
          <h2 className="card-title mb-4">{t('Learning paths')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {paths.map((path) => {
              const joined = (path.userIds || []).includes(user.id)
              const p = pathProgress(path, user.id, data)
              return (
                <article key={path.id} className="card card-pad flex flex-col">
                  <div className="flex items-start gap-3 mb-2">
                    <span className="w-10 h-10 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                      <Icon name="route" className="w-5 h-5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[15.5px] font-semibold leading-6">{path.name}</h3>
                      <p className="hint">
                        {plural(p.total, 'course')}
                        {path.ordered ? ` · ${t('taken in order')}` : ''}
                        {path.certificate ? ` · ${t('certificate')}` : ''}
                      </p>
                    </div>
                  </div>
                  {path.description && <p className="hint line-clamp-3 mb-4">{path.description}</p>}
                  <div className="mt-auto flex items-center gap-3">
                    {joined ? (
                      <>
                        <Progress value={p.total ? (p.done / p.total) * 100 : 0} className="flex-1" />
                        <Button size="sm" variant="ghost" onClick={() => navigate('/my-paths')}>
                          {t('Open')}
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        className="ml-auto"
                        onClick={async () => {
                          const res = await actions.joinPath(path.id, user.id)
                          if (res?.ok === false) toast(res.error, 'error')
                          else toast(t('You joined the learning path. Its first courses are in My courses.'))
                        }}
                      >
                        {t('Join path')}
                      </Button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <SearchInput value={query} onChange={setQuery} className="w-[250px]" placeholder={t('Search')} />
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-[220px]">
          <option value="">{t('All categories')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <EmptyState icon="store" title={t('No courses found')} message={t('Try a different search or category.')} />
        </div>
      ) : (
        <div className={options.catalogLayout === 'List' ? 'space-y-4' : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 stagger'}>
          {rows.map((course) => {
            const p = priceOf(course)
            return (
              <CatalogCourse
                key={course.id}
                course={course}
                layout={options.catalogLayout}
                rating={options.ratings ? ratingOf(ratings, course.id) : null}
                priceLabel={p.label}
                was={p.was}
                onPreview={() => setPreview(course)}
                share={
                  options.socialSharing && (
                    <ShareButtons url={course.publicSharing ? publicCourseURL(course.id) : `${window.location.origin}/explore`} text={`${course.name} — ${settings.siteName}`} />
                  )
                }
              >
                {enrollment(user.id, course.id) ? (
                  <Badge tone="green">
                    <Icon name="check" className="w-3.5 h-3.5 mr-1" strokeWidth={3} />
                    {t('Enrolled')}
                  </Badge>
                ) : (
                  action(course)
                )}
              </CatalogCourse>
            )
          })}
        </div>
      )}

      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.name} width="max-w-3xl">
        {preview && <IntroVideo video={preview.introVideo} title={`${preview.name} introduction`} />}
      </Modal>

      <Checkout
        open={!!buying}
        kind={buying?.kind}
        course={buying?.course}
        onClose={() => setBuying(null)}
        onDone={(order) => {
          setBuying(null)
          if (order?.status === 'paid') toast(order.kind === 'subscription' ? t('Your subscription is active.') : t('You are enrolled — the course is now in My courses.'))
        }}
      />
    </div>
  )
}
