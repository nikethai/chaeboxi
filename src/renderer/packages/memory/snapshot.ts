import type { MemoryBank, MemorySettings } from '@shared/types/memory'
import type { MemorySyncSnapshot } from '@/packages/memory/sync-types'

/**
 * Build a serializable snapshot of the local memory system: settings plus the
 * global bank and every agent bank. Used as the unit of encrypted multi-device
 * sync (see sync-types.ts).
 */
export function buildMemorySyncSnapshot(input: {
  settings: MemorySettings
  globalBank: MemoryBank
  agentBanks: Array<{ agentId: string; bank: MemoryBank }>
}): MemorySyncSnapshot {
  return {
    schemaVersion: 1,
    settings: input.settings,
    globalBank: input.globalBank,
    agentBanks: input.agentBanks,
  }
}

/** Serialize a snapshot to a JSON string (the plaintext passed to encryption). */
export function serializeMemorySyncSnapshot(snapshot: MemorySyncSnapshot): string {
  return JSON.stringify(snapshot)
}

/** Parse a serialized snapshot back into its typed shape. */
export function parseMemorySyncSnapshot(raw: string): MemorySyncSnapshot {
  return JSON.parse(raw) as MemorySyncSnapshot
}
