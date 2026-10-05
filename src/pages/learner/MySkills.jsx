import { useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Badge, Button, Checkbox, EmptyState, Field, Icon, Input, Modal, PageHeader, Radio, Textarea } from '../../components/ui'
import { useData, useSelectors } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { SKILL_LEVELS, skillStatus } from '../../lib/rules.js'
import { cx, formatDate } from '../../lib/utils'
import { useT } from '../../lib/i18n'

/** A learner's skills: which they hold, the courses that teach each one, and its assessment. */
export default function MySkills() {
  const data = useData()
  const { skills = [], courses, users, settings, actions } = data
  const { enrollment } = useSelectors()
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const t = useT()
  const s = settings.skills || {}
  const [taking, setTaking] = useState(null)
  const [suggest, setSuggest] = useState(null)

  if (!s.enabled || !s.learners) return <Navigate to="/" replace />

  const rows = skills.map((skill) => ({ skill, status: skillStatus(skill, user.id, data, settings) }))
  const earned = rows.filter((r) => r.status.earned).length

  function sendSuggestion() {
    const name = suggest.name.trim()
    if (!name) return
    users
      .filter((u) => u.role === 'superadmin' || u.role === 'admin')
      .forEach((admin) =>
        actions.messages.add({
          fromId: user.id,
          toId: admin.id,
          subject: `Skill suggestion: ${name}`,
          body: `${user.firstName} ${user.lastName} suggests adding the skill “${name}”.${suggest.why.trim() ? `\n\n${suggest.why.trim()}` : ''}`,
          sentAt: new Date().toISOString(),
          read: false,
        }),
      )
    setSuggest(null)
    toast(t('Thank you — your suggestion was sent to the program office.'))
  }

  return (
    <div>
      <PageHeader title={t('Skills')} subtitle={`${earned} / ${skills.length} ${t('skills earned')}`}>
        {s.recommendations && (
          <Button variant="outline" icon="plus" onClick={() => setSuggest({ name: '', why: '' })}>
            {t('Suggest a skill')}
          </Button>
        )}
      </PageHeader>

      {rows.length === 0 ? (
        <div className="card">
          <EmptyState icon="skill" title={t('No skills yet')} message={t('Skills appear here once the program office adds them.')} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {rows.map(({ skill, status }) => {
            const linked = (skill.courseIds || []).map((id) => courses.find((c) => c.id === id)).filter((c) => c && c.status === 'active')
            const canLevelUp = status.earned && s.levels && status.level < status.maxLevel
            const canTake = status.hasAssessment && (!status.earned || canLevelUp) && !status.retryAt
            return (
              <article key={skill.id} className="card card-pad flex flex-col">
                <div className="flex items-start gap-3 mb-2">
                  <span className={cx('w-10 h-10 rounded-md flex items-center justify-center shrink-0', status.earned ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-ink-500')}>
                    <Icon name={status.earned ? 'checkCircle' : 'skill'} className="w-5 h-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[15.5px] font-semibold leading-6">{skill.name}</h3>
                    <p className="flex flex-wrap items-center gap-2 mt-1">
                      <Badge tone={status.earned ? 'green' : 'gray'}>{status.earned ? t('Earned') : t('Not yet earned')}</Badge>
                      {status.earned && s.levels && <Badge tone="blue">{SKILL_LEVELS[status.level - 1]}</Badge>}
                      {status.expiresAt && <span className="hint">{`${t('Valid until')} ${formatDate(status.expiresAt)}`}</span>}
                    </p>
                  </div>
                </div>
                {skill.description && <p className="hint mb-4 whitespace-pre-line">{skill.description}</p>}

                {linked.length > 0 && (
                  <div className="mb-4">
                    <p className="label">{t('Courses that teach it')}</p>
                    <ul className="space-y-1.5">
                      {linked.map((c) => {
                        const e = enrollment(user.id, c.id)
                        return (
                          <li key={c.id} className="flex items-center gap-2.5 text-[13.5px]">
                            <Icon name={e?.status === 'completed' ? 'checkCircle' : 'book'} className={cx('w-4 h-4 shrink-0', e?.status === 'completed' ? 'text-emerald-600' : 'text-ink-500')} />
                            <button className="link text-left truncate" onClick={() => navigate(e ? `/my-courses/${c.id}` : '/catalog')}>
                              {c.name}
                            </button>
                            {!e && <span className="hint whitespace-nowrap">{t('in the catalog')}</span>}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}

                {(skill.resources || []).length > 0 && (
                  <div className="mb-4">
                    <p className="label">{t('Resources')}</p>
                    <ul className="space-y-1.5">
                      {skill.resources.map((r) => (
                        <li key={r.id} className="flex items-center gap-2.5 text-[13.5px]">
                          <Icon name="link" className="w-4 h-4 shrink-0 text-ink-500" />
                          <a className="link truncate" href={r.url} target="_blank" rel="noreferrer">
                            {r.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-auto pt-2 flex flex-wrap items-center gap-3">
                  {canTake && (
                    <Button size="sm" onClick={() => setTaking(skill)}>
                      {canLevelUp ? `${t('Take the assessment for')} ${SKILL_LEVELS[status.level]}` : t('Take the assessment')}
                    </Button>
                  )}
                  {status.retryAt && <span className="hint">{`${t('You can try the assessment again on')} ${formatDate(status.retryAt)}`}</span>}
                  {status.last && (
                    <span className="hint">
                      {t('Last result')}: {status.last.score}% {status.last.passed ? `(${t('passed')})` : `(${t('not passed')})`}
                    </span>
                  )}
                  {!status.hasAssessment && !status.earned && linked.length === 0 && <span className="hint">{t('The program office records this skill for you.')}</span>}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {taking && (
        <Assessment
          skill={taking}
          count={Math.max(1, Number(s.questions) || 10)}
          passMark={Number(s.passMark) || 0}
          onClose={() => setTaking(null)}
          onResult={(score, passed) => {
            actions.skillResults.add({ skillId: taking.id, userId: user.id, score, passed, at: new Date().toISOString() })
            actions.logEvent('progress', `${passed ? 'passed' : 'did not pass'} the ${taking.name} skill assessment (${score}%)`, user.id)
          }}
        />
      )}

      <Modal
        open={!!suggest}
        onClose={() => setSuggest(null)}
        title={t('Suggest a skill')}
        width="max-w-md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSuggest(null)}>
              {t('Cancel')}
            </Button>
            <Button onClick={sendSuggestion} disabled={!suggest?.name.trim()}>
              {t('Send')}
            </Button>
          </>
        }
      >
        {suggest && (
          <>
            <Field label={t('Skill')} required>
              <Input value={suggest.name} onChange={(e) => setSuggest({ ...suggest, name: e.target.value })} />
            </Field>
            <Field label={t('Why would it help?')}>
              <Textarea rows={3} value={suggest.why} onChange={(e) => setSuggest({ ...suggest, why: e.target.value })} />
            </Field>
          </>
        )}
      </Modal>
    </div>
  )
}

/** A set of questions drawn at random from the skill's question bank. */
function Assessment({ skill, count, passMark, onClose, onResult }) {
  const t = useT()
  const questions = useMemo(() => [...(skill.questions || [])].sort(() => Math.random() - 0.5).slice(0, count), [skill, count])
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)

  function grade() {
    let right = 0
    for (const q of questions) {
      const correct = q.options.filter((o) => o.correct).map((o) => o.id)
      const given = answers[q.id] || []
      if (correct.length === given.length && correct.every((id) => given.includes(id))) right += 1
    }
    const score = Math.round((right / questions.length) * 100)
    const passed = score >= passMark
    setResult({ score, passed })
    onResult(score, passed)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={skill.name}
      subtitle={result ? undefined : `${questions.length} ${t('questions')} · ${t('pass mark')} ${passMark}%`}
      footer={
        result ? (
          <Button onClick={onClose}>{t('Done')}</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              {t('Cancel')}
            </Button>
            <Button onClick={grade} disabled={questions.some((q) => !(answers[q.id] || []).length)}>
              {t('Submit')}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="text-center py-6">
          <span className={cx('w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4', result.passed ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600')}>
            <Icon name={result.passed ? 'checkCircle' : 'alert'} className="w-8 h-8" />
          </span>
          <p className="text-[22px] font-semibold">{result.score}%</p>
          <p className={cx('text-[14px] mt-1', result.passed ? 'text-emerald-700' : 'text-red-600')}>
            {result.passed ? t('Passed — the skill is yours.') : `${t('Not passed. You need')} ${passMark}%.`}
          </p>
        </div>
      ) : (
        <ol className="space-y-6">
          {questions.map((q, i) => {
            const multiple = q.options.filter((o) => o.correct).length > 1
            const given = answers[q.id] || []
            return (
              <li key={q.id}>
                <p className="text-[14.5px] font-medium mb-2.5">
                  {i + 1}. {q.text}
                  {multiple && <span className="text-ink-500 font-normal"> ({t('select all that apply')})</span>}
                </p>
                <div className="space-y-2">
                  {q.options.map((o) => {
                    const checked = given.includes(o.id)
                    return (
                      <label key={o.id} className={cx('flex items-center gap-3 border rounded-md px-4 py-2.5 cursor-pointer transition', checked ? 'border-brand-700 bg-brand-50/60' : 'border-line hover:bg-gray-50')}>
                        {multiple ? (
                          <Checkbox checked={checked} onChange={(v) => setAnswers({ ...answers, [q.id]: v ? [...given, o.id] : given.filter((id) => id !== o.id) })} />
                        ) : (
                          <Radio checked={checked} onChange={() => setAnswers({ ...answers, [q.id]: [o.id] })} />
                        )}
                        <span className="text-[14px]">{o.text}</span>
                      </label>
                    )
                  })}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </Modal>
  )
}
