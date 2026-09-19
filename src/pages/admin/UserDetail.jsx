import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  Icon,
  MenuItem,
  PageHeader,
  Progress,
  Tabs,
} from '../../components/ui'
import { EnrollModal } from './Users'
import { useData, useSelectors } from '../../context/DataContext'
import { useToast } from '../../context/ToastContext'
import { duration, formatDate, fullName, randomPassword, timeAgo } from '../../lib/utils'

export default function UserDetail() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { courses, groups, branches, certificates, submissions, actions } = useData()
  const { userById, enrollmentsOf, progressOf, courseById } = useSelectors()
  const toast = useToast()
  const [tab, setTab] = useState('courses')
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [confirm, setConfirm] = useState(null)

  const user = userById(userId)
  if (!user) {
    return (
      <div className="card card-pad">
        <p className="text-[14px]">This user no longer exists.</p>
        <Button className="mt-4" variant="ghost" icon="arrowLeft" onClick={() => navigate('/users')}>
          Back to users
        </Button>
      </div>
    )
  }

  const enrollments = enrollmentsOf(user.id)
  const userCertificates = certificates.filter((c) => c.userId === user.id)
  const userSubmissions = submissions.filter((s) => s.userId === user.id)
  const branch = branches.find((b) => b.id === user.branchId)

  return (
    <div>
      <button onClick={() => navigate('/users')} className="link text-[13.5px] inline-flex items-center gap-1.5 mb-4">
        <Icon name="arrowLeft" className="w-4 h-4" />
        Users
      </button>

      <PageHeader title={fullName(user)} subtitle={user.email}>
        <Button variant="ghost" icon="book" onClick={() => setEnrollOpen(true)}>
          Enroll in course
        </Button>
        <Button
          variant="ghost"
          icon="refresh"
          onClick={() => {
            const password = randomPassword()
            actions.updateUser(user.id, { password })
            toast(`New password for ${user.firstName}: ${password}`, 'info')
          }}
        >
          Reset password
        </Button>
        <Button
          variant={user.active ? 'ghost' : 'primary'}
          icon={user.active ? 'lock' : 'check'}
          onClick={() => actions.updateUser(user.id, { active: !user.active })}
        >
          {user.active ? 'Deactivate' : 'Activate'}
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
        <aside className="card card-pad">
          <div className="flex flex-col items-center text-center pb-5 border-b border-line">
            <Avatar user={user} size={84} />
            <p className="mt-4 text-[17px] font-semibold">{fullName(user)}</p>
            <p className="hint">{user.userType}</p>
            <Badge tone={user.active ? 'green' : 'gray'} className="mt-3">
              {user.active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <dl className="pt-5 space-y-4 text-[13.5px]">
            <Row label="Email" value={user.email} />
            <Row label="Phone" value={user.phone || '-'} />
            <Row label="Branch" value={branch?.name || '-'} />
            <Row
              label="Groups"
              value={(user.groupIds || []).map((id) => groups.find((g) => g.id === id)?.name).filter(Boolean).join(', ') || '-'}
            />
            <Row label="Registered" value={formatDate(user.registeredAt)} />
            <Row label="Last login" value={user.lastLogin ? timeAgo(user.lastLogin) : 'Never'} />
            <Row
              label="Training time"
              value={duration(enrollments.reduce((sum, e) => sum + (e.timeSpentMin || 0), 0))}
            />
          </dl>
          {user.bio && <p className="mt-5 pt-5 border-t border-line text-[13.5px] text-ink-700 leading-6">{user.bio}</p>}
        </aside>

        <section className="card">
          <div className="px-6 pt-5">
            <Tabs
              tabs={[
                { value: 'courses', label: 'Courses', count: enrollments.length },
                { value: 'certificates', label: 'Certificates', count: userCertificates.length },
                { value: 'submissions', label: 'Submissions', count: userSubmissions.length },
              ]}
              active={tab}
              onChange={setTab}
            />
          </div>

          {tab === 'courses' && (
            <DataTable
              columns={[
                {
                  key: 'name',
                  label: 'Course',
                  sortValue: (e) => courseById(e.courseId)?.name,
                  render: (e) => (
                    <button className="link" onClick={() => navigate(`/courses/${e.courseId}`)}>
                      {courseById(e.courseId)?.name || 'Removed course'}
                    </button>
                  ),
                },
                {
                  key: 'progress',
                  label: 'Progress',
                  sortValue: (e) => progressOf(e),
                  render: (e) => (
                    <div className="flex items-center gap-3 w-[180px]">
                      <Progress value={progressOf(e)} className="flex-1" tone={progressOf(e) === 100 ? 'green' : 'brand'} />
                      <span className="text-[13px] text-ink-700 w-10">{progressOf(e)}%</span>
                    </div>
                  ),
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (e) => (
                    <Badge tone={e.status === 'completed' ? 'green' : e.status === 'in_progress' ? 'blue' : 'gray'}>
                      {e.status === 'completed' ? 'Completed' : e.status === 'in_progress' ? 'In progress' : 'Not started'}
                    </Badge>
                  ),
                },
                { key: 'enrolledAt', label: 'Enrolled', render: (e) => formatDate(e.enrolledAt) },
              ]}
              rows={enrollments}
              actions={(e) => (
                <>
                  <MenuItem icon="refresh" onClick={() => actions.resetProgress(user.id, e.courseId)}>
                    Reset progress
                  </MenuItem>
                  <MenuItem
                    icon="trash"
                    danger
                    onClick={() =>
                      setConfirm({
                        title: 'Remove enrollment',
                        message: `Remove ${user.firstName} from ${courseById(e.courseId)?.name}?`,
                        onConfirm: () => actions.unenroll(user.id, e.courseId),
                      })
                    }
                  >
                    Unenroll
                  </MenuItem>
                </>
              )}
            />
          )}

          {tab === 'certificates' && (
            <div className="p-6">
              {userCertificates.length === 0 ? (
                <p className="hint">No certificates issued yet.</p>
              ) : (
                <ul className="space-y-3">
                  {userCertificates.map((c) => (
                    <li key={c.id} className="flex items-center gap-4 border border-line rounded-md px-4 py-3.5">
                      <Icon name="certificate" className="w-6 h-6 text-gold-500" />
                      <span className="flex-1">
                        <span className="block text-[14px] font-medium">{courseById(c.courseId)?.name}</span>
                        <span className="block hint">
                          Issued {formatDate(c.issuedAt)} · {c.code}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === 'submissions' && (
            <div className="p-6">
              {userSubmissions.length === 0 ? (
                <p className="hint">Nothing submitted yet.</p>
              ) : (
                <ul className="space-y-3">
                  {userSubmissions.map((s) => (
                    <li key={s.id} className="border border-line rounded-md px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="flex-1 text-[14px] font-medium">
                          {courseById(s.courseId)?.units.find((u) => u.id === s.unitId)?.name || 'Unit'}
                        </span>
                        <Badge tone={s.status === 'graded' ? 'green' : 'amber'}>
                          {s.status === 'graded' ? `Graded ${s.grade}%` : 'Pending review'}
                        </Badge>
                      </div>
                      <p className="hint mt-1.5">Submitted {timeAgo(s.submittedAt)}</p>
                      {s.feedback && <p className="text-[13px] text-ink-700 mt-2">“{s.feedback}”</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </div>

      <EnrollModal
        open={enrollOpen}
        userIds={[user.id]}
        courses={courses}
        onClose={() => setEnrollOpen(false)}
        onEnroll={(courseIds) => {
          actions.enroll([user.id], courseIds)
          toast('Enrollment updated.')
          setEnrollOpen(false)
        }}
      />

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={confirm?.onConfirm || (() => {})}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel="Remove"
      />
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-500 shrink-0">{label}</dt>
      <dd className="text-ink-900 text-right break-words">{value}</dd>
    </div>
  )
}
