import { useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { Avatar, Badge, Icon, PageHeader, Progress } from '../../components/ui'
import { useData } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { allStats, leaderboard, nextBadges, rewardDiscount, scoreOf } from '../../lib/gamification.js'
import { cx, fullName } from '../../lib/utils'
import { useT } from '../../lib/i18n'

const TIER_TONE = ['bg-amber-100 text-amber-800', 'bg-amber-100 text-amber-800', 'bg-slate-200 text-slate-700', 'bg-slate-200 text-slate-700', 'bg-yellow-100 text-yellow-800', 'bg-yellow-100 text-yellow-800', 'bg-brand-100 text-brand-800', 'bg-brand-100 text-brand-800']

/** A learner's points, level and badges, and the leaderboard, as set up in Account & Settings → Gamification. */
export default function Achievements() {
  const data = useData()
  const { settings, backend } = data
  const { user } = useAuth()
  const t = useT()
  const g = settings.gamification

  const stats = useMemo(() => allStats(data).get(user.id), [data, user.id])
  const score = useMemo(() => scoreOf(stats, g), [stats, g])
  // With the shared database the server ranks everyone; a learner's browser only holds its own records.
  const board = useMemo(
    () => (backend.mode === 'server' && data.leaderboard ? data.leaderboard : leaderboard(data, g, fullName)),
    [backend.mode, data, g],
  )

  if (!g?.enabled) return <Navigate to="/" replace />

  const upcoming = nextBadges(stats, g)
  const reward = rewardDiscount(score, g)
  const lv = g.levels
  const toNext = lv?.enabled && Number(lv.everyPoints) > 0 ? Number(lv.everyPoints) - (score.points % Number(lv.everyPoints)) : null
  const columns = g.leaderboard
  const rank = board.findIndex((r) => r.id === user.id) + 1

  return (
    <div>
      <PageHeader title={t('Achievements')} subtitle={t('Points, badges and levels you earn as you learn.')} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 stagger">
        {g.points.enabled && <Tile icon="star" label={t('Points')} value={score.points.toLocaleString('en-US')} />}
        {g.levels.enabled && <Tile icon="signal" label={t('Level')} value={score.level} note={toNext ? `${toNext.toLocaleString('en-US')} ${t('points to the next level')}` : undefined} />}
        {g.badges.enabled && <Tile icon="award" label={t('Badges')} value={score.badges.length} />}
        {g.leaderboard.enabled && rank > 0 && <Tile icon="trophy" label={t('Rank')} value={`#${rank}`} note={`${t('of')} ${board.length}`} />}
      </div>

      {reward > 0 && (
        <div className="flex items-start gap-3 rounded-md bg-emerald-50 border border-emerald-100 px-4 py-3.5 mb-6">
          <Icon name="tag" className="w-[18px] h-[18px] text-emerald-700 mt-0.5 shrink-0" />
          <p className="text-[13.5px] text-emerald-900">
            {t('You have earned a reward:')} <strong>{reward}%</strong> {t('off paid courses. It is applied at checkout.')}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-6 items-start">
        {g.badges.enabled && (
          <section className="card card-pad">
            <h2 className="card-title mb-5">{t('Badges')}</h2>
            {score.badges.length === 0 ? (
              <p className="hint mb-5">{t('No badges yet. Your first one is close:')}</p>
            ) : (
              <ul className="flex flex-wrap gap-2.5 mb-6">
                {score.badges.map((b) => (
                  <li key={b.name} title={`${b.needed} ${b.unit}`} className={cx('inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-medium', TIER_TONE[b.tier])}>
                    <Icon name="award" className="w-4 h-4" />
                    {b.name}
                  </li>
                ))}
              </ul>
            )}
            {upcoming.length > 0 && (
              <>
                <h3 className="text-[13px] font-semibold tracking-[0.12em] uppercase text-ink-700 mb-3">{t('Next badges')}</h3>
                <ul className="space-y-3.5">
                  {upcoming.map((b) => (
                    <li key={b.type}>
                      <div className="flex justify-between gap-3 text-[13.5px] mb-1.5">
                        <span>{b.name}</span>
                        <span className="text-ink-500">
                          {b.count} / {b.needed} {b.unit}
                        </span>
                      </div>
                      <Progress value={(b.count / b.needed) * 100} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}

        {g.leaderboard.enabled && (
          <section className="card">
            <div className="px-6 pt-6 pb-4">
              <h2 className="card-title">{t('Leaderboard')}</h2>
            </div>
            {board.length === 0 ? (
              <p className="hint px-6 pb-6">{t('Nobody is on the leaderboard yet.')}</p>
            ) : (
              <ol className="divide-y divide-line">
                {board.slice(0, 20).map((row, i) => (
                  <li key={row.id} className={cx('px-6 py-3 flex items-center gap-3.5', row.id === user.id && 'bg-brand-50')}>
                    <span className={cx('w-7 text-[14px] font-bold text-center', i < 3 ? 'text-gold-600' : 'text-ink-500')}>{i + 1}</span>
                    <Avatar user={row} size={34} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14px] truncate">
                        {row.name}
                        {row.id === user.id && <Badge tone="blue" className="ml-2">{t('You')}</Badge>}
                      </span>
                      <span className="block hint truncate">
                        {[
                          columns.levels && g.levels.enabled && `${t('Level')} ${row.level}`,
                          columns.badges && g.badges.enabled && `${row.badges} ${t('badges')}`,
                          columns.courses && `${row.courses} ${t('courses')}`,
                          columns.certifications && `${row.certificates} ${t('certificates')}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    {columns.points && g.points.enabled && <span className="text-[14px] font-bold">{row.points.toLocaleString('en-US')}</span>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}
      </div>

      {g.points.enabled && (
        <section className="card card-pad mt-6">
          <h2 className="card-title mb-4">{t('How points are earned')}</h2>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2.5 text-[13.5px]">
            {[
              ['login', 'Each sign-in'],
              ['unit', 'Each completed unit'],
              ['course', 'Each completed course'],
              ['certificate', 'Each certificate'],
              ['test', 'Each passed test'],
              ['assignment', 'Each passed assignment'],
              ['session', 'Each attended instructor-led session'],
              ['discussion', 'Each discussion post'],
              ['upvote', 'Each upvote on your posts'],
            ]
              .filter(([key]) => Number(g.points[key]) > 0)
              .map(([key, label]) => (
                <li key={key} className="flex justify-between gap-3 border-b border-line pb-2">
                  <span className="text-ink-700">{t(label)}</span>
                  <span className="font-semibold">+{g.points[key]}</span>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Tile({ icon, label, value, note }) {
  return (
    <div className="card px-5 py-4">
      <span className="w-9 h-9 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center mb-3">
        <Icon name={icon} className="w-[18px] h-[18px]" strokeWidth={1.6} />
      </span>
      <p className="text-[22px] font-semibold leading-none">{value}</p>
      <p className="hint mt-1.5">{label}</p>
      {note && <p className="text-[12px] text-ink-400 mt-0.5">{note}</p>}
    </div>
  )
}

