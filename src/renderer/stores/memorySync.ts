import type { MemorySyncConfig } from '@shared/types/settings'
import { decryptMemorySyncPayload, encryptMemorySyncPayload } from '@/packages/memory/crypto'
import { mergeMemorySnapshots } from '@/packages/memory/merge'
import { getMemoryRepository } from '@/packages/memory/repository'
import {
  buildMemorySyncSnapshot,
  parseMemorySyncSnapshot,
  serializeMemorySyncSnapshot,
} from '@/packages/memory/snapshot'
import type { MemorySyncSnapshot, MemorySyncState, RemoteMemoryState } from '@/packages/memory/sync-types'
import storage from '@/storage'
import { memoryStore } from '@/stores/memoryStore'

const MEMORY_SYNC_STATE_KEY = 'memory-sync-state'

type SyncStorage = Pick<typeof storage, 'getItem' | 'setItemNow'>

type SyncDependencies = {
  store?: SyncStorage
  fetchImpl?: typeof fetch
  getSnapshot?: () => Promise<MemorySyncSnapshot>
  applySnapshot?: (snapshot: MemorySyncSnapshot) => Promise<void>
}

const DEFAULT_SYNC_STATE: MemorySyncState = {
  revision: 0,
}

let syncQueue: Promise<unknown> = Promise.resolve()

function withSyncLock<T>(runner: () => Promise<T>): Promise<T> {
  const task = syncQueue.then(runner, runner)
  syncQueue = task.then(
    () => undefined,
    () => undefined
  )
  return task
}

