/**
 * Points, badges, levels and the leaderboard, worked out from what learners
 * have actually done. Nothing is stored except the sign-in count and bonus
 * points on the user record, so changing a rule in Account & Settings →
 * Gamification re-scores everyone at once.
 *
 * Plain JavaScript with no imports: the server builds the leaderboard learners see.
 */

const TIERS = ['Newbie', 'Grower', 'Adventurer', 'Explorer', 'Star', 'Superstar', 'Master', 'Grandmaster']
const DOUBLING = [1, 2, 4, 8, 16, 32, 64, 128]

/** Badge type -> the count it watches, and how many of it each of the eight badges needs. */
export const BADGE_TYPES = {
  activity: { label: 'Activity', stat: 'logins', unit: 'sign-ins', thresholds: [4, 8, 16, 32, 64, 128, 256, 512] },
  learning: { label: 'Learning', stat: 'courses', unit: 'completed courses', thresholds: DOUBLING },
  test: { label: 'Test', stat: 'tests', unit: 'passed tests', thresholds: [2, 4, 8, 16, 32, 64, 128, 256] },
  assignment: { label: 'Assignment', stat: 'assignments', unit: 'passed assignments', thresholds: DOUBLING },
  perfectionism: { label: 'Perfectionism', stat: 'perfect', unit: 'scores of 90% or more', thresholds: DOUBLING },
  survey: { label: 'Survey', stat: 'surveys', unit: 'answered surveys', thresholds: DOUBLING },
  communication: { label: 'Communication', stat: 'posts', unit: 'discussion posts', thresholds: [2, 4, 8, 16, 32, 64, 128, 256] },
  certification: { label: 'Certification', stat: 'certificates', unit: 'certificates', thresholds: DOUBLING },
}

export const MAX_LEVEL = 20

/** unitId -> unit type, for every course in the portal. */
function unitTypes(courses) {
  const types = new Map()
  for (const course of courses || []) for (const unit of course.units || []) types.set(unit.id, unit.type)
  return types
}

/** Everything gamification counts for each user, in one pass over the portal's records. */
export function allStats(state) {
  const types = unitTypes(state.courses)
  const blank = () => ({ logins: 0, units: 0, courses: 0, certificates: 0, tests: 0, assignments: 0, sessions: 0, posts: 0, upvotes: 0, surveys: 0, perfect: 0, bonus: 0 })
  const stats = new Map()
  const of = (userId) => {
    if (!stats.has(userId)) stats.set(userId, blank())
    return stats.get(userId)
  }
  for (const user of state.users || []) {
    const s = of(user.id)
    s.logins = Number(user.loginCount) || 0
    s.bonus = Number(user.bonusPoints) || 0
  }
  for (const e of state.enrollments || []) {
    const s = of(e.userId)
    for (const unitId of e.completedUnits || []) {
      const type = types.get(unitId)
      if (!type) continue
      s.units += 1
      if (type === 'test') s.tests += 1
      else if (type === 'ilt') s.sessions += 1
      else if (type === 'survey') s.surveys += 1
    }
    for (const score of Object.values(e.scores || {})) if (Number(score) >= 90) s.perfect += 1
    if (e.status === 'completed') s.courses += 1
  }
  for (const c of state.certificates || []) of(c.userId).certificates += 1
  for (const sub of state.submissions || []) {
    if (sub.type === 'assignment' && sub.status === 'graded' && Number(sub.grade) >= 50) of(sub.userId).assignments += 1
  }
  for (const post of state.discussions || []) {
    const s = of(post.userId)
    s.posts += 1
    s.upvotes += (post.upvotes || []).length
  }
  return stats
}

const POINT_STATS = { login: 'logins', unit: 'units', course: 'courses', certificate: 'certificates', test: 'tests', assignment: 'assignments', session: 'sessions', discussion: 'posts', upvote: 'upvotes' }

/** Points, badges and level for one set of counts under the portal's gamification settings. */
export function scoreOf(stats, g) {
  const s = stats || {}
  let points = 0
  if (g?.points?.enabled) {
    for (const [rule, stat] of Object.entries(POINT_STATS)) points += (Number(g.points[rule]) || 0) * (s[stat] || 0)
  }
  points += s.bonus || 0

  const badges = []
  if (g?.badges?.enabled) {
    for (const [type, def] of Object.entries(BADGE_TYPES)) {
      if (!g.badges[type]) continue
      const count = s[def.stat] || 0
      def.thresholds.forEach((needed, tier) => {
        if (count >= needed) badges.push({ type, tier, name: `${def.label} ${TIERS[tier]}`, needed, unit: def.unit })
      })
    }
  }

  let level = 1
  if (g?.levels?.enabled) {
    const every = (count, step) => (Number(step) > 0 ? Math.floor(count / Number(step)) : 0)
    level += every(points, g.levels.everyPoints) + every(s.courses || 0, g.levels.everyCourses) + every(badges.length, g.levels.everyBadges)
  }
  return { points, badges, level: Math.min(MAX_LEVEL, level) }
}

/** The next badge of each type a learner is working towards. */
export function nextBadges(stats, g) {
  if (!g?.badges?.enabled) return []
  const out = []
  for (const [type, def] of Object.entries(BADGE_TYPES)) {
    if (!g.badges[type]) continue
    const count = stats?.[def.stat] || 0
    const tier = def.thresholds.findIndex((needed) => count < needed)
    if (tier >= 0) out.push({ type, tier, name: `${def.label} ${TIERS[tier]}`, count, needed: def.thresholds[tier], unit: def.unit })
  }
  return out
}

/** The discount a learner has earned on paid courses, as a percentage. */
export function rewardDiscount(score, g) {
  const r = g?.rewards
  if (!g?.enabled || !r?.enabled || !score) return 0
  const earned = []
  if (r.points > 0 && score.points >= r.points) earned.push(Number(r.pointsDiscount) || 0)
  if (r.badges > 0 && score.badges.length >= r.badges) earned.push(Number(r.badgesDiscount) || 0)
  if (r.level > 0 && score.level >= r.level) earned.push(Number(r.levelDiscount) || 0)
  return Math.min(100, Math.max(0, ...earned))
}

/** Learners ranked by points, with the columns the leaderboard is set to show. */
export function leaderboard(state, g, nameOf) {
  const stats = allStats(state)
  return (state.users || [])
    .filter((u) => u.active && u.role === 'learner')
    .map((u) => {
      const s = stats.get(u.id)
      const score = scoreOf(s, g)
      return {
        id: u.id,
        name: nameOf(u),
        avatar: u.avatar || null,
        firstName: u.firstName,
        lastName: u.lastName,
        email: '',
        points: score.points,
        level: score.level,
        badges: score.badges.length,
        courses: s?.courses || 0,
        certificates: s?.certificates || 0,
      }
    })
    .sort((a, b) => b.points - a.points || b.courses - a.courses || a.name.localeCompare(b.name))
}
