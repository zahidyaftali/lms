/**
 * The SCORM run-time a package talks to: `window.API` (SCORM 1.2) and
 * `window.API_1484_11` (SCORM 2004). A package in the player's frame finds them
 * by walking up its parent windows, as the standard describes.
 *
 * What a package saves (location, suspend data, status, score, time) is kept on
 * the learner's enrollment, so they can resume on any device; interactions and
 * other reporting detail live only for the session.
 */

const V12 = {
  status: 'cmi.core.lesson_status',
  location: 'cmi.core.lesson_location',
  raw: 'cmi.core.score.raw',
  min: 'cmi.core.score.min',
  max: 'cmi.core.score.max',
  exit: 'cmi.core.exit',
  session: 'cmi.core.session_time',
  total: 'cmi.core.total_time',
  entry: 'cmi.core.entry',
}

/** Elements saved between sessions. Everything else (interactions, comments) is kept for the session only. */
const KEEP_12 = /^cmi\.(core\.(lesson_location|lesson_status|score\.(raw|min|max)|exit)|suspend_data|objectives\.\d+\.(id|status|score\.(raw|min|max)))$/
const KEEP_2004 = /^cmi\.(location|completion_status|success_status|score\.(scaled|raw|min|max)|progress_measure|suspend_data|exit|objectives\.\d+\.(id|success_status|completion_status|score\.(scaled|raw|min|max)|progress_measure))$/

const READ_ONLY_12 = /^cmi\.(core\.(student_id|student_name|credit|entry|total_time|lesson_mode|_children|score\._children)|launch_data|student_data\.(mastery_score|max_time_allowed|time_limit_action)|.*\._count|.*\._children)$/
const WRITE_ONLY_12 = /^cmi\.(core\.(exit|session_time)|interactions\.\d+\.(id|objectives\.\d+\.id|time|type|correct_responses\.\d+\.pattern|weighting|student_response|result|latency))$/
const READ_ONLY_2004 = /^cmi\.(learner_id|learner_name|credit|entry|total_time|mode|launch_data|completion_threshold|scaled_passing_score|max_time_allowed|time_limit_action|_version|.*\._count|.*\._children)$/
const WRITE_ONLY_2004 = /^cmi\.(exit|session_time)$/

const ERRORS_12 = {
  0: 'No error',
  101: 'General exception',
  201: 'Invalid argument error',
  202: 'Element cannot have children',
  203: 'Element not an array. Cannot have count.',
  301: 'Not initialized',
  401: 'Not implemented error',
  402: 'Invalid set value, element is a keyword',
  403: 'Element is read only',
  404: 'Element is write only',
  405: 'Incorrect data type',
}

const ERRORS_2004 = {
  0: 'No Error',
  101: 'General Exception',
  102: 'General Initialization Failure',
  103: 'Already Initialized',
  104: 'Content Instance Terminated',
  111: 'General Termination Failure',
  112: 'Termination Before Initialization',
  113: 'Termination After Termination',
  122: 'Retrieve Data Before Initialization',
  123: 'Retrieve Data After Termination',
  132: 'Store Data Before Initialization',
  133: 'Store Data After Termination',
  142: 'Commit Before Initialization',
  143: 'Commit After Termination',
  201: 'General Argument Error',
  301: 'General Get Failure',
  351: 'General Set Failure',
  391: 'General Commit Failure',
  401: 'Undefined Data Model Element',
  403: 'Data Model Element Value Not Initialized',
  404: 'Data Model Element Is Read Only',
  405: 'Data Model Element Is Write Only',
  406: 'Data Model Element Type Mismatch',
}

const CHILDREN = {
  'cmi.core._children': 'student_id,student_name,lesson_location,credit,lesson_status,entry,score,total_time,lesson_mode,exit,session_time',
  'cmi.core.score._children': 'raw,min,max',
  'cmi.objectives._children': 'id,score,status',
  'cmi.interactions._children': 'id,objectives,time,type,correct_responses,weighting,student_response,result,latency',
  'cmi.student_data._children': 'mastery_score,max_time_allowed,time_limit_action',
  'cmi.score._children': 'scaled,raw,min,max',
}

/* --------------------------------------------------------------------- time */

/** "HHHH:MM:SS.SS" (1.2) or "PT1H2M3.5S" (2004) → seconds. */
export function parseScormTime(value) {
  const v = String(value || '').trim()
  const clock = v.match(/^(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/)
  if (clock) return Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3])
  const iso = v.match(/^P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/)
  if (!iso) return 0
  const [, y, mo, d, h, mi, s] = iso.map((x) => Number(x) || 0)
  return y * 31536000 + mo * 2592000 + d * 86400 + h * 3600 + mi * 60 + s
}

function formatTime12(seconds) {
  const s = Math.max(0, Math.round(seconds))
  const pad = (n) => String(n).padStart(2, '0')
  return `${String(Math.floor(s / 3600)).padStart(4, '0')}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}.00`
}

