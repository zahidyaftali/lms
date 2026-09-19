import { useState } from 'react'
import { Button, EmptyState, Icon, Modal, PageHeader } from '../../components/ui'
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
          <div className="border-4 border-double border-gold-500 p-10 text-center bg-white">
            <p className="text-[11.5px] tracking-[0.3em] uppercase text-gold-600 font-semibold">
              GA Healthcare Training &amp; Consulting
            </p>
            <h3 className="text-[26px] font-semibold mt-6">Certificate of Completion</h3>
            <p className="hint mt-5">This certifies that</p>
            <p className="text-[22px] font-semibold mt-2">{fullName(user)}</p>
            <p className="hint mt-5">has successfully completed</p>
            <p className="text-[18px] font-medium mt-2">{preview.course?.name}</p>
            <div className="flex justify-between items-end mt-12 pt-6 border-t border-line text-left">
              <div>
                <p className="text-[13px] font-medium">{formatDate(preview.certificate.issuedAt)}</p>
                <p className="text-[11.5px] text-ink-500">Date issued</p>
              </div>
              <div className="text-center">
                <p className="text-[13px] font-medium">Dr. Yolaine Nozile, PhD, RN</p>
                <p className="text-[11.5px] text-ink-500">Program Director</p>
              </div>
              <div className="text-right">
                <p className="text-[13px] font-medium">{preview.certificate.code}</p>
                <p className="text-[11.5px] text-ink-500">Certificate number</p>
              </div>
            </div>
            <p className="text-[11px] text-ink-400 mt-8">
              Verify at {settings.domain} · {settings.supportEmail}
            </p>
          </div>
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
