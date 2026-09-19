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

export async function putFile(file) {
  const id = `file_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
  const store = await tx('readwrite')
  await new Promise((resolve, reject) => {
    const req = store.put({ id, blob: file, name: file.name, type: file.type, size: file.size })
    req.onsuccess = resolve
    req.onerror = () => reject(req.error)
  })
  return { id, name: file.name, type: file.type, size: file.size }
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
  const rec = await getFile(id)
  return rec ? URL.createObjectURL(rec.blob) : null
}

export async function deleteFile(id) {
  if (!id) return
  const store = await tx('readwrite')
  store.delete(id)
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
