/**
 * SCORM, xAPI and cmi5 packages: the .zip is opened in the browser, its manifest
 * read, and every file stored where the course player can load it from
 * `/scorm/<packageId>/<path>`, so the package's own relative links keep working.
 *
 * - With the shared database, files go to the server (rpc scorm.put / scorm.finish)
 *   and are served from there on every device.
 * - Without one, they go to this browser's Cache Storage and the portal's service
 *   worker (public/lms-sw.js) serves them.
 */
import { uid } from './utils'

export const PACKAGE_CACHE = 'lms-packages-v1'
const CHUNK = 3 * 1024 * 1024

/* ------------------------------------------------------------------ zip files */

const SIG_EOCD = 0x06054b50
const SIG_CENTRAL = 0x02014b50
const SIG_LOCAL = 0x04034b50

/** Reads the table of contents of a zip; `read(entry)` inflates one file. */
export async function readZip(blob) {
  const size = blob.size
  const tailSize = Math.min(size, 65557)
  const tail = new DataView(await blob.slice(size - tailSize).arrayBuffer())
  let end = -1
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === SIG_EOCD) {
      end = i
      break
    }
  }
  if (end < 0) throw new Error('This file is not a zip archive.')
  const count = tail.getUint16(end + 10, true)
  const dirSize = tail.getUint32(end + 12, true)
  const dirOffset = tail.getUint32(end + 16, true)
  if (dirOffset === 0xffffffff || count === 0xffff) throw new Error('This zip uses the Zip64 format. Export the package again as a standard zip.')

  const dir = new DataView(await blob.slice(dirOffset, dirOffset + dirSize).arrayBuffer())
  const utf8 = new TextDecoder()
  const entries = []
  let p = 0
  for (let n = 0; n < count; n++) {
    if (dir.getUint32(p, true) !== SIG_CENTRAL) throw new Error('The zip archive is damaged.')
    const flags = dir.getUint16(p + 8, true)
    const method = dir.getUint16(p + 10, true)
    const compressed = dir.getUint32(p + 20, true)
    const uncompressed = dir.getUint32(p + 24, true)
    const nameLength = dir.getUint16(p + 28, true)
    const extraLength = dir.getUint16(p + 30, true)
    const commentLength = dir.getUint16(p + 32, true)
    const local = dir.getUint32(p + 42, true)
    const name = utf8.decode(new Uint8Array(dir.buffer, dir.byteOffset + p + 46, nameLength)).replace(/\\/g, '/')
    p += 46 + nameLength + extraLength + commentLength
    if (name.endsWith('/') || name.startsWith('__MACOSX/')) continue
    if (flags & 1) throw new Error('Password-protected zip archives cannot be opened.')
    entries.push({ name, method, compressed, size: uncompressed, local })
  }

  async function read(entry) {
    const head = new DataView(await blob.slice(entry.local, entry.local + 30).arrayBuffer())
    if (head.getUint32(0, true) !== SIG_LOCAL) throw new Error('The zip archive is damaged.')
    const start = entry.local + 30 + head.getUint16(26, true) + head.getUint16(28, true)
    const raw = blob.slice(start, start + entry.compressed)
    if (entry.method === 0) return new Uint8Array(await raw.arrayBuffer())
    if (entry.method === 8) {
      if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open zip archives. Use a current version of Chrome, Edge, Firefox or Safari.')
      return new Uint8Array(await new Response(raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer())
    }
    throw new Error(`${entry.name} is compressed in a way this portal cannot open.`)
  }

  return { entries, read }
}

/* ------------------------------------------------------------------ manifests */

const TYPES = {
  html: 'text/html',
  htm: 'text/html',
  js: 'text/javascript',
  mjs: 'text/javascript',
  css: 'text/css',
  json: 'application/json',
  xml: 'application/xml',
  xsd: 'application/xml',
  dtd: 'application/xml-dtd',
  txt: 'text/plain',
  vtt: 'text/vtt',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  ico: 'image/x-icon',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  ogv: 'video/ogg',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  eot: 'application/vnd.ms-fontobject',
  pdf: 'application/pdf',
  swf: 'application/x-shockwave-flash',
  wasm: 'application/wasm',
}

export const typeOf = (path) => TYPES[String(path).split('.').pop().toLowerCase()] || 'application/octet-stream'

const XML_NS = 'http://www.w3.org/XML/1998/namespace'
const byName = (el, name) => Array.from(el.getElementsByTagNameNS('*', name))
const child = (el, name) => Array.from(el.children).find((c) => c.localName.toLowerCase() === name.toLowerCase()) || null
const text = (el) => el?.textContent?.trim() || ''
const baseOf = (el) => el?.getAttributeNS(XML_NS, 'base') || el?.getAttribute('xml:base') || ''

