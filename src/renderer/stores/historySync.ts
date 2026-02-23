import storage from '@/storage'
import {
  exportHistoryTransferFile,
  importHistoryTransferFile,
} from './historyTransfer'

const HISTORY_SYNC_STATE_KEY = 'history-sync-state'

type SyncStorage = Pick<typeof storage, 'getItem' | 'setItemNow'>

type SyncHistoryPayload = {
  __type: string
  __version: number
  __exported_at: string
  __storage_type?: string
  sessionMetaList: unknown[]
  sessions: unknown[]
}

type RemoteHistorySnapshot = {
  revision: number
  updatedAt: string
  payload: SyncHistoryPayload
}

type PutRemoteSnapshotSuccess = {
  ok: true
  snapshot: RemoteHistorySnapshot
}

type PutRemoteSnapshotFailure = {
  ok: false
  status: number
  body: unknown
}

type PutRemoteSnapshotResult = PutRemoteSnapshotSuccess | PutRemoteSnapshotFailure

type SyncState = {
  revision: number
  lastSyncedAt?: string
  lastError?: string
}

export type HistorySyncState = SyncState

type SyncDependencies = {
  store?: SyncStorage
  fetchImpl?: typeof fetch
  exportHistory?: typeof exportHistoryTransferFile
  importHistory?: typeof importHistoryTransferFile
}

export type HistorySyncConfig = {
  endpoint?: string
  token?: string
}

export type PullHistoryResult = {
  changed: boolean
  revision: number
  imported: number
  updated: number
  skipped: number
}

export type PushHistoryResult = {
  pushed: boolean
  revision: number
  conflictResolved: boolean
  imported: number
  updated: number
  skipped: number
}

export type SyncNowResult = {
  pull: PullHistoryResult
  push: PushHistoryResult
}

const DEFAULT_SYNC_STATE: SyncState = {
  revision: 0,
}

let syncQueue: Promise<void> = Promise.resolve()

async function withSyncLock<T>(runner: () => Promise<T>): Promise<T> {
  const task = syncQueue.then(runner, runner)
  syncQueue = task.then(
    () => undefined,
    () => undefined
  )
  return task
}

function normalizeEndpoint(endpoint: string): string {
  return endpoint.trim().replace(/\/+$/, '')
}

function normalizeConfig(config: HistorySyncConfig): { endpoint: string; token: string } {
  const endpoint = config.endpoint?.trim()
  const token = config.token?.trim()

  if (!endpoint) {
    throw new Error('History sync endpoint is required')
  }
  if (!token) {
    throw new Error('History sync token is required')
  }

  return {
    endpoint: normalizeEndpoint(endpoint),
    token,
  }
}

function buildHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'x-sync-token': token,
    'Content-Type': 'application/json',
  }
}

async function readResponseBody(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => '')
  if (!text) {
    return null
  }
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function formatHttpError(prefix: string, status: number, body: unknown): Error {
  const detail =
    typeof body === 'string'
      ? body
      : typeof body === 'object' && body && 'message' in body && typeof body.message === 'string'
        ? body.message
        : JSON.stringify(body)
  return new Error(`${prefix} (${status}): ${detail || 'Unknown server error'}`)
}

function parseRemoteSnapshot(value: unknown): RemoteHistorySnapshot {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid sync response: expected object')
  }

  const revision = (value as { revision?: unknown }).revision
  const updatedAt = (value as { updatedAt?: unknown }).updatedAt
  const payload = (value as { payload?: unknown }).payload

  if (typeof revision !== 'number' || !Number.isFinite(revision) || revision < 0) {
    throw new Error('Invalid sync response: revision is missing')
  }
  if (typeof updatedAt !== 'string') {
    throw new Error('Invalid sync response: updatedAt is missing')
  }
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid sync response: payload is missing')
  }

  return {
    revision,
    updatedAt,
    payload: payload as SyncHistoryPayload,
  }
}

