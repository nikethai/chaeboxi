import { v4 as uuidv4 } from 'uuid'
import type { MemoryBank, MemoryEntry, MemoryScope, MemorySettings, MemorySource } from '@shared/types/memory'
import { emptyMemoryBank, emptyProfileSlots } from '@shared/types/memory'
import { isEmptyAfterRedaction, redactSecrets } from './redaction'
import { tokenizeForIndex } from './query-index'
import { recallEntries } from './recall'

export function normalizeContent(content: string): string {
  return content.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function contentFingerprint(content: string): string {
  return normalizeContent(content).slice(0, 200)
}

/** Jaccard similarity on content tokens for near-duplicate detection (S1). */
export function contentTokenJaccard(a: string, b: string): number {
  const ta = new Set(tokenizeForIndex(a))
  const tb = new Set(tokenizeForIndex(b))
  if (ta.size === 0 && tb.size === 0) return 1
  if (ta.size === 0 || tb.size === 0) return 0
  let inter = 0
  for (const t of ta) {
    if (tb.has(t)) inter += 1
  }
  const union = ta.size + tb.size - inter
  return union === 0 ? 0 : inter / union
}

const NEAR_DUP_THRESHOLD = 0.85

export interface RetainInput {
  content: string
  tags?: string[]
  scope: MemoryScope
  agentId?: string
  source: MemorySource
  sourceSessionId?: string
  sourceMessageId?: string
  pinned?: boolean
  enabled?: boolean
  maxEntryChars: number
}

export function createEntry(input: RetainInput): MemoryEntry | null {
  const maxChars =
    typeof input.maxEntryChars === 'number' && Number.isFinite(input.maxEntryChars) && input.maxEntryChars > 0
      ? Math.floor(input.maxEntryChars)
      : 500

  const redacted = redactSecrets(input.content ?? '')
  if (isEmptyAfterRedaction(redacted)) return null

  const content = redacted.slice(0, maxChars).trim()
  if (!content) return null

  if (input.scope === 'agent' && !input.agentId) {
    throw new Error('agentId is required for agent-scoped memory')
  }

  const now = Date.now()
  return {
    id: uuidv4(),
    content,
    tags: (input.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean),
    scope: input.scope,
    agentId: input.scope === 'agent' ? input.agentId : undefined,
    source: input.source,
    sourceSessionId: input.sourceSessionId,
    sourceMessageId: input.sourceMessageId,
    enabled: input.enabled ?? true,
    pinned: input.pinned ?? false,
    archived: false,
    createdAt: now,
    updatedAt: now,
  }
}

function findDedupeIndex(entries: MemoryEntry[], content: string): number {
  const fp = contentFingerprint(content)
  const exact = entries.findIndex((e) => contentFingerprint(e.content) === fp)
  if (exact >= 0) return exact

  let bestIdx = -1
  let bestScore = 0
  for (let i = 0; i < entries.length; i++) {
    const j = contentTokenJaccard(entries[i].content, content)
    if (j >= NEAR_DUP_THRESHOLD && j > bestScore) {
      bestScore = j
      bestIdx = i
    }
  }
  return bestIdx
}

/** Merge new entry into bank; updates existing if fingerprint or near-dup matches. */
export function retainEntry(bank: MemoryBank, entry: MemoryEntry, settings: MemorySettings): MemoryBank {
  const existingIdx = findDedupeIndex(bank.entries, entry.content)

  let entries: MemoryEntry[]
  if (existingIdx >= 0) {
    const prev = bank.entries[existingIdx]
    const merged: MemoryEntry = {
      ...prev,
      content: entry.content,
      tags: Array.from(new Set([...prev.tags, ...entry.tags])),
      updatedAt: Date.now(),
      pinned: prev.pinned || entry.pinned,
      enabled: entry.enabled,
      archived: false,
      sourceSessionId: entry.sourceSessionId ?? prev.sourceSessionId,
      sourceMessageId: entry.sourceMessageId ?? prev.sourceMessageId,
    }
    entries = [...bank.entries]
    entries[existingIdx] = merged
  } else {
    entries = [entry, ...bank.entries]
  }

  const maxRaw = bank.scope === 'global' ? settings.maxEntriesGlobal : settings.maxEntriesPerAgent
  const max =
    typeof maxRaw === 'number' && Number.isFinite(maxRaw) && maxRaw > 0 ? Math.floor(maxRaw) : 300
  entries = pruneEntries(entries, max, {
    softArchive: settings.softArchiveOnPrune !== false,
  })

  return {
    scope: bank.scope,
    agentId: bank.agentId,
    entries,
    profileSummary: bank.profileSummary ?? '',
    profileUpdatedAt: bank.profileUpdatedAt,
    profileSlots: bank.profileSlots ?? emptyProfileSlots(),
    version: bank.version ?? 1,
  }
}

export type PruneOptions = {
  /** Soft-archive (disable) overflow instead of hard-delete (S3) */
  softArchive?: boolean
}

/**
 * Prune bank entries over max.
 * Order: keep all pinned; then by lastAccessedAt, enabled, updatedAt.
 * Soft-archive: demote overflow to enabled=false, archived=true instead of drop.
 */
export function pruneEntries(
  entries: MemoryEntry[],
  max: number,
  options?: PruneOptions
): MemoryEntry[] {
  const limit = typeof max === 'number' && Number.isFinite(max) && max > 0 ? Math.floor(max) : 300
  if (entries.length <= limit) return entries

  const softArchive = options?.softArchive !== false
  const pinned = entries.filter((e) => e.pinned)
  const rest = entries
    .filter((e) => !e.pinned)
    .sort((a, b) => {
      // Prefer enabled over archived/disabled
      const ae = a.enabled && !a.archived ? 1 : 0
      const be = b.enabled && !b.archived ? 1 : 0
      if (ae !== be) return be - ae
      const aa = a.lastAccessedAt ?? 0
      const ba = b.lastAccessedAt ?? 0
      if (aa !== ba) return ba - aa
      return b.updatedAt - a.updatedAt
    })

  // Active capacity among non-pinned for "active" slots
  const capacity = Math.max(0, limit - pinned.length)
  const keepRest = rest.slice(0, capacity)
  const overflow = rest.slice(capacity)

  if (!softArchive) {
    return [...pinned, ...keepRest].sort((a, b) => b.updatedAt - a.updatedAt)
  }

  // Soft-archive overflow: keep them but disabled+archived (still count toward list;
  // hard-drop only if total still huge: 3x limit)
  const archivedOverflow = overflow.map((e) => ({
    ...e,
    enabled: false,
    archived: true,
    updatedAt: e.updatedAt,
  }))
  let combined = [...pinned, ...keepRest, ...archivedOverflow]
  const hardCap = Math.max(limit * 3, limit + 50)
  if (combined.length > hardCap) {
    // Drop oldest archived first
    const active = combined.filter((e) => e.pinned || (e.enabled && !e.archived))
    const archived = combined
      .filter((e) => !e.pinned && (!e.enabled || e.archived))
      .sort((a, b) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0))
    const archivedKeep = archived.slice(-(hardCap - active.length))
    combined = [...active, ...archivedKeep]
  }
  return combined.sort((a, b) => b.updatedAt - a.updatedAt)
}

