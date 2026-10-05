import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Badge, Button, EmptyState, Field, Icon, Input, Modal, SearchInput, Select } from '../../components/ui'
import Logo from '../../components/layout/Logo'
import { Alert, CenterCard } from '../../components/layout/AuthShell'
import CatalogCourse, { ShareButtons, ratingOf } from '../../components/course/CatalogCourse'
import IntroVideo from '../../components/course/IntroVideo'
import { useData } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { certificateExpired, certificateExpiry } from '../../lib/rules.js'
import { publicCourseURL } from '../../lib/courseAccess'
import { formatDate, price } from '../../lib/utils'
import { useT } from '../../lib/i18n'

/** The bar across the top of the pages visitors see before signing in. */
function PublicHeader() {
  const { settings } = useData()
  const { isAuthenticated } = useAuth()
  const t = useT()
  return (
    <header className="h-16 lg:h-[72px] bg-white border-b border-line flex items-center gap-4 px-4 sm:px-8">
      <Link to="/" className="shrink-0">
        <Logo />
      </Link>
      <nav className="ml-auto flex items-center gap-2 sm:gap-3">
        {settings.courses?.externalCatalog && (
          <Link to="/explore" className="hidden sm:inline-flex px-3 py-2 text-[14px] text-ink-700 hover:text-brand-700">
            {t('Courses')}
          </Link>
        )}
        {isAuthenticated ? (
          <Link to="/" className="btn-primary btn-sm">
            {t('Open the portal')}
          </Link>
        ) : (
          <>
            {settings.users?.selfRegistration && (
              <Link to="/signup" className="btn-ghost btn-sm">
                {t('Create account')}
              </Link>
            )}
            <Link to="/login" className="btn-primary btn-sm">
              {t('Sign in')}
            </Link>
          </>
        )}
      </nav>
    </header>
  )
}

function PublicFooter() {
  const { settings } = useData()
  return (
    <footer className="border-t border-line px-4 sm:px-8 py-6 text-[13px] text-ink-500 flex flex-wrap gap-x-6 gap-y-2 justify-between">
      <span>
        © {new Date().getFullYear()} {settings.siteName}
      </span>
      <span className="flex flex-wrap gap-x-5 gap-y-1">
        {settings.supportEmail && (
          <a className="hover:text-brand-700" href={`mailto:${settings.supportEmail}`}>
            {settings.supportEmail}
          </a>
        )}
        {settings.supportPhone && <span>{settings.supportPhone}</span>}
        <Link to="/verify" className="hover:text-brand-700">
          Verify a certificate
        </Link>
      </span>
    </footer>
  )
}

/** Courses a visitor may browse: from the server's public answer, or this browser's own data. */
function usePublicCatalog() {
  const { publicCatalog, backend, courses, categories, settings, ratings } = useData()
  const { isAuthenticated } = useAuth()
  const on = !!settings.courses?.externalCatalog
  if (backend.mode === 'server' && !isAuthenticated) return { on, courses: publicCatalog?.courses || [], categories: publicCatalog?.categories || [], ratings: [] }
  return { on, courses: courses.filter((c) => c.status === 'active' && c.showInCatalog !== false), categories, ratings }
}

function CourseGrid({ rows, layout, ratings, limit }) {
  const { settings } = useData()
  const { isAuthenticated } = useAuth()
  const t = useT()
  const [preview, setPreview] = useState(null)
  const shown = limit ? rows.slice(0, limit) : rows
  return (
    <>
      <div className={layout === 'List' ? 'space-y-4' : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6'}>
        {shown.map((course) => (
          <CatalogCourse
            key={course.id}
            course={course}
            layout={layout}
            rating={ratingOf(ratings, course.id)}
            priceLabel={Number(course.price) > 0 ? price(course.price) : t('Included')}
            onPreview={() => setPreview(course)}
            share={settings.courses?.socialSharing && <ShareButtons url={course.publicSharing ? publicCourseURL(course.id) : `${window.location.origin}/explore`} text={course.name} />}
          >
            {course.publicSharing ? (
              <Link to={`/share/${course.id}`} className="btn-outline btn-sm">
                {t('Open course')}
              </Link>
            ) : (
              <Link to={isAuthenticated ? '/catalog' : '/login'} className="btn-primary btn-sm">
                {isAuthenticated ? t('View in catalog') : t('Sign in to enroll')}
              </Link>
            )}
          </CatalogCourse>
        ))}
      </div>
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.name} width="max-w-3xl">
        {preview && <IntroVideo video={preview.introVideo} title={`${preview.name} introduction`} />}
      </Modal>
    </>
  )
}