function createDeps(deps?: SyncDependencies): Required<SyncDependencies> {
  return {
    store: deps?.store || storage,
    fetchImpl: deps?.fetchImpl || fetch,
    exportHistory: deps?.exportHistory || exportHistoryTransferFile,
    importHistory: deps?.importHistory || importHistoryTransferFile,
  }
}

async function readSyncState(store: SyncStorage): Promise<SyncState> {
  const state = await store.getItem<SyncState>(HISTORY_SYNC_STATE_KEY, DEFAULT_SYNC_STATE)
  return {
    revision: typeof state?.revision === 'number' && Number.isFinite(state.revision) ? state.revision : 0,
    lastSyncedAt: typeof state?.lastSyncedAt === 'string' ? state.lastSyncedAt : undefined,
    lastError: typeof state?.lastError === 'string' ? state.lastError : undefined,
  }
}

async function writeSyncState(store: SyncStorage, state: SyncState): Promise<void> {
  await store.setItemNow(HISTORY_SYNC_STATE_KEY, state)
}

async function fetchRemoteSnapshot(config: { endpoint: string; token: string }, deps: Required<SyncDependencies>) {
  const response = await deps.fetchImpl(`${config.endpoint}/api/history-sync`, {
    method: 'GET',
    headers: buildHeaders(config.token),
  })

  const body = await readResponseBody(response)
  if (!response.ok) {
    throw formatHttpError('Failed to fetch remote history snapshot', response.status, body)
  }

  return parseRemoteSnapshot(body)
}

async function putRemoteSnapshot(
  config: { endpoint: string; token: string },
  request: { baseRevision: number; payload: SyncHistoryPayload },
  deps: Required<SyncDependencies>
): Promise<PutRemoteSnapshotResult> {
  const response = await deps.fetchImpl(`${config.endpoint}/api/history-sync`, {
    method: 'PUT',
    headers: buildHeaders(config.token),
    body: JSON.stringify(request),
  })

  const body = await readResponseBody(response)
  if (!response.ok) {
    return { ok: false, status: response.status, body }
  }

  return {
    ok: true,
    snapshot: parseRemoteSnapshot(body),
  }
}

function isPutRemoteSnapshotSuccess(result: PutRemoteSnapshotResult): result is PutRemoteSnapshotSuccess {
  return result.ok
}

async function exportSyncPayload(deps: Required<SyncDependencies>): Promise<SyncHistoryPayload> {
  const exported = await deps.exportHistory()
  return JSON.parse(exported.content) as SyncHistoryPayload
}

export async function getHistorySyncState(deps?: Pick<SyncDependencies, 'store'>): Promise<SyncState> {
  const store = deps?.store || storage
  return await readSyncState(store)
}

export async function testHistorySyncConnection(config: HistorySyncConfig, deps?: SyncDependencies) {
  const normalized = normalizeConfig(config)
  const resolvedDeps = createDeps(deps)
  return await fetchRemoteSnapshot(normalized, resolvedDeps)
}

async function pullHistoryFromServerInternal(
  config: HistorySyncConfig,
  deps: Required<SyncDependencies>
): Promise<PullHistoryResult> {
  const normalized = normalizeConfig(config)
  const state = await readSyncState(deps.store)
  const remoteSnapshot = await fetchRemoteSnapshot(normalized, deps)

  if (remoteSnapshot.revision <= state.revision) {
    return {
      changed: false,
      revision: state.revision,
      imported: 0,
      updated: 0,
      skipped: 0,
    }
  }

  const importResult = await deps.importHistory(JSON.stringify(remoteSnapshot.payload))
  await writeSyncState(deps.store, {
    revision: remoteSnapshot.revision,
    lastSyncedAt: new Date().toISOString(),
  })

  return {
    changed: importResult.imported > 0 || importResult.updated > 0,
    revision: remoteSnapshot.revision,
    imported: importResult.imported,
    updated: importResult.updated,
    skipped: importResult.skipped,
  }
}

