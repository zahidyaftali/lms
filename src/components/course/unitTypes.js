export const UNIT_TYPES = {
  section: { label: 'Section', icon: 'quote', group: 'more' },
  content: { label: 'Content', icon: 'file', group: 'standard' },
  webcontent: { label: 'Web content', icon: 'store', group: 'standard' },
  video: { label: 'Video', icon: 'play', group: 'standard' },
  audio: { label: 'Audio', icon: 'audio', group: 'standard' },
  document: { label: 'Presentation | Document', icon: 'monitor', group: 'standard' },
  iframe: { label: 'iFrame', icon: 'code', group: 'standard' },
  test: { label: 'Test', icon: 'clipboard', group: 'activity' },
  survey: { label: 'Survey', icon: 'checkSquare', group: 'activity' },
  assignment: { label: 'Assignment', icon: 'pencil', group: 'activity' },
  ilt: { label: 'Instructor-led training', icon: 'group', group: 'activity' },
  scorm: { label: 'SCORM | xAPI | cmi5', icon: 'package', group: 'activity' },
}

export const DEFAULT_UNIT_DATA = {
  section: {},
  content: { html: '<h2>New lesson</h2><p>Write your lesson here.</p>' },
  webcontent: { url: '', openInNewTab: true },
  video: { source: 'url', url: '', fileId: null, fileName: '', durationMin: 0 },
  audio: { source: 'url', url: '', fileId: null, fileName: '' },
  document: { fileId: null, fileName: '', fileType: '' },
  iframe: { url: '', height: 520 },
  test: { passingScore: 80, timeLimitMin: 0, maxAttempts: 0, shuffle: false, questions: [] },
  survey: { questions: [] },
  assignment: { instructions: '', dueDays: 7, allowFileUpload: true, maxScore: 100 },
  ilt: { sessions: [] },
  scorm: { fileId: null, fileName: '' },
}

export const unitLabel = (type) => UNIT_TYPES[type]?.label || 'Unit'
export const unitIcon = (type) => UNIT_TYPES[type]?.icon || 'file'
