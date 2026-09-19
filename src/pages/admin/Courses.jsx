import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  Drawer,
  Dropdown,
  EmptyState,
  Field,
  Icon,
  Input,
  MenuDivider,
  MenuItem,
  PageHeader,
  SearchInput,
  Select,
  Textarea,
} from '../../components/ui'
import { useData } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatDate, money } from '../../lib/utils'

export default function Courses() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { courses, categories, enrollments, actions } = useData()
  const { user, view } = useAuth()
  const toast = useToast()

  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({ category: '', status: '' })
  const [filterOpen, setFilterOpen] = useState(false)
  const [selected, setSelected] = useState([])
  const [confirm, setConfirm] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [draft, setDraft] = useState({ name: '', code: '', categoryId: '', price: '', description: '' })

  const isInstructorView = view === 'instructor'

  useEffect(() => {
    if (params.get('new') === '1') {
      setCreateOpen(true)
      params.delete('new')
      setParams(params, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return courses.filter((c) => {
      if (isInstructorView && !(c.instructorIds || []).includes(user.id)) return false
      if (q && !`${c.name} ${c.code}`.toLowerCase().includes(q)) return false
      if (filters.category && c.categoryId !== filters.category) return false
      if (filters.status && c.status !== filters.status) return false
      return true
    })
  }, [courses, query, filters, isInstructorView, user.id])

  function createCourse() {
    const course = actions.addCourse({
      name: draft.name.trim() || 'New course',
      code: draft.code.trim(),
      categoryId: draft.categoryId || null,
      price: Number(draft.price) || 0,
      description: draft.description,
      instructorIds: isInstructorView ? [user.id] : [],
    })
    actions.logEvent('course', `created the course ${course.name}`, user.id)
    setCreateOpen(false)
    setDraft({ name: '', code: '', categoryId: '', price: '', description: '' })
    navigate(`/courses/${course.id}`)
  }

  const columns = [
    {
      key: 'name',
      label: 'Course',
      render: (c) => (
        <div className="flex items-center gap-3">
          <button className="link" onClick={() => navigate(`/courses/${c.id}`)}>
            {c.name}
          </button>
          {c.status === 'inactive' && <Badge>Inactive</Badge>}
        </div>
      ),
    },
    { key: 'code', label: 'Code', render: (c) => c.code || '-' },
    {
      key: 'category',
      label: 'Category',
      sortValue: (c) => categories.find((x) => x.id === c.categoryId)?.name || '',
      render: (c) => categories.find((x) => x.id === c.categoryId)?.name || '-',
    },
    { key: 'price', label: 'Price', sortValue: (c) => c.price || 0, render: (c) => money(c.price) },
    {
      key: 'updatedAt',
      label: 'Last updated on',
      sortValue: (c) => new Date(c.updatedAt).getTime(),
      render: (c) => formatDate(c.updatedAt),
    },
  ]

  return (
    <div>
      <PageHeader title={isInstructorView ? 'My courses' : 'Courses'}>
        {!isInstructorView && (
          <div className="flex">
            <Button className="rounded-r-none" onClick={() => setCreateOpen(true)}>
              Add course
            </Button>
            <Dropdown
              trigger={
                <button className="btn-primary rounded-l-none border-l border-white/25 px-3">
                  <Icon name="chevronDown" className="w-4 h-4" strokeWidth={2.4} />
                </button>
              }
            >
              <MenuItem icon="store" onClick={() => navigate('/course-store')}>
                Add from course store
              </MenuItem>
              <MenuItem icon="copy" onClick={() => toast('Pick a course, then use Duplicate from its row menu.', 'info')}>
                Duplicate existing course
              </MenuItem>
            </Dropdown>
          </div>
        )}
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <SearchInput value={query} onChange={setQuery} className="w-[250px]" />
        <button
          onClick={() => setFilterOpen(true)}
          className="relative w-11 h-11 rounded-md flex items-center justify-center text-navy-900 hover:bg-gray-100"
          aria-label="Filters"
        >
          <Icon name="filter" className="w-[22px] h-[22px]" strokeWidth={1.5} />
          {Object.values(filters).filter(Boolean).length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-brand-700 text-white text-[11px] flex items-center justify-center">
              {Object.values(filters).filter(Boolean).length}
            </span>
          )}
        </button>

        {selected.length > 0 && !isInstructorView && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[13px] text-ink-500">{selected.length} selected</span>
            <Button
              size="sm"
              variant="danger"
              icon="trash"
              onClick={() =>
                setConfirm({
                  title: 'Delete courses',
                  message: `Delete ${selected.length} course${selected.length === 1 ? '' : 's'} and all learner progress in them?`,
                  onConfirm: () => {
                    actions.deleteCourses(selected)
                    setSelected([])
                    toast('Courses deleted.')
                  },
                })
              }
            >
              Delete
            </Button>
          </div>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        selectable={!isInstructorView}
        selected={selected}
        onSelectedChange={setSelected}
        defaultSort={{ key: 'name', dir: 'asc' }}
        empty={
          <EmptyState
            icon="book"
            title="No courses yet"
            message="Create your first course and start adding content, tests and clinical sessions."
            action={!isInstructorView && <Button onClick={() => setCreateOpen(true)}>Add course</Button>}
          />
        }
        actions={(c) => (
          <>
            <MenuItem icon="pencil" onClick={() => navigate(`/courses/${c.id}`)}>
              Edit content
            </MenuItem>
            <MenuItem icon="users" onClick={() => navigate(`/courses/${c.id}?panel=users`)}>
              Enrolled users ({enrollments.filter((e) => e.courseId === c.id).length})
            </MenuItem>
            {!isInstructorView && (
              <>
                <MenuItem
                  icon="copy"
                  onClick={() => {
                    const copy = actions.duplicateCourse(c.id)
                    toast(`${copy.name} created.`)
                  }}
                >
                  Duplicate
                </MenuItem>
                <MenuItem
                  icon={c.status === 'active' ? 'lock' : 'check'}
                  onClick={() =>
                    actions.updateCourse(c.id, {
                      status: c.status === 'active' ? 'inactive' : 'active',
                      published: c.status !== 'active',
                    })
                  }
                >
                  {c.status === 'active' ? 'Deactivate' : 'Activate'}
                </MenuItem>
                <MenuDivider />
                <MenuItem
                  icon="trash"
                  danger
                  onClick={() =>
                    setConfirm({
                      title: 'Delete course',
                      message: `Delete ${c.name}? Learner progress in this course will be removed.`,
                      onConfirm: () => {
                        actions.deleteCourses([c.id])
                        toast('Course deleted.')
                      },
                    })
                  }
                >
                  Delete
                </MenuItem>
              </>
            )}
          </>
        )}
      />

      {!isInstructorView && (
        <button
          onClick={() => setCreateOpen(true)}
          className="mt-5 text-navy-900 hover:text-brand-700"
          aria-label="Add course"
          title="Add course"
        >
          <Icon name="bookPlus" className="w-[22px] h-[22px]" strokeWidth={1.5} />
        </button>
      )}

      <Drawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add course"
        subtitle="You can change any of this later in the course settings."
        width="max-w-lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createCourse}>Create &amp; add content</Button>
          </>
        }
      >
        <Field label="Course name" required>
          <Input
            autoFocus
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="e.g. Nursing Assistant Program (CNA)"
          />
        </Field>
        <div className="grid grid-cols-2 gap-x-5">
          <Field label="Course code">
            <Input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} placeholder="NA01" />
          </Field>
          <Field label="Price (USD)">
            <Input
              type="number"
              min="0"
              value={draft.price}
              onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              placeholder="0"
            />
          </Field>
        </div>
        <Field label="Category">
          <Select value={draft.categoryId} onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}>
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Description">
          <Textarea
            rows={4}
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="What learners will be able to do by the end of this course."
          />
        </Field>
      </Drawer>

      <Drawer open={filterOpen} onClose={() => setFilterOpen(false)} title="Filter courses" width="max-w-md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFilters({ category: '', status: '' })}>
              Clear all
            </Button>
            <Button onClick={() => setFilterOpen(false)}>Apply</Button>
          </>
        }
      >
        <Field label="Category">
          <Select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </Field>
      </Drawer>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={confirm?.onConfirm || (() => {})}
        title={confirm?.title}
        message={confirm?.message}
      />
    </div>
  )
}