export async function pullHistoryFromServer(config: HistorySyncConfig, deps?: SyncDependencies): Promise<PullHistoryResult> {
  const resolvedDeps = createDeps(deps)
  return withSyncLock(() => pullHistoryFromServerInternal(config, resolvedDeps))
}

function parseConflictSnapshot(body: unknown): RemoteHistorySnapshot | null {
  if (!body || typeof body !== 'object') {
    return null
  }
  const snapshot = (body as { snapshot?: unknown }).snapshot
  if (!snapshot) {
    return null
  }
  try {
    return parseRemoteSnapshot(snapshot)
  } catch {
    return null
  }
}

async function pushHistoryToServerInternal(
  config: HistorySyncConfig,
  deps: Required<SyncDependencies>
): Promise<PushHistoryResult> {
  const normalized = normalizeConfig(config)
  const state = await readSyncState(deps.store)

  const localPayload = await exportSyncPayload(deps)
  const firstAttempt = await putRemoteSnapshot(
    normalized,
    { baseRevision: state.revision, payload: localPayload },
    deps
  )

  if (isPutRemoteSnapshotSuccess(firstAttempt)) {
    await writeSyncState(deps.store, {
      revision: firstAttempt.snapshot.revision,
      lastSyncedAt: new Date().toISOString(),
    })
    return {
      pushed: true,
      revision: firstAttempt.snapshot.revision,
      conflictResolved: false,
      imported: 0,
      updated: 0,
      skipped: 0,
    }
  }

  if (firstAttempt.status !== 409) {
    throw formatHttpError('Failed to push history snapshot', firstAttempt.status, firstAttempt.body)
  }

  const conflictSnapshot = parseConflictSnapshot(firstAttempt.body)
  if (!conflictSnapshot) {
    throw formatHttpError('History push conflict without valid snapshot', firstAttempt.status, firstAttempt.body)
  }

  const conflictImportResult = await deps.importHistory(JSON.stringify(conflictSnapshot.payload))
  await writeSyncState(deps.store, {
    revision: conflictSnapshot.revision,
    lastSyncedAt: new Date().toISOString(),
  })

  const mergedPayload = await exportSyncPayload(deps)
  const secondAttempt = await putRemoteSnapshot(
    normalized,
    {
      baseRevision: conflictSnapshot.revision,
      payload: mergedPayload,
    },
    deps
  )

  if (!isPutRemoteSnapshotSuccess(secondAttempt)) {
    throw formatHttpError('Failed to push merged history snapshot', secondAttempt.status, secondAttempt.body)
  }

  await writeSyncState(deps.store, {
    revision: secondAttempt.snapshot.revision,
    lastSyncedAt: new Date().toISOString(),
  })

  return {
    pushed: true,
    revision: secondAttempt.snapshot.revision,
    conflictResolved: true,
    imported: conflictImportResult.imported,
    updated: conflictImportResult.updated,
    skipped: conflictImportResult.skipped,
  }
}

export async function pushHistoryToServer(config: HistorySyncConfig, deps?: SyncDependencies): Promise<PushHistoryResult> {
  const resolvedDeps = createDeps(deps)
  return withSyncLock(() => pushHistoryToServerInternal(config, resolvedDeps))
}

function createSkippedPushResult(revision: number): PushHistoryResult {
  return {
    pushed: false,
    revision,
    conflictResolved: false,
    imported: 0,
    updated: 0,
    skipped: 0,
  }
}

export async function syncHistoryNow(config: HistorySyncConfig, deps?: SyncDependencies): Promise<SyncNowResult> {
  const resolvedDeps = createDeps(deps)
  return withSyncLock(async () => {
    try {
      const pull = await pullHistoryFromServerInternal(config, resolvedDeps)
      if (pull.changed) {
        return {
          pull,
          push: createSkippedPushResult(pull.revision),
        }
      }

      const push = await pushHistoryToServerInternal(config, resolvedDeps)
      return { pull, push }
    } catch (error) {
      const state = await readSyncState(resolvedDeps.store)
      await writeSyncState(resolvedDeps.store, {
        ...state,
        lastError: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  })
}