function normalizeConfig(config: MemorySyncConfig): { endpoint: string; token: string } {
  const endpoint = config.endpoint?.trim()
  const token = config.token?.trim()

  if (!endpoint) {
    throw new Error('Memory sync endpoint is required')
  }
  if (!token) {
    throw new Error('Memory sync token is required')
  }

  return {
    endpoint: endpoint.replace(/\/+$/, ''),
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

function parseRemoteState(value: unknown): RemoteMemoryState {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid sync response: expected object')
  }

  const revision = 'revision' in value ? value.revision : undefined
  if (typeof revision !== 'number' || !Number.isFinite(revision) || revision < 0) {
    throw new Error('Invalid sync response: revision is missing')
  }

  const payload = 'payload' in value ? value.payload : undefined
  if (payload !== undefined && payload !== null && typeof payload !== 'string') {
    throw new Error('Invalid sync response: payload is invalid')
  }

  return {
    revision,
    payload: payload === undefined || payload === null ? null : payload,
    alg: 'alg' in value && typeof value.alg === 'string' ? value.alg : undefined,
    kdf: 'kdf' in value && typeof value.kdf === 'string' ? value.kdf : undefined,
    salt: 'salt' in value && typeof value.salt === 'string' ? value.salt : undefined,
    iv: 'iv' in value && typeof value.iv === 'string' ? value.iv : undefined,
  }
}

function createDeps(deps?: SyncDependencies): Required<SyncDependencies> {
  return {
    store: deps?.store || storage,
    fetchImpl: deps?.fetchImpl || fetch,
    getSnapshot: deps?.getSnapshot || buildLocalMemorySnapshot,
    applySnapshot: deps?.applySnapshot || applySnapshotToMemory,
  }
}

async function readSyncState(store: SyncStorage): Promise<MemorySyncState> {
  const state = await store.getItem<MemorySyncState>(MEMORY_SYNC_STATE_KEY, DEFAULT_SYNC_STATE)
  return {
    revision: typeof state?.revision === 'number' && Number.isFinite(state.revision) ? state.revision : 0,
    lastSyncedAt: typeof state?.lastSyncedAt === 'string' ? state.lastSyncedAt : undefined,
    lastError: typeof state?.lastError === 'string' ? state.lastError : undefined,
  }
}

async function writeSyncState(store: SyncStorage, state: MemorySyncState): Promise<void> {
  await store.setItemNow(MEMORY_SYNC_STATE_KEY, state)
}

async function fetchRemoteState(
  config: { endpoint: string; token: string },
  deps: Required<SyncDependencies>
): Promise<RemoteMemoryState> {
  const response = await deps.fetchImpl(`${config.endpoint}/api/sync/memory`, {
    method: 'GET',
    headers: buildHeaders(config.token),
  })

  const body = await readResponseBody(response)
  if (!response.ok) {
    throw formatHttpError('Failed to fetch remote memory snapshot', response.status, body)
  }

  return parseRemoteState(body)
}

type PutRemoteStateResult = { ok: true; revision: number } | { ok: false; status: number; body: unknown }

async function putRemoteState(
  config: { endpoint: string; token: string },
  request: {
    baseRevision: number
    payload: string
    salt: string
    iv: string
    alg: string
    kdf: string
  },
  deps: Required<SyncDependencies>
): Promise<PutRemoteStateResult> {
  const response = await deps.fetchImpl(`${config.endpoint}/api/sync/memory`, {
    method: 'PUT',
    headers: buildHeaders(config.token),
    body: JSON.stringify(request),
  })

  const body = await readResponseBody(response)
  if (!response.ok) {
    return { ok: false, status: response.status, body }
  }

  return { ok: true, revision: parseRemoteState(body).revision }
}

function parseConflictState(body: unknown): RemoteMemoryState | null {
  if (!body || typeof body !== 'object') {
    return null
  }
  if (!('snapshot' in body)) {
    return null
  }
  const snapshot = body.snapshot
  if (!snapshot) {
    return null
  }
  try {
    return parseRemoteState(snapshot)
  } catch {
    return null
  }
}

async function decryptRemoteState(remote: RemoteMemoryState, passphrase: string): Promise<MemorySyncSnapshot> {
  if (remote.payload === null) {
    throw new Error('Remote memory snapshot has no payload to decrypt')
  }
  if (!remote.salt || !remote.iv) {
    throw new Error('Remote memory snapshot is missing encryption metadata')
  }

  const plaintext = await decryptMemorySyncPayload({
    passphrase,
    payload: remote.payload,
    salt: remote.salt,
    iv: remote.iv,
  })
  return parseMemorySyncSnapshot(plaintext)
}

async function buildPutRequest(
  baseRevision: number,
  snapshot: MemorySyncSnapshot,
  passphrase: string
): Promise<{ baseRevision: number; payload: string; salt: string; iv: string; alg: string; kdf: string }> {
  const encrypted = await encryptMemorySyncPayload(passphrase, serializeMemorySyncSnapshot(snapshot))
  return {
    baseRevision,
    payload: encrypted.payload,
    salt: encrypted.salt,
    iv: encrypted.iv,
    alg: encrypted.alg,
    kdf: encrypted.kdf,
  }
}

/** Build the current local memory snapshot, flushing coalesced writes first. */
async function buildLocalMemorySnapshot(): Promise<MemorySyncSnapshot> {
  await memoryStore.getState().flushPersistence()
  const { settings, globalBank } = memoryStore.getState()
  const agentBanks = await getMemoryRepository().loadAllAgentBanks()
  return buildMemorySyncSnapshot({ settings, globalBank, agentBanks })
}

/** Write a merged snapshot back through the memory store so recall indexes are rebuilt. */
async function applySnapshotToMemory(snapshot: MemorySyncSnapshot): Promise<void> {
  const state = memoryStore.getState()
  await state.setSettings(snapshot.settings)
  await state.replaceGlobalBank(snapshot.globalBank)
  for (const { agentId, bank } of snapshot.agentBanks) {
    await state.replaceAgentBank(agentId, bank)
  }
}

export async function getMemorySyncState(deps?: Pick<SyncDependencies, 'store'>): Promise<MemorySyncState> {
  const store = deps?.store || storage
  return await readSyncState(store)
}

export async function testMemorySyncConnection(
  config: MemorySyncConfig,
  deps?: SyncDependencies
): Promise<RemoteMemoryState> {
  const normalized = normalizeConfig(config)
  const resolvedDeps = createDeps(deps)
  return await fetchRemoteState(normalized, resolvedDeps)
}

async function pullMemoryFromServerInternal(
  config: MemorySyncConfig,
  passphrase: string,
  deps: Required<SyncDependencies>
): Promise<void> {
  const normalized = normalizeConfig(config)
  const state = await readSyncState(deps.store)
  const remote = await fetchRemoteState(normalized, deps)

  // Nothing newer on the server to import.
  if (remote.revision <= state.revision) {
    return
  }

  // A null payload means the server holds no encrypted snapshot yet; only
  // advance the local revision so the next push uses the right base.
  if (remote.payload !== null) {
    const remoteSnapshot = await decryptRemoteState(remote, passphrase)
    const local = await deps.getSnapshot()
    const merged = mergeMemorySnapshots({ local, remote: remoteSnapshot })
    await deps.applySnapshot(merged)
  }

  await writeSyncState(deps.store, {
    revision: remote.revision,
    lastSyncedAt: new Date().toISOString(),
  })
}

export function pullMemoryFromServer(
  config: MemorySyncConfig,
  passphrase: string,
  deps?: SyncDependencies
): Promise<void> {
  const resolvedDeps = createDeps(deps)
  return withSyncLock(() => pullMemoryFromServerInternal(config, passphrase, resolvedDeps))
}

async function pushMemoryToServerInternal(
  config: MemorySyncConfig,
  passphrase: string,
  deps: Required<SyncDependencies>
): Promise<void> {
  const normalized = normalizeConfig(config)
  const state = await readSyncState(deps.store)

  const local = await deps.getSnapshot()
  const firstAttempt = await putRemoteState(normalized, await buildPutRequest(state.revision, local, passphrase), deps)

  if (firstAttempt.ok) {
    await writeSyncState(deps.store, {
      revision: firstAttempt.revision,
      lastSyncedAt: new Date().toISOString(),
    })
    return
  }

  if (firstAttempt.status !== 409) {
    throw formatHttpError('Failed to push memory snapshot', firstAttempt.status, firstAttempt.body)
  }

  // Compare-and-swap conflict: pull the server's snapshot, merge it into local
  // memory, then re-push against the server's revision.
  const conflict = parseConflictState(firstAttempt.body)
  if (!conflict) {
    throw formatHttpError('Memory push conflict without valid snapshot', firstAttempt.status, firstAttempt.body)
  }

  if (conflict.payload !== null) {
    const remoteSnapshot = await decryptRemoteState(conflict, passphrase)
    const currentLocal = await deps.getSnapshot()
    const merged = mergeMemorySnapshots({ local: currentLocal, remote: remoteSnapshot })
    await deps.applySnapshot(merged)
  }
  await writeSyncState(deps.store, {
    revision: conflict.revision,
    lastSyncedAt: new Date().toISOString(),
  })

  const mergedLocal = await deps.getSnapshot()
  const secondAttempt = await putRemoteState(
    normalized,
    await buildPutRequest(conflict.revision, mergedLocal, passphrase),
    deps
  )
  if (!secondAttempt.ok) {
    throw formatHttpError('Failed to push merged memory snapshot', secondAttempt.status, secondAttempt.body)
  }

  await writeSyncState(deps.store, {
    revision: secondAttempt.revision,
    lastSyncedAt: new Date().toISOString(),
  })
}

export function pushMemoryToServer(
  config: MemorySyncConfig,
  passphrase: string,
  deps?: SyncDependencies
): Promise<void> {
  const resolvedDeps = createDeps(deps)
  return withSyncLock(() => pushMemoryToServerInternal(config, passphrase, resolvedDeps))
}

export function syncMemoryNow(config: MemorySyncConfig, passphrase: string, deps?: SyncDependencies): Promise<void> {
  const resolvedDeps = createDeps(deps)
  return withSyncLock(async () => {
    try {
      await pullMemoryFromServerInternal(config, passphrase, resolvedDeps)
      await pushMemoryToServerInternal(config, passphrase, resolvedDeps)
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
