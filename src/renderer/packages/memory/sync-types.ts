import type { MemoryBank, MemorySettings } from '@shared/types/memory'

/**
 * A serializable snapshot of the local memory system used as the unit of
 * encrypted multi-device sync: memory settings plus the global and every
 * agent memory bank.
 */
export interface MemorySyncSnapshot {
  schemaVersion: 1
  settings: MemorySettings
  globalBank: MemoryBank
  agentBanks: Array<{ agentId: string; bank: MemoryBank }>
}

/**
 * The remote memory sync state as returned by the self-hosted sync server.
 * The payload is the encrypted snapshot envelope (never plaintext).
 */
export interface RemoteMemoryState {
  revision: number
  payload: string | null
  alg?: string
  kdf?: string
  salt?: string
  iv?: string
}

/**
 * Locally persisted memory sync progress, mirroring the history sync state.
 */
export interface MemorySyncState {
  revision: number
  lastSyncedAt?: string
  lastError?: string
}