export function updateEntry(
  bank: MemoryBank,
  id: string,
  patch: Partial<Pick<MemoryEntry, 'content' | 'tags' | 'enabled' | 'pinned' | 'archived'>>
): MemoryBank {
  const entries = bank.entries.map((e) => {
    if (e.id !== id) return e
    let content = e.content
    if (patch.content !== undefined) {
      const redacted = redactSecrets(patch.content)
      if (!isEmptyAfterRedaction(redacted)) {
        content = redacted
      }
    }
    const enabled = patch.enabled ?? e.enabled
    let archived = patch.archived ?? e.archived
    // Re-enabling clears archive
    if (patch.enabled === true) archived = false
    if (patch.archived === false && patch.enabled === undefined) {
      // unarchive keeps enabled as-is unless specified
    }
    return {
      ...e,
      content,
      tags: patch.tags !== undefined ? patch.tags.map((t) => t.trim().toLowerCase()).filter(Boolean) : e.tags,
      enabled,
      pinned: patch.pinned ?? e.pinned,
      archived: archived ?? false,
      updatedAt: Date.now(),
    }
  })
  return { ...bank, entries }
}

export function deleteEntry(bank: MemoryBank, id: string): MemoryBank {
  return { ...bank, entries: bank.entries.filter((e) => e.id !== id) }
}

export function forgetEntry(bank: MemoryBank, id: string, hard = false): MemoryBank {
  if (hard) return deleteEntry(bank, id)
  return updateEntry(bank, id, { enabled: false, archived: true })
}

/** Default retention window for sync tombstones before they are hard-purged. */
export const DEFAULT_TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Mark an entry as deleted via a sync tombstone instead of removing it.
 * The entry stays on disk (hidden from recall) so other devices can converge
 * on the delete, and its revision is bumped to win sync merges.
 */
export function markEntryDeleted(bank: MemoryBank, id: string, now = Date.now()): MemoryBank {
  let changed = false
  const entries = bank.entries.map((entry) => {
    if (entry.id !== id) return entry
    changed = true
    return {
      ...entry,
      deleted: true,
      enabled: false,
      updatedAt: now,
      revision: (entry.revision ?? 0) + 1,
    }
  })

  if (!changed) return bank
  return {
    ...bank,
    entries,
    revision: (bank.revision ?? 0) + 1,
  }
}

