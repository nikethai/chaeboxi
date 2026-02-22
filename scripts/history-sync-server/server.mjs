import { createServer } from 'node:http'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createClient } from '@libsql/client'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const HOST = process.env.SYNC_HOST || '0.0.0.0'
const PORT = Number(process.env.PORT || 8788)
const TOKEN = process.env.SYNC_TOKEN?.trim() || ''
const CORS_ORIGIN = process.env.SYNC_CORS_ORIGIN || '*'
const MAX_BODY_BYTES = Number(process.env.SYNC_MAX_BODY_BYTES || 20 * 1024 * 1024)
const DB_PATH = process.env.SYNC_DB_PATH || path.join(__dirname, 'data', 'history-sync.db')

if (!TOKEN) {
  throw new Error('SYNC_TOKEN is required')
}

const DEFAULT_PAYLOAD = {
  __type: 'chatbox-history-transfer',
  __version: 1,
  __exported_at: new Date(0).toISOString(),
  sessionMetaList: [],
  sessions: [],
}

const dbUrl = pathToFileURL(path.resolve(DB_PATH)).toString()
const db = createClient({ url: dbUrl })

function isObject(value) {
  return typeof value === 'object' && value !== null
}

function writeCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,x-sync-token')
}

function sendJson(res, status, data) {
  writeCorsHeaders(res)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}

function getRequestToken(req) {
  const authHeader = req.headers.authorization
  if (typeof authHeader === 'string') {
    const match = authHeader.match(/^Bearer\s+(.+)$/i)
    if (match?.[1]) {
      return match[1].trim()
    }
  }

  const syncToken = req.headers['x-sync-token']
  if (typeof syncToken === 'string') {
    return syncToken.trim()
  }
  if (Array.isArray(syncToken) && syncToken[0]) {
    return syncToken[0].trim()
  }

  return ''
}

function requireAuth(req, res) {
  const requestToken = getRequestToken(req)
  if (!requestToken || requestToken !== TOKEN) {
    sendJson(res, 401, { message: 'Unauthorized' })
    return false
  }
  return true
}

async function readBodyJson(req) {
  const chunks = []
  let totalBytes = 0

  for await (const chunk of req) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
    totalBytes += buf.length
    if (totalBytes > MAX_BODY_BYTES) {
      const err = new Error('Request body is too large')
      err.statusCode = 413
      throw err
    }
    chunks.push(buf)
  }

  if (chunks.length === 0) {
    return {}
  }

  const text = Buffer.concat(chunks).toString('utf8')
  try {
    return JSON.parse(text)
  } catch {
    const err = new Error('Invalid JSON body')
    err.statusCode = 400
    throw err
  }
}

function validatePutBody(body) {
  if (!isObject(body)) {
    const err = new Error('Request body must be an object')
    err.statusCode = 400
    throw err
  }

  const baseRevision = body.baseRevision
  if (typeof baseRevision !== 'number' || !Number.isInteger(baseRevision) || baseRevision < 0) {
    const err = new Error('baseRevision must be a non-negative integer')
    err.statusCode = 400
    throw err
  }

  const payload = body.payload
  if (!isObject(payload)) {
    const err = new Error('payload must be an object')
    err.statusCode = 400
    throw err
  }

  if (!Array.isArray(payload.sessions) || !Array.isArray(payload.sessionMetaList)) {
    const err = new Error('payload.sessions and payload.sessionMetaList must be arrays')
    err.statusCode = 400
    throw err
  }

  return { baseRevision, payload }
}

async function initDatabase() {
  await mkdir(path.dirname(DB_PATH), { recursive: true })

  await db.execute(`
    CREATE TABLE IF NOT EXISTS history_snapshot (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      revision INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      payload_json TEXT NOT NULL
    )
  `)

  await db.execute({
    sql: `
      INSERT INTO history_snapshot (id, revision, updated_at, payload_json)
      VALUES (1, 0, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `,
    args: [new Date(0).toISOString(), JSON.stringify(DEFAULT_PAYLOAD)],
  })
}

function normalizeSnapshotRow(row) {
  const revision = typeof row.revision === 'number' ? row.revision : Number(row.revision || 0)
  const updatedAt = typeof row.updated_at === 'string' ? row.updated_at : String(row.updated_at || '')
  let payload = DEFAULT_PAYLOAD
  try {
    payload = JSON.parse(String(row.payload_json))
  } catch {
    payload = DEFAULT_PAYLOAD
  }

  return {
    revision,
    updatedAt,
    payload,
  }
}

async function readSnapshot() {
  const result = await db.execute('SELECT revision, updated_at, payload_json FROM history_snapshot WHERE id = 1')
  const row = result.rows?.[0]
  if (!row) {
    throw new Error('Snapshot row not found')
  }
  return normalizeSnapshotRow(row)
}

async function putSnapshot(baseRevision, payload) {
  const now = new Date().toISOString()
  const updateResult = await db.execute({
    sql: `
      UPDATE history_snapshot
      SET revision = revision + 1, updated_at = ?, payload_json = ?
      WHERE id = 1 AND revision = ?
    `,
    args: [now, JSON.stringify(payload), baseRevision],
  })

  return updateResult.rowsAffected > 0
}

async function handleHealth(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { message: 'Method not allowed' })
    return
  }

  const snapshot = await readSnapshot()
  sendJson(res, 200, {
    ok: true,
    revision: snapshot.revision,
    updatedAt: snapshot.updatedAt,
  })
}

async function handleHistorySync(req, res) {
  if (!requireAuth(req, res)) {
    return
  }

  if (req.method === 'GET') {
    const snapshot = await readSnapshot()
    sendJson(res, 200, snapshot)
    return
  }

  if (req.method !== 'PUT') {
    sendJson(res, 405, { message: 'Method not allowed' })
    return
  }

  const body = await readBodyJson(req)
  const { baseRevision, payload } = validatePutBody(body)

  const updated = await putSnapshot(baseRevision, payload)
  if (!updated) {
    const snapshot = await readSnapshot()
    sendJson(res, 409, {
      message: 'Revision conflict',
      snapshot,
    })
    return
  }

  const snapshot = await readSnapshot()
  sendJson(res, 200, snapshot)
}

async function requestHandler(req, res) {
  try {
    if (req.method === 'OPTIONS') {
      writeCorsHeaders(res)
      res.statusCode = 204
      res.end()
      return
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    if (url.pathname === '/health') {
      await handleHealth(req, res)
      return
    }
    if (url.pathname === '/api/history-sync') {
      await handleHistorySync(req, res)
      return
    }

    sendJson(res, 404, { message: 'Not found' })
  } catch (error) {
    const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : 500
    const message = error instanceof Error ? error.message : 'Unexpected error'
    sendJson(res, statusCode, { message })
  }
}

await initDatabase()

const server = createServer((req, res) => {
  void requestHandler(req, res)
})

server.listen(PORT, HOST, () => {
  console.log(`[history-sync-server] listening on http://${HOST}:${PORT}`)
  console.log(`[history-sync-server] sqlite db: ${path.resolve(DB_PATH)}`)
})

async function shutdown(signal) {
  console.log(`[history-sync-server] shutting down (${signal})`)
  server.close(async () => {
    await db.close()
    process.exit(0)
  })
}

process.on('SIGINT', () => {
  void shutdown('SIGINT')
})
process.on('SIGTERM', () => {
  void shutdown('SIGTERM')
})
