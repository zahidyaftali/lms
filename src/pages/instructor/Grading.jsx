import { useMemo, useState } from 'react'
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Field,
  Icon,
  Input,
  Modal,
  PageHeader,
  Tabs,
  Textarea,
} from '../../components/ui'
import { useData, useSelectors } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { getFileURL } from '../../lib/fileStore'
import { formatDateTime, fullName } from '../../lib/utils'

export default function Grading() {
  const { submissions, actions } = useData()
  const { userById, courseById, coursesOfInstructor } = useSelectors()
  const { user, view } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('pending')
  const [grading, setGrading] = useState(null)
  const [grade, setGrade] = useState('')
  const [feedback, setFeedback] = useState('')

  const visible = useMemo(() => {
    if (view === 'admin') return submissions
    const ids = coursesOfInstructor(user.id).map((c) => c.id)
    return submissions.filter((s) => ids.includes(s.courseId))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissions, view, user.id])

  const rows = visible.filter((s) => (tab === 'pending' ? s.status === 'pending' : s.status === 'graded'))

  function openGrader(s) {
    setGrading(s)
    setGrade(s.grade != null ? String(s.grade) : s.autoScore != null ? String(s.autoScore) : '')
    setFeedback(s.feedback || '')
  }

  async function openAttachment(fileId) {
    const url = await getFileURL(fileId)
    if (url) window.open(url, '_blank', 'noopener')
  }

  return (
    <div>
      <PageHeader title="Grading" subtitle="Assignments and written test answers submitted by your learners." />

      <Tabs
        tabs={[
          { value: 'pending', label: 'Awaiting review', count: visible.filter((s) => s.status === 'pending').length },
          { value: 'graded', label: 'Graded', count: visible.filter((s) => s.status === 'graded').length },
        ]}
        active={tab}
        onChange={setTab}
        className="mb-6"
      />

      {rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="clipboard"
            title={tab === 'pending' ? 'Nothing to grade' : 'No graded work yet'}
            message={
              tab === 'pending'
                ? 'Submitted assignments and written answers will appear here.'
                : 'Once you grade a submission it moves to this tab.'
            }
          />
        </div>
      ) : (
        <ul className="space-y-4">
          {rows.map((s) => {
            const learner = userById(s.userId)
            const course = courseById(s.courseId)
            const unit = course?.units.find((u) => u.id === s.unitId)
            return (
              <li key={s.id} className="card card-pad">
                <div className="flex flex-wrap items-start gap-4">
                  <Avatar user={learner} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium">{fullName(learner)}</p>
                    <p className="hint">
                      {unit?.name} · {course?.name}
                    </p>
                    <p className="text-[12.5px] text-ink-500 mt-0.5">Submitted {formatDateTime(s.submittedAt)}</p>

                    {s.text && (
                      <p className="text-[14px] text-ink-700 leading-6 mt-3 whitespace-pre-line border-l-2 border-line pl-4">
                        {s.text}
                      </p>
                    )}

                    {s.fileId && (
                      <button onClick={() => openAttachment(s.fileId)} className="link text-[13.5px] mt-3 inline-flex items-center gap-1.5">
                        <Icon name="file" className="w-4 h-4" />
                        {s.fileName || 'Attachment'}
                      </button>
                    )}
                    {!s.fileId && s.fileName && (
                      <p className="text-[13px] text-ink-500 mt-3 inline-flex items-center gap-1.5">
                        <Icon name="file" className="w-4 h-4" />
                        {s.fileName}
                      </p>
                    )}

                    {s.status === 'graded' && (
                      <p className="text-[14px] mt-3">
                        <span className="font-medium">Feedback: </span>
                        {s.feedback || '—'}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <Badge tone={s.status === 'graded' ? 'green' : 'amber'}>
                      {s.status === 'graded' ? `${s.grade}%` : s.autoScore != null ? `Auto score ${s.autoScore}%` : 'Pending'}
                    </Badge>
                    <Button size="sm" variant={s.status === 'graded' ? 'ghost' : 'primary'} onClick={() => openGrader(s)}>
                      {s.status === 'graded' ? 'Edit grade' : 'Grade'}
                    </Button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Modal
        open={!!grading}
        onClose={() => setGrading(null)}
        title="Grade submission"
        subtitle={grading ? fullName(userById(grading.userId)) : ''}
        width="max-w-lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setGrading(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                actions.gradeSubmission(grading.id, Number(grade) || 0, feedback)
                setGrading(null)
                toast('Grade saved and shared with the learner.')
              }}
            >
              Save grade
            </Button>
          </>
        }
      >
        <Field label="Score (%)" required>
          <Input type="number" min="0" max="100" value={grade} onChange={(e) => setGrade(e.target.value)} />
        </Field>
        <Field label="Feedback" hint="The learner sees this on their assignment page.">
          <Textarea rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
        </Field>
      </Modal>
    </div>
  )
}
