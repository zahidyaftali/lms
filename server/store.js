/**
 * Where the shared portal data lives.
 *
 * - On Vercel with a connected Postgres database (Neon, via the Vercel Marketplace),
 *   `DATABASE_URL` / `POSTGRES_URL` is set and records go to Postgres.
 * - On a developer machine without a database, records go to `.data/lms-db.json`
 *   so the API can be exercised locally.
 * - On Vercel without a database there is no store; the app then stays in its
 *   browser-only mode.
 *
 * Every record is one row: (collection, id, data). Collections that start with
 * "_" are server-only and never sent to a browser. Password hashes live in their
 * own table so no query that feeds a page can ever read them.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const databaseUrl = () => process.env.DATABASE_URL || process.env.POSTGRES_URL || ''

export function storeKind() {
  if (databaseUrl()) return 'postgres'
  if (!process.env.VERCEL) return 'file'
  return null
}

let cached = null
export async function getStore() {
  if (cached) return cached
  const kind = storeKind()
  if (kind === 'postgres') cached = await postgresStore(databaseUrl())
  else if (kind === 'file') cached = fileStore(resolve(process.cwd(), '.data/lms-db.json'))
  return cached
}

/* ------------------------------------------------------------------ Postgres */

async function postgresStore(url) {
  const { neon } = await import('@neondatabase/serverless')
  return sqlStore(neon(url))
}

/** Postgres through any tagged-template `sql` function (Neon's driver in production). */
export function sqlStore(sql) {
  let schemaReady = null

  return {
    kind: 'postgres',
    ensureSchema() {
      schemaReady ||= (async () => {
        await sql`create table if not exists lms_records (
          collection text not null,
          id text not null,
          data jsonb not null,
          updated_at timestamptz not null default now(),
          primary key (collection, id)
        )`
        await sql`create table if not exists lms_credentials (
          user_id text primary key,
          hash text not null,
          updated_at timestamptz not null default now()
        )`
        await sql`create table if not exists lms_files (
          id text primary key,
          name text not null,
          type text not null,
          size integer not null,
          owner text,
          data text not null,
          created_at timestamptz not null default now()
        )`
      })()
      return schemaReady
    },
    async all() {
      // No LIKE here: the driver drops the backslash, and a bare '_' would match every row.
      return sql`select collection, id, data from lms_records where left(collection, 1) <> '_'`
    },
    async get(collection, id) {
      const rows = await sql`select data from lms_records where collection = ${collection} and id = ${id}`
      return rows[0]?.data ?? null
    },
    async findUserByEmail(email) {
      const rows = await sql`select data from lms_records
        where collection = 'users' and lower(data->>'email') = lower(${email}) limit 1`
      return rows[0]?.data ?? null
    },
    async countUsers() {
      const rows = await sql`select count(*)::int as n from lms_records where collection = 'users'`
      return rows[0].n
    },
    async upsert(rows) {
      if (!rows.length) return
      await sql`insert into lms_records (collection, id, data)
        select r.collection, r.id, r.data
        from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) as r(collection text, id text, data jsonb)
        on conflict (collection, id) do update set data = excluded.data, updated_at = now()`
    },
    async remove(keys) {
      if (!keys.length) return
      await sql`delete from lms_records t
        using jsonb_to_recordset(${JSON.stringify(keys)}::jsonb) as k(collection text, id text)
        where t.collection = k.collection and t.id = k.id`
    },
    async getHash(userId) {
      const rows = await sql`select hash from lms_credentials where user_id = ${userId}`
      return rows[0]?.hash ?? null
    },
    async setHashes(list) {
      if (!list.length) return
      await sql`insert into lms_credentials (user_id, hash)
        select c."userId", c.hash from jsonb_to_recordset(${JSON.stringify(list)}::jsonb) as c("userId" text, hash text)
        on conflict (user_id) do update set hash = excluded.hash, updated_at = now()`
    },
    async removeHashes(userIds) {
      if (!userIds.length) return
      await sql`delete from lms_credentials where user_id = any(${userIds})`
    },
    /** Every record of one collection, including the server-only ones that start with "_". */
    async allIn(collection) {
      const rows = await sql`select data from lms_records where collection = ${collection}`
      return rows.map((r) => r.data)
    },
    /** Uploaded course files and assignment attachments; `data` is base64. */
    async putFile(file) {
      await sql`insert into lms_files (id, name, type, size, owner, data)
        values (${file.id}, ${file.name}, ${file.type}, ${file.size}, ${file.owner}, ${file.data})
        on conflict (id) do nothing`
    },
    async getFile(id) {
      const rows = await sql`select id, name, type, size, owner, data from lms_files where id = ${id}`
      return rows[0] ?? null
    },
    async removeFile(id) {
      await sql`delete from lms_files where id = ${id}`
    },
  }
}

/* ------------------------------------------------------------ local JSON file */

function fileStore(path) {
  const filesDir = resolve(dirname(path), 'files')
  const safe = (id) => String(id).replace(/[^w-]/g, '')
  let queue = Promise.resolve()
  const read = () => {
    if (!existsSync(path)) return { records: {}, credentials: {} }
    return JSON.parse(readFileSync(path, 'utf8'))
  }
  const write = (db) => {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify(db))
  }
  // One writer at a time, so overlapping requests never lose each other's changes.
  const change = (fn) => (queue = queue.then(() => {
    const db = read()
    const out = fn(db)
    write(db)
    return out
  }))

  return {
    kind: 'file',
    ensureSchema: async () => {},
    async all() {
      const db = read()
      return Object.entries(db.records)
        .filter(([collection]) => !collection.startsWith('_'))
        .flatMap(([collection, byId]) => Object.entries(byId).map(([id, data]) => ({ collection, id, data })))
    },
    async get(collection, id) {
      return read().records[collection]?.[id] ?? null
    },
    async findUserByEmail(email) {
      const target = String(email).toLowerCase()
      return Object.values(read().records.users || {}).find((u) => String(u.email).toLowerCase() === target) ?? null
    },
    async countUsers() {
      return Object.keys(read().records.users || {}).length
    },
    upsert: (rows) =>
      change((db) => {
        rows.forEach(({ collection, id, data }) => {
          db.records[collection] ||= {}
          db.records[collection][id] = data
        })
      }),
    remove: (keys) =>
      change((db) => {
        keys.forEach(({ collection, id }) => {
          if (db.records[collection]) delete db.records[collection][id]
        })
      }),
    async getHash(userId) {
      return read().credentials[userId] ?? null
    },
    setHashes: (list) =>
      change((db) => {
        list.forEach(({ userId, hash }) => (db.credentials[userId] = hash))
      }),
    removeHashes: (userIds) =>
      change((db) => {
        userIds.forEach((id) => delete db.credentials[id])
      }),
    async allIn(collection) {
      return Object.values(read().records[collection] || {})
    },
    async putFile(file) {
      mkdirSync(filesDir, { recursive: true })
      writeFileSync(resolve(filesDir, `${safe(file.id)}.json`), JSON.stringify(file))
    },
    async getFile(id) {
      const at = resolve(filesDir, `${safe(id)}.json`)
      return existsSync(at) ? JSON.parse(readFileSync(at, 'utf8')) : null
    },
    async removeFile(id) {
      rmSync(resolve(filesDir, `${safe(id)}.json`), { force: true })
    },
  }
}