function formatTime2004(seconds) {
  const s = Math.max(0, Math.round(seconds))
  return `PT${Math.floor(s / 3600)}H${Math.floor((s % 3600) / 60)}M${s % 60}S`
}

/* ------------------------------------------------------------------ outcome */

/**
 * What a package's saved values mean for the unit.
 * Returns { completed, passed, failed, score (0–100 or null) }.
 */
export function scormOutcome(kind, data = {}) {
  const num = (k) => (data[k] === '' || data[k] == null ? null : Number(data[k]))
  if (kind === 'scorm2004') {
    const scaled = num('cmi.score.scaled')
    const raw = num('cmi.score.raw')
    const max = num('cmi.score.max')
    const score = scaled != null && Number.isFinite(scaled) ? Math.round(scaled * 100) : raw != null && Number.isFinite(raw) ? Math.round(max ? (raw / max) * 100 : raw) : null
    const success = data['cmi.success_status']
    return {
      completed: data['cmi.completion_status'] === 'completed' || success === 'passed',
      passed: success === 'passed',
      failed: success === 'failed',
      score: score != null ? Math.max(0, Math.min(100, score)) : null,
    }
  }
  const status = data[V12.status]
  const raw = num(V12.raw)
  const max = num(V12.max)
  const score = raw != null && Number.isFinite(raw) ? Math.round(max ? (raw / max) * 100 : raw) : null
  return {
    completed: status === 'completed' || status === 'passed',
    passed: status === 'passed',
    failed: status === 'failed',
    score: score != null ? Math.max(0, Math.min(100, score)) : null,
  }
}

/* -------------------------------------------------------------------- API */

/**
 * Puts the run-time on `window` for one SCO and returns a function that takes it away.
 *
 * saved: what was kept last time, { data: { element: value }, seconds }
 * learner: { id, name }        sco: { id, title, mastery, launchData, threshold }
 * onCommit(state): called with { data, seconds, outcome } whenever the package commits or finishes.
 */
