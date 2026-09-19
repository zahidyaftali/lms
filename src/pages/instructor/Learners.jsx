import { useMemo, useState } from 'react'
import {
  Avatar,
  Badge,
  Button,
  DataTable,
  Drawer,
  EmptyState,
  MenuItem,
  PageHeader,
  Progress,
  SearchInput,
  Select,
} from '../../components/ui'
import { useData, useSelectors } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { duration, formatDate, fullName, timeAgo, toCSV, download } from '../../lib/utils'

export default function InstructorLearners() {
  const { enrollments, actions } = useData()
  const { coursesOfInstructor, userById, courseById, progressOf } = useSelectors()
  const { user } = useAuth()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [courseFilter, setCourseFilter] = useState('')
  const [detail, setDetail] = useState(null)

  const courses = coursesOfInstructor(user.id)
  const courseIds = courses.map((c) => c.id)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return enrollments
      .filter((e) => courseIds.includes(e.courseId))
      .filter((e) => !courseFilter || e.courseId === courseFilter)
      .map((e) => ({ ...e, learner: userById(e.userId), course: courseById(e.courseId) }))
      .filter((r) => r.learner && (!q || fullName(r.learner).toLowerCase().includes(q)))
  }, [enrollments, courseIds, courseFilter, query, userById, courseById])

  return (
    <div>
      <PageHeader title="Learners" subtitle="Everyone enrolled in the courses you teach.">
        <Button
          variant="ghost"
          icon="download"
          onClick={() =>
            download(
              'learners.csv',
              toCSV(rows, [
                { label: 'Learner', value: (r) => fullName(r.learner) },
                { label: 'Email', value: (r) => r.learner.email },
                { label: 'Course', value: (r) => r.course?.name },
                { label: 'Progress %', value: (r) => progressOf(r) },
                { label: 'Status', value: (r) => r.status },
              ]),
            )
          }
        >
          Export
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <SearchInput value={query} onChange={setQuery} className="w-[250px]" />
        <Select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="w-[260px]">
          <option value="">All my courses</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <DataTable
        rows={rows}
        onRowClick={setDetail}
        empty={<EmptyState icon="users" title="No learners yet" message="Learners appear here once they are enrolled in your courses." />}
        columns={[
          {
            key: 'learner',
            label: 'Learner',
            sortValue: (r) => fullName(r.learner),
            render: (r) => (
              <div className="flex items-center gap-3">
                <Avatar user={r.learner} size={32} />
                <span>
                  <span className="block">{fullName(r.learner)}</span>
                  <span className="block text-[12.5px] text-ink-500">{r.learner.email}</span>
                </span>
              </div>
            ),
          },
          { key: 'course', label: 'Course', sortValue: (r) => r.course?.name, render: (r) => r.course?.name },
          {
            key: 'progress',
            label: 'Progress',
            sortValue: (r) => progressOf(r),
            render: (r) => (
              <div className="flex items-center gap-3 w-[170px]">
                <Progress value={progressOf(r)} className="flex-1" tone={progressOf(r) === 100 ? 'green' : 'brand'} />
                <span className="text-[13px] w-9">{progressOf(r)}%</span>
              </div>
            ),
          },
          {
            key: 'status',
            label: 'Status',
            render: (r) => (
              <Badge tone={r.status === 'completed' ? 'green' : r.status === 'in_progress' ? 'blue' : 'gray'}>
                {r.status === 'completed' ? 'Completed' : r.status === 'in_progress' ? 'In progress' : 'Not started'}
              </Badge>
            ),
          },
          {
            key: 'lastLogin',
            label: 'Last login',
            sortValue: (r) => (r.learner.lastLogin ? new Date(r.learner.lastLogin).getTime() : 0),
            render: (r) => (r.learner.lastLogin ? timeAgo(r.learner.lastLogin) : '-'),
          },
        ]}
        actions={(r) => (
          <>
            <MenuItem icon="eye" onClick={() => setDetail(r)}>
              View progress
            </MenuItem>
            <MenuItem
              icon="refresh"
              onClick={() => {
                actions.resetProgress(r.userId, r.courseId)
                toast('Progress reset.')
              }}
            >
              Reset progress
            </MenuItem>
          </>
        )}
      />

      <Drawer
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? fullName(detail.learner) : ''}
        subtitle={detail?.course?.name}
        width="max-w-2xl"
        footer={<Button onClick={() => setDetail(null)}>Close</Button>}
      >
        {detail && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <Stat label="Progress" value={`${progressOf(detail)}%`} />
              <Stat label="Training time" value={duration(detail.timeSpentMin)} />
              <Stat label="Enrolled" value={formatDate(detail.enrolledAt)} />
            </div>

            <h4 className="text-[15px] font-semibold mb-3">Units</h4>
            <ul className="divide-y divide-line">
              {(detail.course?.units || [])
                .filter((u) => u.type !== 'section')
                .map((u) => (
                  <li key={u.id} className="py-3 flex items-center gap-3">
                    <span className="flex-1 text-[14px]">{u.name}</span>
                    <Badge tone={detail.completedUnits.includes(u.id) ? 'green' : 'gray'}>
                      {detail.completedUnits.includes(u.id) ? 'Completed' : 'Pending'}
                    </Badge>
                  </li>
                ))}
            </ul>
          </>
        )}
      </Drawer>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="border border-line rounded-md px-4 py-3">
      <p className="hint">{label}</p>
      <p className="text-[18px] font-semibold mt-0.5">{value}</p>
    </div>
  )
}
