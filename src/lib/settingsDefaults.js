/**
 * Every portal setting with the value a new portal starts from.
 *
 * Plain JavaScript with no imports, so the server reads the same defaults as
 * the browser (see server/handler.js).
 */

/** Raised when stored settings need a one-time adjustment (see `withSettingDefaults`). */
export const SETTINGS_VERSION = 2

export const DEFAULT_SETTINGS = {
  settingsVersion: SETTINGS_VERSION,
  siteName: 'GA Healthcare Training - CNA Program',
  siteDescription:
    "GA Healthcare Training & Consulting offers expert-led CNA certification training founded by Dr. Yolaine Nozile, PhD, RN — building competent, career-ready nursing assistants for today's healthcare world.",
  domain: 'portal.gahealthcaretraining.com',
  customDomain: '',
  website: 'https://gahealthcaretraining.com/',
  supportEmail: 'info@gahealthcaretraining.com',
  supportPhone: '(770) 872-8033',
  address: 'Atlanta, Georgia',
  logo: null,
  favicon: null,
  theme: 'GA Healthcare (default)',
  timezone: '(GMT -05:00) Eastern Time (US & Canada)',
  language: 'English (US)',
  dateFormat: 'DD/MM/YYYY',
  currency: 'US Dollar ($)',
  announcements: { internalOn: false, internal: '', externalOn: false, external: '' },
  homepage: { custom: false, headline: '', intro: '' },
  users: {
    selfRegistration: false,
    defaultUserType: 'Learner-Type',
    defaultGroupId: '',
    allowedDomains: '',
    verification: 'None',
    termsOn: false,
    terms: '',
    nameFormat: 'First name and last name',
    socialGoogle: false,
    socialFacebook: false,
    socialLinkedIn: false,
    googleClientId: '',
    facebookClientId: '',
    linkedinClientId: '',
    customFields: [],
    passwordMinLength: 8,
    forcePasswordReset: false,
    inactivityDays: 0,
    welcomeEmail: true,
  },
  sso: { type: 'None', identityProvider: '', clientId: '', certificate: '', signInUrl: '', signOutUrl: '', emailAttribute: 'email' },
  courses: {
    defaultCompletionRule: 'All units must be completed',
    unitNavigation: 'Any order',
    showSummary: true,
    discussions: true,
    ratings: false,
    externalCatalog: false,
    catalogLayout: 'Cards',
    socialSharing: false,
    certificateEnabled: true,
    certificateValidity: 'Never expires',
    certificateTemplate: 'Classic',
    allowSelfEnrollment: false,
    showProgressBar: true,
    customFields: [],
  },
  skills: {
    enabled: false,
    learners: true,
    recommendations: false,
    levels: false,
    questions: 10,
    passMark: 70,
    retryDays: 7,
    expiryMonths: 0,
  },
  gamification: {
    enabled: false,
    points: {
      enabled: true,
      login: 25,
      unit: 25,
      course: 150,
      certificate: 150,
      test: 150,
      assignment: 150,
      session: 150,
      discussion: 25,
      upvote: 10,
    },
    badges: {
      enabled: true,
      set: 'Classic',
      activity: true,
      learning: true,
      test: true,
      assignment: true,
      perfectionism: true,
      survey: true,
      communication: true,
      certification: true,
    },
    levels: { enabled: true, everyPoints: 3000, everyCourses: 5, everyBadges: 5 },
    rewards: { enabled: false, points: 0, pointsDiscount: 0, badges: 0, badgesDiscount: 0, level: 0, levelDiscount: 0 },
    leaderboard: { enabled: true, levels: true, points: true, badges: true, courses: true, certifications: true },
  },
  ecommerce: {
    processor: 'None',
    paypalEmail: '',
    offline: { enabled: false, instructions: '' },
    subscription: { enabled: false, fee: 0, interval: 'Monthly', trialDays: 0 },
    coupons: [],
    globalDiscount: 0,
    credits: false,
    invoices: { enabled: false, details: '', note: '' },
  },
  email: { provider: 'None', fromName: '', fromAddress: '' },
  integrations: {},
  webhooks: [],
  api: { enabled: false },
  security: {
    twoFactor: false,
    twoFactorFor: 'Administrators',
    strongPasswords: false,
    passwordExpiryDays: 0,
    singleSession: false,
    allowedIps: '',
    sessionTimeout: 60,
    loginAttempts: 5,
    lockoutMinutes: 15,
    auditLog: true,
  },
  subscription: { company: '', billingEmail: '', address: '', taxId: '', userLimit: 0, courseLimit: 0 },
}

const isPlain = (v) => !!v && typeof v === 'object' && !Array.isArray(v)

function fillDefaults(defaults, saved) {
  const out = { ...defaults, ...saved }
  for (const [key, value] of Object.entries(defaults)) {
    if (isPlain(value)) out[key] = fillDefaults(value, isPlain(saved[key]) ? saved[key] : {})
  }
  return out
}

/**
 * Settings saved by an earlier version of the portal predate newer options and
 * whole groups (gamification, e-commerce …); this fills those in with defaults.
 *
 * Before version 2 a number of options were stored but never acted on, and
 * their stored values were only the placeholders the portal shipped with. The
 * ones that would lock learners out or change their accounts the moment they
 * started working are switched off once, so an administrator turns them on
 * deliberately: units in order, certificate expiry, a new password at first
 * sign-in, deactivating idle accounts and self-registration.
 */
export function withSettingDefaults(settings) {
  const out = fillDefaults(DEFAULT_SETTINGS, settings || {})
  if ((Number(settings?.settingsVersion) || 1) < SETTINGS_VERSION) {
    out.users = { ...out.users, forcePasswordReset: false, inactivityDays: 0, selfRegistration: false }
    out.courses = { ...out.courses, unitNavigation: 'Any order', certificateValidity: 'Never expires' }
    out.settingsVersion = SETTINGS_VERSION
  }
  return out
}

/** Settings groups that hold connection and billing details; only administrators receive them. */
export const ADMIN_SETTINGS = ['integrations', 'api', 'sso', 'email', 'webhooks', 'subscription']

/** What a learner's browser needs from the e-commerce settings: prices and how to pay, never the coupon list. */
export function publicEcommerce(ecommerce = {}) {
  return {
    processor: ecommerce.processor || 'None',
    offline: ecommerce.offline || { enabled: false, instructions: '' },
    subscription: ecommerce.subscription || { enabled: false, fee: 0, interval: 'Monthly', trialDays: 0 },
    globalDiscount: Number(ecommerce.globalDiscount) || 0,
    credits: !!ecommerce.credits,
    invoices: ecommerce.invoices || { enabled: false, details: '', note: '' },
    hasCoupons: (ecommerce.coupons || []).some((c) => c.active),
    coupons: [],
  }
}
