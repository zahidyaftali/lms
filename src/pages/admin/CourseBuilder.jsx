import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  Drawer,
  Field,
  Icon,
  Input,
  Modal,
  OptionList,
  Progress,
  Select,
  Tabs,
  Textarea,
  Toggle,
} from '../../components/ui'
import CourseHero from '../../components/course/CourseHero'
import UnitEditor from '../../components/course/UnitEditor'
import { DEFAULT_UNIT_DATA, unitIcon, unitLabel } from '../../components/course/unitTypes'
import { useData, useSelectors } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { cx, fileSize, formatDate, fullName, money } from '../../lib/utils'

const ADD_MENU = [
  {
    key: 'studio',
    label: 'Content Studio',
    hint: 'Start a rich lesson from a template',
    icon: 'sparkles',
  },
  {
    key: 'standard',
    label: 'Standard Content',
    hint: 'Add Text, Video, Presentation, etc',
    icon: 'file',
    items: ['content', 'webcontent', 'video', 'audio', 'document', 'iframe'],
  },
  {
    key: 'activity',
    label: 'Learning Activities',
    hint: 'Add Test, Scorm, Survey, ILT etc',
    icon: 'report',
    items: ['test', 'survey', 'assignment', 'ilt', 'scorm'],
  },
  {
    key: 'more',
    label: 'More',
    hint: 'Add section, clone units, etc',
    icon: 'grid',
    items: ['section', 'clone', 'link'],
  },
]

