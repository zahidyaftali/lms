import { useState } from 'react'
import { Button, EmptyState, Icon, Modal, PageHeader } from '../../components/ui'
import CertificateView from '../../components/course/CertificateView'
import { useData, useSelectors } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { formatDate, fullName } from '../../lib/utils'

export default function Certificates() {
  const { certificates, settings } = useData()
  const { courseById } = useSelectors()
  const { user } = useAuth()
  const [preview, setPreview] = useState(null)

  const mine = certificates.filter((c) => c.userId === user.id)

  return (
    <div>
      <PageHeader title="Certificates" subtitle="Certificates issued for the courses you have completed." />

      {mine.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="certificate"
            title="No certificates yet"
            message="Complete a course to earn your certificate — it will appear here automatically."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 lg:gap-6 stagger">
          {mine.map((c) => {
            const course = courseById(c.courseId)
            return (
              <article key={c.id} className="card card-interactive p-6 flex flex-col">
                <Icon name="certificate" className="w-9 h-9 text-gold-500 mb-4" strokeWidth={1.4} />
                <h3 className="text-[16px] font-semibold leading-6">{course?.name || 'Course'}</h3>
                <p className="hint mt-1.5">Issued {formatDate(c.issuedAt)}</p>
                <p className="text-[12.5px] text-ink-500 mt-0.5">Certificate no. {c.code}</p>
                <div className="mt-5 flex gap-3">
                  <Button size="sm" onClick={() => setPreview({ certificate: c, course })}>
                    View
                  </Button>
                  <Button size="sm" variant="ghost" icon="download" onClick={() => setPreview({ certificate: c, course, print: true })}>
                    Print
                  </Button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <Modal open={!!preview} onClose={() => setPreview(null)} title="Certificate of completion" width="max-w-3xl">
        {preview && (
          <CertificateView
            type={preview.certificate.type || preview.course?.certificateType || 'classic'}
            recipient={fullName(user)}
            courseName={preview.course?.name}
            issuedAt={preview.certificate.issuedAt}
            code={preview.certificate.code}
            settings={settings}
          />
        )}
        <div className="flex justify-end mt-5">
          <Button variant="ghost" icon="download" onClick={() => window.print()}>
            Print certificate
          </Button>
        </div>
      </Modal>
    </div>
  )
}