/**
 * Hard-remove tombstones older than ttlMs. Tombstones must outlive the sync
 * pull window so deletes propagate to other devices before being purged.
 */
export function purgeExpiredTombstones(
  bank: MemoryBank,
  now = Date.now(),
  ttlMs = DEFAULT_TOMBSTONE_TTL_MS
): MemoryBank {
  const cutoff = now - ttlMs
  const entries = bank.entries.filter((e) => !(e.deleted && (e.updatedAt ?? 0) <= cutoff))
  if (entries.length === bank.entries.length) return bank
  return { ...bank, entries }
}

/**
 * Keyword search — delegates to unified scored recall (S1).
 * Returns MemoryEntry[] for backward compatibility with tools/UI.
 */
export function searchEntries(
  bank: MemoryBank,
  query: string,
  options?: { limit?: number; enabledOnly?: boolean; includeArchived?: boolean }
): MemoryEntry[] {
  const limit = options?.limit ?? 20
  const enabledOnly = options?.enabledOnly ?? true
  const q = query.trim()
  if (!q) {
    return listEntries(bank, { limit, enabledOnly, includeArchived: options?.includeArchived })
  }

  const hits = recallEntries({
    query: q,
    globalBank: bank.scope === 'global' ? bank : null,
    agentBank: bank.scope === 'agent' ? bank : null,
    limit,
    enabledOnly,
    includeArchived: options?.includeArchived ?? false,
  })
  return hits.map((h) => h.entry)
}

export function listEntries(
  bank: MemoryBank,
  options?: {
    limit?: number
    enabledOnly?: boolean
    pinnedOnly?: boolean
    includeArchived?: boolean
    archivedOnly?: boolean
  }
): MemoryEntry[] {
  const limit = options?.limit ?? 50
  let list = bank.entries
  if (options?.archivedOnly) {
    list = list.filter((e) => e.archived || !e.enabled)
  } else if (!options?.includeArchived) {
    list = list.filter((e) => !e.archived)
  }
  if (options?.enabledOnly) list = list.filter((e) => e.enabled)
  if (options?.pinnedOnly) list = list.filter((e) => e.pinned)
  return list
    .slice()
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      const aa = a.lastAccessedAt ?? 0
      const ba = b.lastAccessedAt ?? 0
      if (aa !== ba && (aa || ba)) return ba - aa
      return b.updatedAt - a.updatedAt
    })
    .slice(0, limit)
}

export function clearBank(scope: MemoryScope, agentId?: string): MemoryBank {
  return emptyMemoryBank(scope, agentId)
}

export function ensureBank(bank: MemoryBank | null | undefined, scope: MemoryScope, agentId?: string): MemoryBank {
  if (bank && bank.scope === scope) return bank
  return emptyMemoryBank(scope, agentId)
}

export function simpleProfileFromEntries(entries: MemoryEntry[], maxChars = 2000): string {
  const enabled = entries
    .filter((e) => e.enabled && !e.archived)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return b.updatedAt - a.updatedAt
    })

  const lines: string[] = []
  let used = 0
  for (const e of enabled) {
    const line = `- ${e.content}`
    if (used + line.length + 1 > maxChars) break
    lines.push(line)
    used += line.length + 1
  }
  return lines.join('\n')
}

export function setProfileSummary(bank: MemoryBank, summary: string): MemoryBank {
  const redacted = redactSecrets(summary)
  return {
    ...bank,
    profileSummary: redacted,
    profileUpdatedAt: Date.now(),
  }
}

export function setProfileSlots(
  bank: MemoryBank,
  slots: Partial<{ identity: string; prefs: string; projects: string }>
): MemoryBank {
  const prev = bank.profileSlots ?? emptyProfileSlots()
  return {
    ...bank,
    profileSlots: {
      identity: slots.identity !== undefined ? redactSecrets(slots.identity) : prev.identity,
      prefs: slots.prefs !== undefined ? redactSecrets(slots.prefs) : prev.prefs,
      projects: slots.projects !== undefined ? redactSecrets(slots.projects) : prev.projects,
    },
    profileUpdatedAt: Date.now(),
  }
}

/** Compose inject-facing profile text from slots + summary. */
export function composeProfileText(bank: MemoryBank | null | undefined): string {
  if (!bank) return ''
  const slots = bank.profileSlots
  const parts: string[] = []
  if (slots?.identity?.trim()) parts.push(`Identity: ${slots.identity.trim()}`)
  if (slots?.prefs?.trim()) parts.push(`Preferences: ${slots.prefs.trim()}`)
  if (slots?.projects?.trim()) parts.push(`Projects: ${slots.projects.trim()}`)
  if (bank.profileSummary?.trim()) {
    if (parts.length) parts.push(bank.profileSummary.trim())
    else return bank.profileSummary.trim()
  }
  return parts.join('\n')
}