/** The custom homepage visitors land on before signing in (Account & Settings → Portal). */
export function PublicHome() {
  const { settings } = useData()
  const t = useT()
  const catalog = usePublicCatalog()
  const home = settings.homepage || {}
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PublicHeader />
      <section className="bg-navy-900 text-white relative overflow-hidden">
        <div className="absolute -right-24 -top-24 w-[420px] h-[420px] rounded-full border border-white/10" />
        <div className="absolute right-10 top-44 w-[300px] h-[300px] rounded-full border border-white/10" />
        <div className="relative max-w-5xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
          <p className="text-gold-400 text-[13px] font-semibold tracking-[0.2em] uppercase mb-4">{settings.siteName}</p>
          <h1 className="text-[32px] sm:text-[44px] leading-[1.15] font-semibold max-w-3xl">{home.headline?.trim() || t('Build a healthcare career that lasts.')}</h1>
          <p className="text-white/80 text-[15.5px] leading-7 max-w-2xl mt-5 whitespace-pre-line">{home.intro?.trim() || settings.siteDescription}</p>
          <div className="flex flex-wrap gap-3 mt-9">
            <Link to="/login" className="btn bg-white text-navy-900 hover:bg-gray-100">
              {t('Sign in')}
            </Link>
            {settings.users?.selfRegistration && (
              <Link to="/signup" className="btn border border-white/40 text-white hover:bg-white/10">
                {t('Create an account')}
              </Link>
            )}
            {catalog.on && (
              <Link to="/explore" className="btn border border-white/40 text-white hover:bg-white/10">
                {t('Browse courses')}
              </Link>
            )}
          </div>
        </div>
      </section>

      {catalog.on && catalog.courses.length > 0 && (
        <section className="max-w-6xl w-full mx-auto px-5 sm:px-8 py-12">
          <div className="flex items-end justify-between gap-4 mb-6">
            <h2 className="page-title">{t('Our courses')}</h2>
            <Link to="/explore" className="link text-[14px]">
              {t('View all')}
            </Link>
          </div>
          <CourseGrid rows={catalog.courses} layout="Cards" ratings={catalog.ratings} limit={3} />
        </section>
      )}

      <section className="max-w-6xl w-full mx-auto px-5 sm:px-8 py-10 grid sm:grid-cols-3 gap-5 flex-1">
        {[
          ['book', 'Learn at your pace', 'Lessons, videos and documents open on any phone, tablet or computer.'],
          ['clipboard', 'Practice and prove it', 'Tests, assignments and instructor-led sessions track what you have mastered.'],
          ['certificate', 'Earn your certificate', 'Finish a course and your certificate is issued automatically.'],
        ].map(([icon, title, text]) => (
          <div key={title} className="card card-pad">
            <span className="w-10 h-10 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center mb-4">
              <Icon name={icon} className="w-5 h-5" />
            </span>
            <h3 className="card-title mb-1.5">{t(title)}</h3>
            <p className="hint">{t(text)}</p>
          </div>
        ))}
      </section>
      <PublicFooter />
    </div>
  )
}

/** The external catalog: the portal's courses, shown to people who have not signed in. */
export function PublicCatalog() {
  const { settings } = useData()
  const t = useT()
  const catalog = usePublicCatalog()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const q = query.trim().toLowerCase()
  const rows = catalog.courses.filter((c) => (!q || c.name.toLowerCase().includes(q)) && (!category || c.categoryId === category))

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PublicHeader />
      <main className="max-w-6xl w-full mx-auto px-5 sm:px-8 py-10 flex-1">
        <h1 className="page-title">{t('Course catalog')}</h1>
        <p className="hint mt-1.5 mb-6">{settings.siteDescription}</p>
        {!catalog.on ? (
          <div className="card">
            <EmptyState icon="lock" title={t('The catalog is for signed-in learners')} message={t('Sign in to see the courses on offer.')} action={<Link to="/login" className="btn-primary">{t('Sign in')}</Link>} />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <SearchInput value={query} onChange={setQuery} className="w-[250px]" placeholder={t('Search')} />
              <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-[220px]">
                <option value="">{t('All categories')}</option>
                {catalog.categories.map((c) => (
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
              <CourseGrid rows={rows} layout={settings.courses?.catalogLayout} ratings={catalog.ratings} />
            )}
          </>
        )}
      </main>
      <PublicFooter />
    </div>
  )
}

