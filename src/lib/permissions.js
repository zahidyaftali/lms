export const ROLES = {
  superadmin: { label: 'SuperAdmin', badge: 'Administrator' },
  admin: { label: 'Admin-Type', badge: 'Administrator' },
  instructor: { label: 'Trainer-Type', badge: 'Instructor' },
  learner: { label: 'Learner-Type', badge: 'Learner' },
}

/** Capability -> roles allowed. Everything not listed is admin-only by default. */
const MATRIX = {
  'dashboard.view': ['superadmin', 'admin', 'instructor', 'learner'],
  'profile.edit': ['superadmin', 'admin', 'instructor', 'learner'],
  'messages.view': ['superadmin', 'admin', 'instructor', 'learner'],
  'catalog.view': ['superadmin', 'admin', 'instructor', 'learner'],

  'users.manage': ['superadmin', 'admin'],
  'users.view': ['superadmin', 'admin', 'instructor'],
  'courses.manage': ['superadmin', 'admin'],
  'courses.build': ['superadmin', 'admin', 'instructor'],
  'courses.assign': ['superadmin', 'admin', 'instructor'],
  'courses.learn': ['learner'],
  'store.view': ['superadmin', 'admin'],
  'groups.manage': ['superadmin', 'admin'],
  'branches.manage': ['superadmin', 'admin'],
  'notifications.manage': ['superadmin', 'admin'],
  'reports.view': ['superadmin', 'admin', 'instructor'],
  'grading.manage': ['superadmin', 'admin', 'instructor'],
  'settings.manage': ['superadmin', 'admin'],
  'settings.portal': ['superadmin'],
}

export function can(user, capability) {
  if (!user) return false
  const roles = MATRIX[capability]
  if (!roles) return user.role === 'superadmin' || user.role === 'admin'
  return roles.includes(user.role)
}

export function isAdmin(user) {
  return !!user && (user.role === 'superadmin' || user.role === 'admin')
}

/** Roles a user is allowed to switch into from the avatar menu. */
export function switchableRoles(user) {
  if (!user) return []
  if (isAdmin(user)) return ['admin', 'instructor', 'learner']
  if (user.role === 'instructor') return ['instructor', 'learner']
  return ['learner']
}

export const VIEW_LABEL = {
  admin: 'Administrator',
  instructor: 'Instructor',
  learner: 'Learner',
}