export default function CourseBuilder() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { courses, users, enrollments, categories, actions } = useData()
  const { progressOf } = useSelectors()
  const { user, view } = useAuth()
  const toast = useToast()

  const course = courses.find((c) => c.id === courseId)

  const [tab, setTab] = useState('content')
  const [addOpen, setAddOpen] = useState(false)
  const [submenu, setSubmenu] = useState(null)
  const [editingUnit, setEditingUnit] = useState(null)
  const [panel, setPanel] = useState(params.get('panel') || null)
  const [confirm, setConfirm] = useState(null)
  const [cloneFrom, setCloneFrom] = useState(null)
  const addRef = useRef(null)

  useEffect(() => {
    const onClick = (e) => {
      if (addRef.current && !addRef.current.contains(e.target)) {
        setAddOpen(false)
        setSubmenu(null)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const files = useMemo(() => {
    if (!course) return []
    return course.units
      .filter((u) => u.data?.fileName)
      .map((u) => ({ id: u.id, unit: u.name, name: u.data.fileName, size: u.data.fileSize, type: unitLabel(u.type) }))
  }, [course])

  if (!course) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-[15px] mb-4">This course no longer exists.</p>
          <Button onClick={() => navigate('/courses')}>Back to courses</Button>
        </div>
      </div>
    )
  }

  const canEdit = view === 'admin' || (course.instructorIds || []).includes(user.id)
  const contentUnits = course.units.filter((u) => u.type !== 'section')
  const courseEnrollments = enrollments.filter((e) => e.courseId === course.id)

  function addUnit(type) {
    setAddOpen(false)
    setSubmenu(null)

    if (type === 'clone') {
      setCloneFrom({ mode: 'clone' })
      return
    }
    if (type === 'link') {
      setCloneFrom({ mode: 'link' })
      return
    }

    const unit = actions.addUnit(course.id, {
      type,
      name: type === 'section' ? 'New section' : `New ${unitLabel(type).toLowerCase()}`,
      data: structuredClone(DEFAULT_UNIT_DATA[type] || {}),
    })
    if (type !== 'section') setEditingUnit(unit)
  }

  function addStudioUnit() {
    setAddOpen(false)
    setSubmenu(null)
    const unit = actions.addUnit(course.id, {
      type: 'content',
      name: 'New lesson',
      data: {
        html:
          '<h2>Lesson title</h2><p>Open with why this matters on the unit floor.</p><h3>Key points</h3><ul><li>First key point</li><li>Second key point</li><li>Third key point</li></ul><h3>Check yourself</h3><p>Describe how you would apply this with a resident today.</p>',
      },
    })
    setEditingUnit(unit)
  }

  return (
    <div className="min-h-screen lg:h-screen flex flex-col lg:flex-row bg-white">
      {/* ------------------------------------------------------ left panel */}
      <aside className="w-full lg:w-[400px] shrink-0 border-b lg:border-b-0 lg:border-r border-line flex flex-col">
        <div className="h-[66px] bg-navy-900 flex items-center gap-3 px-4 shrink-0">
          <button
            onClick={() => navigate('/courses')}
            className="w-10 h-10 rounded-md bg-navy-600 text-white flex items-center justify-center hover:bg-navy-500"
            aria-label="Close builder"
          >
            <Icon name="menu" className="w-5 h-5" strokeWidth={1.8} />
          </button>
          <button
            disabled={!canEdit}
            onClick={() => {
              const next = !course.published
              actions.updateCourse(course.id, { published: next, status: next ? 'active' : 'inactive' })
              toast(next ? 'Course published — learners can now access it.' : 'Course unpublished.')
            }}
            className={cx(
              'h-10 px-6 rounded-md text-[14px] font-medium transition',
              course.published
                ? 'bg-white/10 text-white/70 hover:bg-white/20'
                : 'bg-white text-navy-900 hover:bg-white/90',
            )}
          >
            {course.published ? 'Unpublish' : 'Publish'}
          </button>
        </div>

        <button
          onClick={() => navigate('/courses')}
          className="px-5 py-3 text-left text-[14px] text-brand-700 border-b border-line bg-gray-50 hover:bg-gray-100"
        >
          Back
        </button>

        <div className="px-5 py-4 border-b border-line">
          <input
            value={course.name}
            disabled={!canEdit}
            onChange={(e) => actions.updateCourse(course.id, { name: e.target.value })}
            className="w-full text-[18px] font-semibold text-ink-900 outline-none border-b border-transparent focus:border-brand-700 pb-1 mb-4 bg-transparent"
          />

          <div className="flex items-center gap-2.5">
            <div className="relative" ref={addRef}>
              <Button icon="plus" disabled={!canEdit} onClick={() => setAddOpen((v) => !v)}>
                Add
              </Button>

              {addOpen && (
                <div className="absolute left-0 top-[52px] z-40 w-[300px] sm:w-[370px] max-w-[calc(100vw-40px)] bg-white border border-line rounded-md shadow-pop py-2 animate-scale-in origin-top-left">
                  {ADD_MENU.map((group) => (
                    <div key={group.key} className="relative">
                      <button
                        onMouseEnter={() => setSubmenu(group.items ? group.key : null)}
                        onClick={() => (group.items ? setSubmenu(group.key) : addStudioUnit())}
                        className={cx(
                          'w-full flex items-center gap-3.5 px-5 py-3 text-left hover:bg-gray-50',
                          submenu === group.key && 'bg-gray-50',
                          group.key === 'studio' && 'border-b border-line',
                        )}
                      >
                        <Icon name={group.icon} className="w-[22px] h-[22px] text-ink-700 shrink-0" strokeWidth={1.5} />
                        <span className="flex-1">
                          <span className="block text-[14px] font-medium text-ink-900">{group.label}</span>
                          <span className="block text-[12.5px] text-ink-500">{group.hint}</span>
                        </span>
                        {group.items && <Icon name="chevronRight" className="w-4 h-4 text-ink-500" strokeWidth={2.2} />}
                      </button>

                      {submenu === group.key && group.items && (
                        <div className="absolute z-50 left-0 top-full mt-1 sm:left-[298px] lg:left-[368px] sm:top-0 sm:mt-0 w-[240px] max-w-[calc(100vw-40px)] bg-white border border-line rounded-md shadow-pop py-2 animate-scale-in">
                          {group.items.map((item) => (
                            <button
                              key={item}
                              onClick={() => addUnit(item)}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 text-[13.5px]"
                            >
                              <Icon
                                name={
                                  item === 'clone' ? 'copy' : item === 'link' ? 'link' : unitIcon(item)
                                }
                                className="w-[18px] h-[18px] text-ink-700"
                                strokeWidth={1.5}
                              />
                              {item === 'clone'
                                ? 'Clone from another course'
                                : item === 'link'
                                  ? 'Link from another course'
                                  : unitLabel(item)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <IconButton icon="users" title="Enrolled users" onClick={() => setPanel('users')} />
            <IconButton
              icon="copy"
              title="Duplicate course"
              onClick={() => {
                const copy = actions.duplicateCourse(course.id)
                toast(`${copy.name} created.`)
                navigate(`/courses/${copy.id}`)
              }}
            />
            <IconButton icon="settings" title="Course settings" onClick={() => setPanel('settings')} />
          </div>
        </div>

        <div className="max-h-[50vh] lg:max-h-none lg:flex-1 overflow-y-auto scroll-thin">
          {course.units.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <Icon name="bookPlus" className="w-8 h-8 mx-auto text-brand-700 mb-3" strokeWidth={1.4} />
              <p className="text-[14.5px] font-semibold text-brand-700">Add content to your course</p>
              <p className="hint mt-1.5">
                Drag and drop files here, or click the Add button above, to build your course.
              </p>
            </div>
          ) : (
            <ul className="py-2">
              {course.units.map((unit, index) => (
                <li key={unit.id}>
                  {unit.type === 'section' ? (
                    <div className="px-5 py-3 mt-1 flex items-center gap-2 group">
                      <Icon name="quote" className="w-4 h-4 text-ink-400" />
                      <span className="flex-1 text-[12.5px] font-semibold uppercase tracking-wide text-ink-500 truncate">
                        {unit.name}
                      </span>
                      <UnitRowActions
                        canEdit={canEdit}
                        onEdit={() => setEditingUnit(unit)}
                        onUp={() => actions.moveUnit(course.id, unit.id, -1)}
                        onDown={() => actions.moveUnit(course.id, unit.id, 1)}
                        onDelete={() =>
                          setConfirm({
                            title: 'Delete section',
                            message: `Delete “${unit.name}”?`,
                            onConfirm: () => actions.deleteUnit(course.id, unit.id),
                          })
                        }
                      />
                    </div>
                  ) : (
                    <div className="px-5 py-2.5 flex items-center gap-3 hover:bg-gray-50 group">
                      <span className="w-8 h-8 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                        <Icon name={unitIcon(unit.type)} className="w-[17px] h-[17px]" strokeWidth={1.6} />
                      </span>
                      <button onClick={() => setEditingUnit(unit)} className="flex-1 text-left min-w-0">
                        <span className="block text-[14px] text-ink-900 truncate">{unit.name}</span>
                        <span className="block text-[12px] text-ink-500">{unitLabel(unit.type)}</span>
                      </button>
                      <UnitRowActions
                        canEdit={canEdit}
                        onEdit={() => setEditingUnit(unit)}
                        onUp={() => actions.moveUnit(course.id, unit.id, -1)}
                        onDown={() => actions.moveUnit(course.id, unit.id, 1)}
                        onDelete={() =>
                          setConfirm({
                            title: 'Delete unit',
                            message: `Delete “${unit.name}”? Learner progress for this unit is removed.`,
                            onConfirm: () => actions.deleteUnit(course.id, unit.id),
                          })
                        }
                      />
                      <span className="sr-only">{index}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* ----------------------------------------------------- right panel */}
      <div className="flex-1 min-w-0 lg:overflow-y-auto scroll-thin">
        <CourseHero course={course} className="min-h-[190px] lg:min-h-[230px] flex items-center" />

        <div className="max-w-[880px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          <textarea
            value={course.description}
            disabled={!canEdit}
            placeholder="Add a course description up to 5000 characters"
            maxLength={5000}
            rows={course.description ? 3 : 1}
            onChange={(e) => actions.updateCourse(course.id, { description: e.target.value })}
            className="w-full resize-none text-[15px] leading-7 text-ink-700 placeholder:text-ink-400 outline-none bg-transparent mb-8"
          />

          <div className="card">
            <div className="px-6 pt-5 flex items-end justify-between gap-4">
              <Tabs
                tabs={[
                  { value: 'content', label: 'Content' },
                  { value: 'files', label: 'Files', count: files.length },
                ]}
                active={tab}
                onChange={setTab}
                className="flex-1"
              />
              <p className="text-[12.5px] text-ink-500 pb-3 whitespace-nowrap">{course.completionRule}</p>
            </div>

            {tab === 'content' &&
              (course.units.length === 0 ? (
                <div className="py-16 text-center">
                  <Icon name="bookPlus" className="w-8 h-8 mx-auto text-brand-700 mb-3" strokeWidth={1.4} />
                  <p className="text-[15px] font-semibold text-brand-700">This course is empty</p>
                  <p className="hint mt-1.5">
                    Drag and drop files here, or click the Add button to the left, to build your course.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-line/70">
                  {course.units.map((unit) =>
                    unit.type === 'section' ? (
                      <li key={unit.id} className="px-6 py-3 bg-gray-50">
                        <span className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-500">
                          {unit.name}
                        </span>
                      </li>
                    ) : (
                      <li key={unit.id} className="px-6 py-4 flex items-center gap-4">
                        <span className="w-9 h-9 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                          <Icon name={unitIcon(unit.type)} className="w-[18px] h-[18px]" strokeWidth={1.6} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[14.5px] text-ink-900 truncate">{unit.name}</span>
                          <span className="block text-[12.5px] text-ink-500">
                            {unitLabel(unit.type)}
                            {unit.type === 'test' && ` · ${(unit.data?.questions || []).length} questions`}
                            {unit.type === 'ilt' && ` · ${(unit.data?.sessions || []).length} sessions`}
                          </span>
                        </span>
                        <Button size="sm" variant="ghost" onClick={() => setEditingUnit(unit)} disabled={!canEdit}>
                          Edit
                        </Button>
                      </li>
                    ),
                  )}
                </ul>
              ))}

            {tab === 'files' &&
              (files.length === 0 ? (
                <div className="py-14 text-center">
                  <Icon name="folder" className="w-8 h-8 mx-auto text-ink-400 mb-3" strokeWidth={1.4} />
                  <p className="hint">No files uploaded to this course yet.</p>
                </div>
              ) : (
                <ul className="divide-y divide-line/70">
                  {files.map((f) => (
                    <li key={f.id} className="px-6 py-4 flex items-center gap-4">
                      <Icon name="file" className="w-5 h-5 text-ink-700" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[14px] truncate">{f.name}</span>
                        <span className="block text-[12.5px] text-ink-500">
                          {f.type} · {f.unit}
                        </span>
                      </span>
                      {f.size ? <span className="text-[12.5px] text-ink-500">{fileSize(f.size)}</span> : null}
                    </li>
                  ))}
                </ul>
              ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            <Stat label="Units" value={contentUnits.length} />
            <Stat label="Enrolled" value={courseEnrollments.length} />
            <Stat
              label="Completed"
              value={courseEnrollments.filter((e) => e.status === 'completed').length}
            />
            <Stat label="Price" value={money(course.price)} />
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------- editors */}
      <UnitEditor
        open={!!editingUnit}
        unit={editingUnit}
        onClose={() => setEditingUnit(null)}
        onSave={(changes) => {
          actions.updateUnit(course.id, editingUnit.id, changes)
          setEditingUnit(null)
          toast('Unit saved.')
        }}
      />

      <CourseUsersPanel
        open={panel === 'users'}
        course={course}
        onClose={() => setPanel(null)}
        users={users}
        enrollments={courseEnrollments}
        progressOf={progressOf}
        actions={actions}
        toast={toast}
      />

      <CourseSettingsPanel
        open={panel === 'settings'}
        course={course}
        categories={categories}
        instructors={users.filter((u) => u.role === 'instructor' || u.role === 'admin' || u.role === 'superadmin')}
        onClose={() => setPanel(null)}
        onSave={(changes) => {
          actions.updateCourse(course.id, changes)
          setPanel(null)
          toast('Course settings saved.')
        }}
      />

      <CloneUnitsModal
        open={!!cloneFrom}
        mode={cloneFrom?.mode}
        courses={courses.filter((c) => c.id !== course.id)}
        onClose={() => setCloneFrom(null)}
        onPick={(units, mode) => {
          units.forEach((u) =>
            actions.addUnit(course.id, {
              type: u.type,
              name: mode === 'link' ? `${u.name} (linked)` : u.name,
              data: structuredClone(u.data || {}),
              linkedFrom: mode === 'link' ? u.id : undefined,
            }),
          )
          setCloneFrom(null)
          toast(`${units.length} unit${units.length === 1 ? '' : 's'} added.`)
        }}
      />

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

function IconButton({ icon, title, onClick }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="w-11 h-11 rounded-md border border-line text-ink-700 flex items-center justify-center hover:bg-gray-50 hover:text-brand-700"
    >
      <Icon name={icon} className="w-[19px] h-[19px]" strokeWidth={1.6} />
    </button>
  )
}

function UnitRowActions({ canEdit, onEdit, onUp, onDown, onDelete }) {
  if (!canEdit) return null
  return (
    <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
      <button onClick={onUp} className="p-1 rounded text-ink-400 hover:text-ink-900" title="Move up">
        <Icon name="chevronUp" className="w-4 h-4" strokeWidth={2.2} />
      </button>
      <button onClick={onDown} className="p-1 rounded text-ink-400 hover:text-ink-900" title="Move down">
        <Icon name="chevronDown" className="w-4 h-4" strokeWidth={2.2} />
      </button>
      <button onClick={onEdit} className="p-1 rounded text-ink-400 hover:text-brand-700" title="Edit">
        <Icon name="pencil" className="w-4 h-4" />
      </button>
      <button onClick={onDelete} className="p-1 rounded text-ink-400 hover:text-red-600" title="Delete">
        <Icon name="trash" className="w-4 h-4" />
      </button>
    </span>
  )
}

function Stat({ label, value }) {
  return (
    <div className="card px-4 py-3.5">
      <p className="text-[12.5px] text-ink-500">{label}</p>
      <p className="text-[19px] font-semibold text-ink-900 mt-0.5">{value}</p>
    </div>
  )
}

function CourseUsersPanel({ open, course, onClose, users, enrollments, progressOf, actions, toast }) {
  const [picker, setPicker] = useState(false)
  const [picked, setPicked] = useState([])

  const rows = enrollments
    .map((e) => ({ ...e, user: users.find((u) => u.id === e.userId) }))
    .filter((r) => r.user)

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Enrolled users"
      subtitle={course.name}
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <div className="flex justify-between items-center mb-4">
        <p className="text-[13.5px] text-ink-500">
          {rows.length} enrolled · {rows.filter((r) => r.status === 'completed').length} completed
        </p>
        <Button size="sm" icon="userPlus" onClick={() => setPicker(true)}>
          Enroll users
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="hint border border-dashed border-line rounded-md px-4 py-8 text-center">
          Nobody is enrolled in this course yet.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id} className="py-3.5 flex items-center gap-3.5">
              <Avatar user={r.user} size={36} />
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] truncate">{fullName(r.user)}</span>
                <span className="block text-[12.5px] text-ink-500">Enrolled {formatDate(r.enrolledAt)}</span>
              </span>
              <span className="w-28">
                <Progress value={progressOf(r)} tone={progressOf(r) === 100 ? 'green' : 'brand'} />
              </span>
              <span className="text-[13px] text-ink-700 w-10 text-right">{progressOf(r)}%</span>
              <button
                onClick={() => {
                  actions.unenroll(r.userId, course.id)
                  toast('User removed from course.')
                }}
                className="text-ink-400 hover:text-red-600 p-1"
                title="Unenroll"
              >
                <Icon name="x" className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={picker}
        onClose={() => setPicker(false)}
        title="Enroll users"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPicker(false)}>
              Cancel
            </Button>
            <Button
              disabled={!picked.length}
              onClick={() => {
                actions.enroll(picked, [course.id])
                setPicked([])
                setPicker(false)
                toast('Users enrolled.')
              }}
            >
              Enroll
            </Button>
          </>
        }
      >
        <div className="space-y-2.5 max-h-[50vh] overflow-y-auto scroll-thin">
          {users
            .filter((u) => !enrollments.some((e) => e.userId === u.id))
            .map((u) => (
              <label key={u.id} className="flex items-center gap-3 border border-line rounded-md px-4 py-2.5 cursor-pointer hover:bg-gray-50">
                <Checkbox
                  checked={picked.includes(u.id)}
                  onChange={(v) => setPicked(v ? [...picked, u.id] : picked.filter((id) => id !== u.id))}
                />
                <Avatar user={u} size={30} />
                <span className="flex-1">
                  <span className="block text-[13.5px]">{fullName(u)}</span>
                  <span className="block text-[12px] text-ink-500">{u.userType}</span>
                </span>
              </label>
            ))}
        </div>
      </Modal>
    </Drawer>
  )
}

function CourseSettingsPanel({ open, course, categories, instructors, onClose, onSave }) {
  const [draft, setDraft] = useState(course)

  useEffect(() => {
    if (open) setDraft(course)
  }, [open, course])

  const set = (changes) => setDraft((d) => ({ ...d, ...changes }))

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Course settings"
      subtitle={course.name}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(draft)}>Save</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-x-5">
        <Field label="Course name" className="col-span-2">
          <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Course code">
          <Input value={draft.code} onChange={(e) => set({ code: e.target.value })} />
        </Field>
        <Field label="Price (USD)">
          <Input type="number" value={draft.price} onChange={(e) => set({ price: Number(e.target.value) })} />
        </Field>
        <Field label="Category">
          <Select value={draft.categoryId || ''} onChange={(e) => set({ categoryId: e.target.value || null })}>
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Level">
          <Select value={draft.level} onChange={(e) => set({ level: e.target.value })}>
            {['All levels', 'Beginner', 'Intermediate', 'Advanced'].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </Select>
        </Field>
        <Field label="Banner theme">
          <Select value={draft.cover} onChange={(e) => set({ cover: e.target.value })}>
            <option value="default">GA Healthcare (gold)</option>
            <option value="cna">Nursing Assistant</option>
            <option value="nclex">NCLEX Review</option>
            <option value="compliance">Compliance</option>
          </Select>
        </Field>
        <Field label="Capacity" hint="0 = unlimited">
          <Input type="number" value={draft.capacity} onChange={(e) => set({ capacity: Number(e.target.value) })} />
        </Field>
        <Field label="Completion rule" className="col-span-2">
          <Select value={draft.completionRule} onChange={(e) => set({ completionRule: e.target.value })}>
            <option>All units must be completed</option>
            <option>Only the final test must be passed</option>
            <option>Instructor marks the course complete</option>
          </Select>
        </Field>
        <Field label="Time limit (days)" hint="0 = no limit">
          <Input type="number" value={draft.timeLimitDays} onChange={(e) => set({ timeLimitDays: Number(e.target.value) })} />
        </Field>
        <Field label="Description" className="col-span-2">
          <Textarea rows={4} value={draft.description} onChange={(e) => set({ description: e.target.value })} />
        </Field>

        <Field label="Instructors" className="col-span-2">
          <OptionList>
            {instructors.map((i) => (
              <Checkbox
                key={i.id}
                label={`${fullName(i)} · ${i.userType}`}
                checked={(draft.instructorIds || []).includes(i.id)}
                onChange={(v) =>
                  set({
                    instructorIds: v
                      ? [...(draft.instructorIds || []), i.id]
                      : (draft.instructorIds || []).filter((id) => id !== i.id),
                  })
                }
              />
            ))}
          </OptionList>
        </Field>

        <div className="col-span-2 space-y-4">
          <Toggle
            checked={draft.certificate}
            onChange={(v) => set({ certificate: v })}
            label="Issue a certificate on completion"
          />
          <Toggle
            checked={draft.status === 'active'}
            onChange={(v) => set({ status: v ? 'active' : 'inactive', published: v })}
            label="Course is active"
            hint="Inactive courses stay hidden from learners."
          />
        </div>
      </div>
    </Drawer>
  )
}

function CloneUnitsModal({ open, mode, courses, onClose, onPick }) {
  const [courseId, setCourseId] = useState('')
  const [picked, setPicked] = useState([])

  useEffect(() => {
    if (open) {
      setCourseId('')
      setPicked([])
    }
  }, [open])

  const source = courses.find((c) => c.id === courseId)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'link' ? 'Link units from another course' : 'Clone units from another course'}
      subtitle={
        mode === 'link'
          ? 'Linked units keep a reference to the original course.'
          : 'A copy is added to this course and can be edited independently.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!picked.length}
            onClick={() => onPick(source.units.filter((u) => picked.includes(u.id)), mode)}
          >
            Add {picked.length || ''} unit{picked.length === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <Field label="Source course">
        <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          <option value="">Choose a course</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>

      {source && (
        <div className="space-y-2.5">
          {source.units.length === 0 && <p className="hint">That course has no units yet.</p>}
          {source.units.map((u) => (
            <label key={u.id} className="flex items-center gap-3 border border-line rounded-md px-4 py-2.5 cursor-pointer hover:bg-gray-50">
              <Checkbox
                checked={picked.includes(u.id)}
                onChange={(v) => setPicked(v ? [...picked, u.id] : picked.filter((id) => id !== u.id))}
              />
              <Icon name={unitIcon(u.type)} className="w-[18px] h-[18px] text-ink-700" />
              <span className="flex-1 text-[13.5px]">{u.name}</span>
              <Badge>{unitLabel(u.type)}</Badge>
            </label>
          ))}
        </div>
      )}
    </Modal>
  )
}
