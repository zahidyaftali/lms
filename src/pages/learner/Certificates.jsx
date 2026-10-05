import { useState } from 'react'
import { Badge, Button, EmptyState, Icon, Modal, PageHeader } from '../../components/ui'
import CertificateView, { verifyAddress } from '../../components/course/CertificateView'
import { ShareButtons } from '../../components/course/CatalogCourse'
import { useData, useSelectors } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { certificateExpired, certificateExpiry } from '../../lib/rules.js'
import { formatDate, fullName } from '../../lib/utils'
import { useT } from '../../lib/i18n'

export default function Certificates() {
  const { certificates, learningPaths = [], settings } = useData()
  const { courseById } = useSelectors()
  const { user } = useAuth()
  const t = useT()
  const [preview, setPreview] = useState(null)

  const mine = certificates
    .filter((c) => c.userId === user.id)
    .sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : -1))
    .map((certificate) => {
      // A certificate is for a course, or for a whole learning path.
      const subject = certificate.pathId ? learningPaths.find((p) => p.id === certificate.pathId) : courseById(certificate.courseId)
      return {
        certificate,
        name: subject?.name || (certificate.pathId ? t('Learning path') : t('Course')),
        type: certificate.type || subject?.certificateType || 'classic',
        expiresAt: certificateExpiry(certificate, settings),
        expired: certificateExpired(certificate, settings),
      }
    })

  return (
    <div>
      <PageHeader title={t('Certificates')} subtitle={t('Certificates issued for the courses you have completed.')} />

      {mine.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="certificate"
            title={t('No certificates yet')}
            message={t('Complete a course to earn your certificate — it will appear here automatically.')}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 lg:gap-6 stagger">
          {mine.map((item) => (
            <article key={item.certificate.id} className="card card-interactive p-6 flex flex-col">
              <div className="flex items-start justify-between gap-3 mb-4">
                <Icon name="certificate" className="w-9 h-9 text-gold-500" strokeWidth={1.4} />
                {item.expired ? <Badge tone="red">{t('Expired')}</Badge> : item.certificate.pathId ? <Badge tone="blue">{t('Learning path')}</Badge> : null}
              </div>
              <h3 className="text-[16px] font-semibold leading-6">{item.name}</h3>
              <p className="hint mt-1.5">
                {t('Issued')} {formatDate(item.certificate.issuedAt)}
                {item.expiresAt ? ` · ${item.expired ? t('expired') : t('valid until')} ${formatDate(item.expiresAt)}` : ''}
              </p>
              <p className="text-[12.5px] text-ink-500 mt-0.5">
                {t('Certificate no.')} {item.certificate.code}
              </p>
              {settings.courses?.socialSharing && (
                <ShareButtons className="mt-4" url={`${window.location.origin}/verify/${item.certificate.code}`} text={`${t('I earned a certificate for')} ${item.name} — ${settings.siteName}`} />
              )}
              <div className="mt-5 flex gap-3">
                <Button size="sm" onClick={() => setPreview(item)}>
                  {t('View')}
                </Button>
                <Button size="sm" variant="ghost" icon="download" onClick={() => setPreview(item)}>
                  {t('Print')}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal open={!!preview} onClose={() => setPreview(null)} title={t('Certificate of completion')} width="max-w-3xl">
        {preview && (
          <CertificateView
            type={preview.type}
            recipient={fullName(user)}
            courseName={preview.name}
            issuedAt={preview.certificate.issuedAt}
            expiresAt={preview.expiresAt}
            code={preview.certificate.code}
            settings={settings}
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-5">
          <span className="hint">{preview && `${t('Anyone can verify it at')} ${verifyAddress(settings, preview.certificate.code)}`}</span>
          <Button variant="ghost" icon="download" onClick={() => window.print()}>
            {t('Print certificate')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
