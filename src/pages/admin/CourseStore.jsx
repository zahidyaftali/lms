import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Icon, Modal, PageHeader, SearchInput, Select } from '../../components/ui'
import CourseHero from '../../components/course/CourseHero'
import { useData } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { uid } from '../../lib/utils'

/** Ready-made outlines the program office can drop into the portal. */
const LIBRARY = [
  {
    key: 'bls',
    name: 'CPR & Basic Life Support Refresher',
    category: 'cat_ce',
    cover: 'compliance',
    hours: 4,
    description:
      'Annual refresher covering adult, child and infant CPR, choking response and AED use, aligned to current AHA guidance.',
    outline: [
      ['section', 'Module 1 — Recognising an emergency'],
      ['content', 'Scene safety and initial assessment'],
      ['video', 'Demonstration: adult CPR cycle'],
      ['content', 'Using an AED safely'],
      ['test', 'BLS knowledge check'],
    ],
  },
  {
    key: 'dementia',
    name: 'Dementia & Memory Care Essentials',
    category: 'cat_ce',
    cover: 'cna',
    hours: 6,
    description:
      'Person-centred approaches to communication, behaviour support and daily care for residents living with dementia.',
    outline: [
      ['section', 'Understanding dementia'],
      ['content', 'Types and progression'],
      ['content', 'Communication techniques that work'],
      ['assignment', 'Care plan reflection'],
      ['survey', 'Confidence self-assessment'],
    ],
  },
  {
    key: 'safety',
    name: 'Patient Safety, Falls & Body Mechanics',
    category: 'cat_cna',
    cover: 'cna',
    hours: 5,
    description:
      'Safe transfers, fall prevention, restraint alternatives and protecting your own back on the unit.',
    outline: [
      ['section', 'Module 1 — Safe movement'],
      ['content', 'Body mechanics for nursing assistants'],
      ['video', 'Two-person transfer demonstration'],
      ['document', 'Transfer skills checklist'],
      ['test', 'Safety knowledge check'],
    ],
  },
  {
    key: 'documentation',
    name: 'Clinical Documentation & Reporting',
    category: 'cat_cna',
    cover: 'default',
    hours: 3,
    description:
      'What to record, when to report and how to write objective notes that stand up to review.',
    outline: [
      ['content', 'Objective vs subjective reporting'],
      ['content', 'Charting by exception'],
      ['assignment', 'Write three sample entries'],
    ],
  },
  {
    key: 'ethics',
    name: 'Resident Rights, Ethics & Abuse Prevention',
    category: 'cat_compliance',
    cover: 'compliance',
    hours: 4,
    description:
      'Resident rights under federal and Georgia state law, mandatory reporting duties and recognising abuse or neglect.',
    outline: [
      ['section', 'Rights and responsibilities'],
      ['content', 'The Resident Bill of Rights'],
      ['content', 'Recognising and reporting abuse'],
      ['test', 'Compliance check'],
    ],
  },
  {
    key: 'communication',
    name: 'Professional Communication in Healthcare',
    category: 'cat_orientation',
    cover: 'default',
    hours: 3,
    description:
      'Hand-off communication, working with families, de-escalation and professional boundaries.',
    outline: [
      ['content', 'SBAR hand-off structure'],
      ['content', 'Difficult conversations with families'],
      ['survey', 'Communication self-check'],
    ],
  },
]

export default function CourseStore() {
  const navigate = useNavigate()
  const { courses, categories, actions } = useData()
  const { user } = useAuth()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [preview, setPreview] = useState(null)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return LIBRARY.filter((t) => {
      if (q && !t.name.toLowerCase().includes(q)) return false
      if (category && t.category !== category) return false
      return true
    })
  }, [query, category])

  function addToPortal(template) {
    const course = actions.addCourse({
      name: template.name,
      description: template.description,
      categoryId: template.category,
      cover: template.cover,
      level: 'All levels',
      units: template.outline.map(([type, name]) => ({
        id: uid('un'),
        type,
        name,
        data:
          type === 'content'
            ? { html: `<h2>${name}</h2><p>Add the lesson content for this unit.</p>` }
            : type === 'test'
              ? { passingScore: 80, timeLimitMin: 0, maxAttempts: 0, shuffle: false, questions: [] }
              : {},
      })),
    })
    actions.logEvent('course', `added ${template.name} from the course store`, user.id)
    toast(`${template.name} added to your courses.`)
    setPreview(null)
    navigate(`/courses/${course.id}`)
  }

  return (
    <div>
      <PageHeader
        title="Course store"
        subtitle="Ready-made GA Healthcare outlines you can add to the portal and edit as your own."
      />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <SearchInput value={query} onChange={setQuery} className="w-[250px]" />
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-[220px]">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 lg:gap-6 stagger">
        {rows.map((t) => {
          const added = courses.some((c) => c.name === t.name)
          return (
            <article key={t.key} className="card card-interactive overflow-hidden flex flex-col">
              <CourseHero
                course={{ name: t.name, cover: t.cover, units: t.outline.map(() => ({ type: 'content' })) }}
                size="sm"
                tags={[`${t.hours} hours`]}
              />
              <div className="p-5 flex-1 flex flex-col">
                <h3 className="text-[15.5px] font-semibold leading-6 mb-2">{t.name}</h3>
                <p className="hint line-clamp-3 mb-4">{t.description}</p>
                <div className="mt-auto flex items-center justify-between gap-3">
                  <span className="hint flex items-center gap-1.5">
                    <Icon name="list" className="w-4 h-4" />
                    {t.outline.filter(([type]) => type !== 'section').length} units
                  </span>
                  {added ? (
                    <Badge tone="green">Already added</Badge>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setPreview(t)}>
                      Preview
                    </Button>
                  )}
                </div>
              </div>
            </article>
          )
        })}
      </div>

      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        title={preview?.name}
        subtitle={`${preview?.hours} hours · outline you can edit after adding`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPreview(null)}>
              Cancel
            </Button>
            <Button onClick={() => addToPortal(preview)}>Add to my courses</Button>
          </>
        }
      >
        {preview && (
          <>
            <p className="text-[14px] text-ink-700 leading-6 mb-5">{preview.description}</p>
            <ul className="divide-y divide-line border border-line rounded-md">
              {preview.outline.map(([type, name], i) => (
                <li key={i} className="px-4 py-3 flex items-center gap-3">
                  <Icon name={type === 'section' ? 'quote' : 'file'} className="w-4 h-4 text-ink-500" />
                  <span className={type === 'section' ? 'text-[12.5px] uppercase tracking-wide text-ink-500' : 'text-[14px]'}>
                    {name}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Modal>
    </div>
  )
}
