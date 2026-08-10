import type { MemoryBank, MemorySettings } from '@shared/types/memory'
import { defaultMemorySettings, emptyMemoryBank } from '@shared/types/memory'
import storage, { StorageKey } from '@/storage'
import StoreStorage, { StorageKeyGenerator } from '@/storage/StoreStorage'
import { normalizeBank, normalizeSettings, plainClone } from './clone'
import { recordWriteFlush } from './metrics'

const store = storage as StoreStorage

/** Memory keys must flush immediately (not debounced session keys) — but we coalesce bursts. */
async function setImmediateRaw<T>(key: string, value: T): Promise<void> {
  const plain = plainClone(value)
  if (typeof store.setItemNow === 'function') {
    await store.setItemNow(key, plain)
    return
  }
  await storage.setItem(key, plain)
}

export type CoalesceOptions = {
  /** Skip debounce; write now (clear/export/shutdown) */
  immediate?: boolean
}

type PendingWrite = {
  key: string
  value: unknown
  timer: ReturnType<typeof setTimeout> | null
  chain: Promise<void>
}

const pending = new Map<string, PendingWrite>()
const COALESCE_MS = 200

async function flushKey(key: string): Promise<void> {
  const p = pending.get(key)
  if (!p) return
  if (p.timer) {
    clearTimeout(p.timer)
    p.timer = null
  }
  pending.delete(key)
  await setImmediateRaw(key, p.value)
  recordWriteFlush(true)
}

async function setCoalesced<T>(key: string, value: T, options?: CoalesceOptions): Promise<void> {
  if (options?.immediate) {
    const existing = pending.get(key)
    if (existing?.timer) clearTimeout(existing.timer)
    pending.delete(key)
    await setImmediateRaw(key, value)
    recordWriteFlush(false)
    return
  }

  let entry = pending.get(key)
  if (!entry) {
    entry = { key, value, timer: null, chain: Promise.resolve() }
    pending.set(key, entry)
  } else {
    entry.value = value
  }

  if (entry.timer) clearTimeout(entry.timer)
  entry.timer = setTimeout(() => {
    void flushKey(key)
  }, COALESCE_MS)
}

export async function flushAllMemoryWrites(): Promise<void> {
  const keys = Array.from(pending.keys())
  await Promise.all(keys.map((k) => flushKey(k)))
}

export async function loadMemorySettings(): Promise<MemorySettings> {
  try {
    const raw = await storage.getItem<MemorySettings>(StorageKey.MemorySettings, defaultMemorySettings())
    return normalizeSettings(raw)
  } catch {
    return defaultMemorySettings()
  }
}

export async function saveMemorySettings(settings: MemorySettings): Promise<void> {
  const parsed = normalizeSettings(settings)
  await setImmediateRaw(StorageKey.MemorySettings, parsed)
  recordWriteFlush(false)
}

export async function loadGlobalBank(): Promise<MemoryBank> {
  try {
    const empty = emptyMemoryBank('global')
    const raw = await storage.getItem<MemoryBank>(StorageKey.MemoryBankGlobal, empty)
    return normalizeBank(raw, 'global')
  } catch {
    return emptyMemoryBank('global')
  }
}

export async function saveGlobalBank(bank: MemoryBank, options?: CoalesceOptions): Promise<void> {
  const parsed = normalizeBank(bank, 'global')
  await setCoalesced(StorageKey.MemoryBankGlobal, parsed, options)
}

export async function loadAgentBank(agentId: string): Promise<MemoryBank> {
  const key = StorageKeyGenerator.memoryAgent(agentId)
  try {
    const empty = emptyMemoryBank('agent', agentId)
    const raw = await storage.getItem<MemoryBank>(key, empty)
    return normalizeBank(raw, 'agent', agentId)
  } catch {
    return emptyMemoryBank('agent', agentId)
  }
}

export async function saveAgentBank(agentId: string, bank: MemoryBank, options?: CoalesceOptions): Promise<void> {
  const key = StorageKeyGenerator.memoryAgent(agentId)
  const parsed = normalizeBank(bank, 'agent', agentId)
  await setCoalesced(key, parsed, options)
}

export async function deleteAgentBank(agentId: string): Promise<void> {
  const key = StorageKeyGenerator.memoryAgent(agentId)
  await flushKey(key)
  await storage.removeItem(key)
}

const AGENT_BANK_KEY_PREFIX = StorageKeyGenerator.memoryAgent('')

/** Enumerate every agent id that has a persisted bank, including inactive agents. */
export async function listAgentBankIds(): Promise<string[]> {
  const keys = await storage.getAllKeys()
  return keys
    .filter((key) => key.startsWith(AGENT_BANK_KEY_PREFIX))
    .map((key) => key.slice(AGENT_BANK_KEY_PREFIX.length))
    .sort()
}

/** Load every persisted agent bank for snapshot building. */
export async function loadAllAgentBanks(): Promise<Array<{ agentId: string; bank: MemoryBank }>> {
  const ids = await listAgentBankIds()
  return await Promise.all(ids.map(async (agentId) => ({ agentId, bank: await loadAgentBank(agentId) })))
}