/** The page behind the link in a sign-up confirmation email. */
export function VerifyEmail() {
  const [params] = useSearchParams()
  const { actions, backend } = useData()
  const [state, setState] = useState({ status: 'working', message: '' })

  useEffect(() => {
    if (backend.mode !== 'server') return setState({ status: 'failed', message: 'Email confirmation needs the shared database.' })
    let live = true
    actions.rpc('verifyEmail', { token: params.get('token') || '' }, { refresh: false }).then((res) => {
      if (live) setState(res.ok ? { status: 'done', message: '' } : { status: 'failed', message: res.error })
    })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <CenterCard title={state.status === 'done' ? 'Email confirmed' : state.status === 'failed' ? 'This link did not work' : 'Confirming your email…'}>
      {state.status === 'done' && (
        <>
          <Alert tone="green">Your account is active. You can sign in now.</Alert>
          <Link to="/login" className="btn-primary w-full">
            Sign in
          </Link>
        </>
      )}
      {state.status === 'failed' && (
        <>
          <Alert>{state.message}</Alert>
          <Link to="/login" className="btn-ghost w-full">
            Back to sign in
          </Link>
        </>
      )}
    </CenterCard>
  )
}

/** Anyone can check that a certificate number is real: employers, the state registry, a clinical site. */
export function VerifyCertificate() {
  const { code: fromUrl } = useParams()
  const { actions, backend, certificates, users, courses, learningPaths, settings } = useData()
  const [code, setCode] = useState(fromUrl || '')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function check(value = code) {
    const wanted = value.trim().toUpperCase()
    if (!wanted) return
    setBusy(true)
    setError('')
    setResult(null)
    if (backend.mode === 'server') {
      const res = await actions.rpc('certificate.verify', { code: wanted }, { refresh: false })
      setBusy(false)
      return res.ok ? setResult(res) : setError(res.error)
    }
    const cert = certificates.find((c) => String(c.code).toUpperCase() === wanted)
    const holder = cert && users.find((u) => u.id === cert.userId)
    const subject = cert && (cert.pathId ? learningPaths.find((p) => p.id === cert.pathId) : courses.find((c) => c.id === cert.courseId))
    setBusy(false)
    setResult(
      cert
        ? {
            found: true,
            code: cert.code,
            name: holder ? `${holder.firstName} ${holder.lastName}`.trim() : 'Former learner',
            course: subject?.name || 'A course that is no longer offered',
            issuedAt: cert.issuedAt,
            expiresAt: certificateExpiry(cert, settings),
            expired: certificateExpired(cert, settings),
          }
        : { found: false },
    )
  }

  useEffect(() => {
    if (fromUrl) check(fromUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromUrl])

  return (
    <CenterCard
      title="Verify a certificate"
      subtitle={`Enter the certificate number printed on a certificate from ${settings.siteName}.`}
      footer={
        <Link to="/" className="link">
          Back to the portal
        </Link>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          check()
        }}
      >
        <Field label="Certificate number">
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="GA-CNA-1234" autoCapitalize="characters" />
        </Field>
        <Button type="submit" className="w-full" disabled={busy || !code.trim()}>
          {busy ? 'Checking…' : 'Verify'}
        </Button>
      </form>

      {error && <div className="mt-5"><Alert>{error}</Alert></div>}
      {result && !result.found && (
        <div className="mt-5">
          <Alert>No certificate with that number was issued by this portal. Check the number and try again.</Alert>
        </div>
      )}
      {result?.found && (
        <div className="mt-6 border border-line rounded-md p-5">
          <div className="flex items-center gap-3 mb-4">
            <Icon name="certificate" className="w-7 h-7 text-gold-500" />
            <Badge tone={result.expired ? 'red' : 'green'}>{result.expired ? 'Expired' : 'Valid certificate'}</Badge>
          </div>
          <dl className="space-y-2.5 text-[14px]">
            {[
              ['Awarded to', result.name],
              ['For', result.course],
              ['Certificate number', result.code],
              ['Issued', formatDate(result.issuedAt)],
              ['Valid until', result.expiresAt ? formatDate(result.expiresAt) : 'Does not expire'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-ink-500 shrink-0">{label}</dt>
                <dd className="text-right font-medium break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </CenterCard>
  )
}
