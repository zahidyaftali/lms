/**
 * Course media (videos, PDFs, SCORM packages, images) is far too large for
 * localStorage, so blobs live in IndexedDB and records only keep the file id.
 */
const DB_NAME = 'ga_lms_files'
const STORE = 'files'
let dbPromise = null

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx(mode) {
  return openDB().then((db) => db.transaction(STORE, mode).objectStore(STORE))
}

/** Set by the data layer: with the shared database, uploads are kept on the server so every device sees them. */
let shared = false
export function setSharedFiles(on) {
  shared = !!on
}

/** The largest file the shared database takes; bigger ones stay in the uploading browser. */
export const SHARED_FILE_LIMIT = 4 * 1024 * 1024
export const isSharedFile = (id) => String(id || '').startsWith('srv_')
const sharedURL = (id) => `/api/rpc?do=file.get&id=${encodeURIComponent(id)}`

async function uploadShared(file, kind) {
  const data = String(await readAsDataURL(file)).split(',')[1] || ''
  const res = await fetch('/api/rpc?do=file.put', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: file.name, type: file.type, kind, data }),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.id) throw new Error(body?.error || 'The file could not be uploaded.')
  return body
}

/**
 * Stores an upload and returns { id, name, type, size, local }. `local` is true
 * when the file only exists in this browser (no shared database, or too large for it).
 */
export async function putFile(file, kind = 'course') {
  if (shared && file.size <= SHARED_FILE_LIMIT) return { ...(await uploadShared(file, kind)), local: false }
  const id = `file_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
  const store = await tx('readwrite')
  await new Promise((resolve, reject) => {
    const req = store.put({ id, blob: file, name: file.name, type: file.type, size: file.size })
    req.onsuccess = resolve
    req.onerror = () => reject(req.error)
  })
  return { id, name: file.name, type: file.type, size: file.size, local: true }
}

export async function getFile(id) {
  if (!id) return null
  const store = await tx('readonly')
  return new Promise((resolve, reject) => {
    const req = store.get(id)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

export async function getFileURL(id) {
  if (isSharedFile(id)) return sharedURL(id)
  const rec = await getFile(id)
  return rec ? URL.createObjectURL(rec.blob) : null
}

export async function deleteFile(id) {
  if (!id) return
  const store = await tx('readwrite')
  store.delete(id)
}

/**
 * Logos are sent to every visitor with the portal settings, so they are scaled
 * to fit maxWidth x maxHeight first. Small SVGs are kept as they are.
 */
export async function shrinkImage(file, { maxWidth = 640, maxHeight = 200 } = {}) {
  const original = await readAsDataURL(file)
  if (file.type === 'image/svg+xml' && file.size < 150 * 1024) return original
  const img = await new Promise((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = reject
    el.src = original
  })
  const scale = Math.min(1, maxWidth / img.naturalWidth, maxHeight / img.naturalHeight)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
  const png = canvas.toDataURL('image/png')
  if (png.length < 300 * 1024) return png
  return canvas.toDataURL('image/webp', 0.9)
}

/** Small images (logos, avatars, course covers) are kept inline as data URLs. */
export function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
