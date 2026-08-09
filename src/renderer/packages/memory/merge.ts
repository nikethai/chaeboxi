import type { MemoryBank, MemoryEntry } from '@shared/types/memory'
import type { MemorySyncSnapshot } from '@/packages/memory/sync-types'
import { setProfileSummary, simpleProfileFromEntries } from '@/packages/memory/bank-ops'

/** Rebuild a bank's profile summary from its entries (mirrors `rebuildProfileLocal`). */
function rebuildProfile(bank: MemoryBank): MemoryBank {
  return setProfileSummary(bank, simpleProfileFromEntries(bank.entries))
}

/**
 * Merge two versions of the same memory entry.
 *
 * Deterministic tie-breakers: the side with the newer `updatedAt` wins, then
 * the higher `revision`, then (on a full tie) the remote side. This lets
 * tombstones (`deleted: true`) converge across devices: a newer tombstone
 * beats an older live edit, and an older tombstone loses to a newer local
 * edit. When one side is missing the other is returned unchanged.
 */
export function mergeMemoryEntries(
  local?: MemoryEntry,
  remote?: MemoryEntry
): MemoryEntry | undefined {
  if (!local) return remote
  if (!remote) return local
  if ((remote.updatedAt ?? 0) > (local.updatedAt ?? 0)) return remote
  if ((remote.updatedAt ?? 0) < (local.updatedAt ?? 0)) return local
  if ((remote.revision ?? 0) > (local.revision ?? 0)) return remote
  if ((remote.revision ?? 0) < (local.revision ?? 0)) return local
  return remote
}

/**
 * Merge two versions of the same memory bank entry-by-entry. Tombstones are
 * kept so deletes propagate to every device, and the merged bank revision is
 * the highest of both sides. The local profile is then rebuilt from the
 * merged entries (tombstones are hidden from the profile summary).
 */
export function mergeMemoryBanks(local: MemoryBank, remote: MemoryBank): MemoryBank {
  const entriesById = new Map<string, MemoryEntry>()
  for (const entry of local.entries) entriesById.set(entry.id, entry)
  for (const entry of remote.entries) {
    const merged = mergeMemoryEntries(entriesById.get(entry.id), entry)
    if (merged) entriesById.set(entry.id, merged)
  }

  const mergedBank: MemoryBank = {
    ...local,
    entries: [...entriesById.values()],
    revision: Math.max(local.revision ?? 0, remote.revision ?? 0) || undefined,
  }
  return rebuildProfile(mergedBank)
}

/** Merge the agent banks of both snapshots by agent id, deterministically ordered. */
function mergeAgentBanks(
  local: Array<{ agentId: string; bank: MemoryBank }>,
  remote: Array<{ agentId: string; bank: MemoryBank }>
): Array<{ agentId: string; bank: MemoryBank }> {
  const remoteById = new Map(remote.map((b) => [b.agentId, b.bank]))
  const merged = local.map(({ agentId, bank }) => {
    const remoteBank = remoteById.get(agentId)
    remoteById.delete(agentId)
    return { agentId, bank: remoteBank ? mergeMemoryBanks(bank, remoteBank) : bank }
  })
  // Agent banks that exist only on the remote side are carried over.
  for (const [agentId, bank] of remoteById) {
    merged.push({ agentId, bank })
  }
  return merged.sort((a, b) => (a.agentId < b.agentId ? -1 : a.agentId > b.agentId ? 1 : 0))
}

/**
 * Merge a locally-built snapshot with a remotely-pulled snapshot into the
 * next local snapshot. v1 policy: settings always come from the local side
 * (the manual "Pull server settings" action overrides this), while entries
 * are merged entry-by-entry with tombstones and deterministic tie-breakers.
 */
export function mergeMemorySnapshots(input: {
  local: MemorySyncSnapshot
  remote: MemorySyncSnapshot
}): MemorySyncSnapshot {
  const { local, remote } = input
  return {
    schemaVersion: 1,
    settings: local.settings,
    globalBank: mergeMemoryBanks(local.globalBank, remote.globalBank),
    agentBanks: mergeAgentBanks(local.agentBanks, remote.agentBanks),
  }
}