function parseXml(source) {
  const doc = new DOMParser().parseFromString(source, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('The package manifest could not be read.')
  return doc
}

/** imsmanifest.xml → { kind: 'scorm12' | 'scorm2004', title, scos: [{ id, title, href, mastery, launchData, threshold }] } */
function readScormManifest(source) {
  const doc = parseXml(source)
  const version = text(byName(doc, 'schemaversion')[0])
  const kind = /2004|CAM\s*1\.3/i.test(version) || (/adlcp_v1p3/i.test(source) && !/adlcp_rootv1p2/i.test(source)) ? 'scorm2004' : 'scorm12'
  const organizations = byName(doc, 'organizations')[0]
  const all = byName(doc, 'organization')
  const org = all.find((o) => o.getAttribute('identifier') === organizations?.getAttribute('default')) || all[0] || null
  const resourcesEl = byName(doc, 'resources')[0]
  const resources = new Map(byName(doc, 'resource').map((r) => [r.getAttribute('identifier'), r]))
  const hrefOf = (res) => (res?.getAttribute('href') ? baseOf(resourcesEl) + baseOf(res) + res.getAttribute('href') : '')

  const scos = (org ? byName(org, 'item') : [])
    .filter((item) => item.getAttribute('identifierref') && item.getAttribute('isvisible') !== 'false')
    .map((item) => {
      const res = resources.get(item.getAttribute('identifierref'))
      let href = hrefOf(res)
      if (!href) return null
      const params = item.getAttribute('parameters')
      if (params) href += (href.includes('?') ? '&' : '?') + params.replace(/^[?&]/, '')
      return {
        id: item.getAttribute('identifier') || uid('sco'),
        title: text(child(item, 'title')) || text(child(org, 'title')) || 'Lesson',
        href,
        mastery: Number(text(child(item, 'masteryscore'))) || null,
        launchData: text(child(item, 'datafromlms') || child(item, 'dataFromLMS')),
        threshold: Number(text(child(item, 'completionThreshold'))) || null,
      }
    })
    .filter(Boolean)

  // A manifest without an organization still names the resource to start.
  if (!scos.length) {
    const first = [...resources.values()].find((r) => hrefOf(r) && /sco/i.test(r.getAttribute('adlcp:scormtype') || r.getAttribute('adlcp:scormType') || 'sco'))
    if (first) scos.push({ id: first.getAttribute('identifier') || 'sco', title: 'Lesson', href: hrefOf(first), mastery: null, launchData: '', threshold: null })
  }
  if (!scos.length) throw new Error('The manifest does not say which page to start.')
  return { kind, title: text(child(org || doc.documentElement, 'title')) || scos[0].title, scos }
}

/** tincan.xml → the activity to launch. */
function readTinCan(source) {
  const doc = parseXml(source)
  const activity = byName(doc, 'activity').find((a) => text(child(a, 'launch')))
  if (!activity) throw new Error('tincan.xml does not name a page to launch.')
  const id = activity.getAttribute('id') || ''
  const title = text(child(activity, 'name')) || 'Lesson'
  return { kind: 'xapi', title, activityId: id, scos: [{ id: id || 'activity', title, href: text(child(activity, 'launch')), activityId: id }] }
}

/** cmi5.xml → its assignable units. */
function readCmi5(source) {
  const doc = parseXml(source)
  const course = byName(doc, 'course')[0]
  const titleOf = (el) => text(byName(child(el, 'title') || el, 'langstring')[0]) || text(child(el, 'title'))
  const scos = byName(doc, 'au')
    .map((au) => ({ id: au.getAttribute('id') || uid('au'), title: titleOf(au) || 'Lesson', href: text(child(au, 'url')), activityId: au.getAttribute('id') || '', moveOn: au.getAttribute('moveOn') || 'CompletedOrPassed' }))
    .filter((au) => au.href)
  if (!scos.length) throw new Error('cmi5.xml has no assignable unit to launch.')
  return { kind: 'cmi5', title: (course && titleOf(course)) || scos[0].title, activityId: course?.getAttribute('id') || '', scos }
}

/** Finds the manifest (possibly inside a top-level folder) and reads it. */
export async function inspectPackage(zip) {
  const find = (file) => zip.entries.filter((e) => e.name.split('/').pop().toLowerCase() === file).sort((a, b) => a.name.length - b.name.length)[0]
  const found = find('imsmanifest.xml') || find('cmi5.xml') || find('tincan.xml')
  if (!found) throw new Error('This zip has no imsmanifest.xml (SCORM), cmi5.xml or tincan.xml (xAPI). Export it from your authoring tool as a SCORM, xAPI or cmi5 package.')
  const root = found.name.slice(0, found.name.length - found.name.split('/').pop().length)
  const source = new TextDecoder().decode(await zip.read(found))
  const file = found.name.split('/').pop().toLowerCase()
  const info = file === 'imsmanifest.xml' ? readScormManifest(source) : file === 'cmi5.xml' ? readCmi5(source) : readTinCan(source)
  // Remote AUs (a full URL) are launched where they are; everything else is inside the package.
  return { ...info, root, scos: info.scos.map((s) => ({ ...s, href: s.href.replace(/^\.\//, '') })) }
}

/* -------------------------------------------------------------------- storing */

const toBase64 = (bytes) => {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

async function post(action, body) {
  const res = await fetch(`/api/rpc?do=${action}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const answer = await res.json().catch(() => null)
  if (!res.ok) throw new Error(answer?.error || 'The package could not be uploaded.')
  return answer
}

/** Runs `jobs` with at most `width` of them at a time. */
async function inParallel(jobs, width = 4) {
  let next = 0
  const lane = async () => {
    while (next < jobs.length) await jobs[next++]()
  }
  await Promise.all(Array.from({ length: Math.min(width, jobs.length) }, lane))
}

/**
 * Opens an uploaded .zip and stores its files. Returns what a unit keeps:
 * { packageId, kind, title, scos, fileName, fileSize, files, shared }.
 */
export async function storePackage(file, { shared, onProgress = () => {} }) {
  const zip = await readZip(file)
  const info = await inspectPackage(zip)
  const packageId = uid('pkg')
  const files = zip.entries.filter((e) => e.name.startsWith(info.root))
  const relative = (e) => e.name.slice(info.root.length)
  let done = 0
  const tick = () => onProgress(Math.round((++done / files.length) * 100))

  if (shared) {
    const listing = []
    await inParallel(
      files.map((entry) => async () => {
        const bytes = await zip.read(entry)
        const path = relative(entry)
        const chunks = Math.max(1, Math.ceil(bytes.length / CHUNK))
        for (let i = 0; i < chunks; i++) {
          await post('scorm.put', { packageId, path, index: i, data: toBase64(bytes.subarray(i * CHUNK, (i + 1) * CHUNK)) })
        }
        listing.push({ path, size: bytes.length, type: typeOf(path), chunks })
        tick()
      }),
    )
    await post('scorm.finish', { packageId, kind: info.kind, title: info.title, files: listing })
  } else {
    if (!('caches' in window)) throw new Error('This browser cannot store packages. Use a current version of Chrome, Edge, Firefox or Safari.')
    const cache = await caches.open(PACKAGE_CACHE)
    await inParallel(
      files.map((entry) => async () => {
        const bytes = await zip.read(entry)
        const path = relative(entry)
        await cache.put(
          packageURL(packageId, path),
          new Response(bytes, { headers: { 'Content-Type': typeOf(path), 'Content-Length': String(bytes.length) } }),
        )
        tick()
      }),
      8,
    )
  }

  return {
    packageId,
    kind: info.kind,
    title: info.title,
    activityId: info.activityId || '',
    scos: info.scos,
    fileName: file.name,
    fileSize: file.size,
    files: files.length,
    shared: !!shared,
  }
}

/** The address a file of a stored package is served from. */
export function packageURL(packageId, path) {
  const clean = String(path || '')
    .split('/')
    .map((part) => encodeURIComponent(decodeURIComponent(part)))
    .join('/')
  return `${window.location.origin}/scorm/${packageId}/${clean}`
}

/** Whether this browser still holds a package stored without the shared database. */
export async function hasLocalPackage(packageId, path) {
  if (!('caches' in window)) return false
  const cache = await caches.open(PACKAGE_CACHE)
  return !!(await cache.match(packageURL(packageId, path).split('?')[0]))
}

/* ------------------------------------------------------------- service worker */

let worker = null

/** Registers the worker that serves packages and answers xAPI calls, and waits until it is active. */
export function packageWorker() {
  if (!('serviceWorker' in navigator)) return Promise.reject(new Error('This browser cannot play packages. Use a current version of Chrome, Edge, Firefox or Safari.'))
  worker ||= navigator.serviceWorker
    .register('/lms-sw.js', { scope: '/' })
    .then(() => navigator.serviceWorker.ready)
    .catch((err) => {
      worker = null
      throw err
    })
  return worker
}