export function installScormApi({ kind, saved = {}, learner, sco, onCommit }) {
  const is2004 = kind === 'scorm2004'
  const values = { ...(saved.data || {}) }
  const priorSeconds = Number(saved.seconds) || 0
  let sessionSeconds = 0
  let state = 'new' // new | running | finished
  let lastError = 0

  const resumed = values[is2004 ? 'cmi.exit' : V12.exit] === 'suspend'
  const fixed = is2004
    ? {
        'cmi._version': '1.0',
        'cmi.learner_id': learner.id,
        'cmi.learner_name': learner.name,
        'cmi.credit': 'credit',
        'cmi.mode': 'normal',
        'cmi.entry': resumed ? 'resume' : Object.keys(values).length ? '' : 'ab-initio',
        'cmi.launch_data': sco.launchData || '',
        'cmi.completion_threshold': sco.threshold != null ? String(sco.threshold) : '',
        'cmi.scaled_passing_score': sco.mastery != null ? String(sco.mastery / 100) : '',
      }
    : {
        'cmi.core.student_id': learner.id,
        'cmi.core.student_name': learner.name,
        'cmi.core.credit': 'credit',
        'cmi.core.lesson_mode': 'normal',
        'cmi.core.entry': resumed ? 'resume' : Object.keys(values).length ? '' : 'ab-initio',
        'cmi.launch_data': sco.launchData || '',
        'cmi.student_data.mastery_score': sco.mastery != null ? String(sco.mastery) : '',
      }
  if (is2004) {
    values['cmi.completion_status'] ||= 'unknown'
    values['cmi.success_status'] ||= 'unknown'
  } else values[V12.status] ||= 'not attempted'

  const keep = is2004 ? KEEP_2004 : KEEP_12
  const readOnly = is2004 ? READ_ONLY_2004 : READ_ONLY_12
  const writeOnly = is2004 ? WRITE_ONLY_2004 : WRITE_ONLY_12
  const errors = is2004 ? ERRORS_2004 : ERRORS_12

  /** The highest index used under an array element such as cmi.interactions, plus one. */
  const countOf = (prefix) => {
    let n = 0
    const re = new RegExp(`^${prefix.replace(/\./g, '\\.')}\\.(\\d+)\\.`)
    for (const key of Object.keys(values)) {
      const m = key.match(re)
      if (m) n = Math.max(n, Number(m[1]) + 1)
    }
    return n
  }

  function persist() {
    const data = Object.fromEntries(Object.entries(values).filter(([k]) => keep.test(k)))
    const seconds = priorSeconds + sessionSeconds
    onCommit?.({ data, seconds, outcome: scormOutcome(kind, data) })
  }

  const fail = (code, result) => {
    lastError = code
    return result
  }

  function getValue(element) {
    const el = String(element || '')
    if (state !== 'running') return fail(is2004 ? (state === 'new' ? 122 : 123) : 301, '')
    if (!el) return fail(is2004 ? 301 : 201, '')
    lastError = 0
    if (el.endsWith('._count')) {
      const base = el.slice(0, -7)
      if (!/(objectives|interactions|comments_from_learner|comments_from_lms|correct_responses)$/.test(base)) return fail(is2004 ? 401 : 203, '')
      return String(countOf(base))
    }
    if (el.endsWith('._children')) return CHILDREN[el] ?? fail(is2004 ? 401 : 202, '')
    if (el in fixed) return fixed[el]
    if (el === (is2004 ? 'cmi.total_time' : V12.total)) return is2004 ? formatTime2004(priorSeconds) : formatTime12(priorSeconds)
    if (writeOnly.test(el)) return fail(is2004 ? 405 : 404, '')
    if (el in values) return String(values[el])
    if (!el.startsWith('cmi.') && !el.startsWith('adl.')) return fail(is2004 ? 401 : 201, '')
    // Known but not yet set.
    return is2004 && /^cmi\.(location|suspend_data|score\.|progress_measure)/.test(el) ? fail(403, '') : ''
  }

  function setValue(element, value) {
    const el = String(element || '')
    const v = value == null ? '' : String(value)
    if (state !== 'running') return fail(is2004 ? (state === 'new' ? 132 : 133) : 301, 'false')
    if (!el) return fail(is2004 ? 351 : 201, 'false')
    if (el.endsWith('._count') || el.endsWith('._children')) return fail(is2004 ? 404 : 402, 'false')
    if (el in fixed || readOnly.test(el)) return fail(is2004 ? 404 : 403, 'false')
    if (!el.startsWith('cmi.') && !el.startsWith('adl.')) return fail(is2004 ? 401 : 201, 'false')
    if (el === (is2004 ? 'cmi.session_time' : V12.session)) {
      sessionSeconds = parseScormTime(v)
    } else if (el === V12.status && !['passed', 'completed', 'failed', 'incomplete', 'browsed', 'not attempted'].includes(v)) {
      return fail(405, 'false')
    } else if (el === 'cmi.completion_status' && !['completed', 'incomplete', 'not attempted', 'unknown'].includes(v)) {
      return fail(406, 'false')
    } else if (el === 'cmi.success_status' && !['passed', 'failed', 'unknown'].includes(v)) {
      return fail(406, 'false')
    } else if (el === 'cmi.score.scaled' && !(Number(v) >= -1 && Number(v) <= 1)) {
      return fail(406, 'false')
    }
    values[el] = v
    lastError = 0
    return 'true'
  }

  function initialize(arg) {
    if (arg !== '' && arg != null) return fail(201, 'false')
    if (state === 'running') return fail(is2004 ? 103 : 101, 'false')
    if (state === 'finished') return fail(is2004 ? 104 : 101, 'false')
    state = 'running'
    lastError = 0
    return 'true'
  }

  function commit(arg) {
    if (arg !== '' && arg != null) return fail(201, 'false')
    if (state !== 'running') return fail(is2004 ? (state === 'new' ? 142 : 143) : 301, 'false')
    persist()
    lastError = 0
    return 'true'
  }

  function finish(arg) {
    if (arg !== '' && arg != null) return fail(201, 'false')
    if (state !== 'running') return fail(is2004 ? (state === 'new' ? 112 : 113) : 301, 'false')
    if (!is2004) {
      // SCORM 1.2: a SCO that never reports a status is completed when it finishes,
      // and a mastery score in the manifest decides passed or failed.
      if (values[V12.status] === 'not attempted') values[V12.status] = 'completed'
      const raw = Number(values[V12.raw])
      if (sco.mastery != null && values[V12.raw] !== undefined && values[V12.raw] !== '' && Number.isFinite(raw))
        values[V12.status] = raw >= sco.mastery ? 'passed' : 'failed'
    }
    persist()
    state = 'finished'
    lastError = 0
    return 'true'
  }

  const lastErrorText = () => String(lastError)
  const errorString = (code) => errors[Number(code)] || ''
  const diagnostic = (code) => errors[Number(code || lastError)] || ''

  const api12 = {
    LMSInitialize: initialize,
    LMSFinish: finish,
    LMSGetValue: getValue,
    LMSSetValue: setValue,
    LMSCommit: commit,
    LMSGetLastError: lastErrorText,
    LMSGetErrorString: errorString,
    LMSGetDiagnostic: diagnostic,
  }
  const api2004 = {
    version: '1.0',
    Initialize: initialize,
    Terminate: finish,
    GetValue: getValue,
    SetValue: setValue,
    Commit: commit,
    GetLastError: lastErrorText,
    GetErrorString: errorString,
    GetDiagnostic: diagnostic,
  }

  if (is2004) window.API_1484_11 = api2004
  else window.API = api12

  return function remove() {
    // A frame closed without Finish still keeps what it set.
    if (state === 'running') {
      persist()
      state = 'finished'
    }
    if (is2004) {
      if (window.API_1484_11 === api2004) delete window.API_1484_11
    } else if (window.API === api12) delete window.API
  }
}
