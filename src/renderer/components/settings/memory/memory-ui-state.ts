import type { MemoryEntry } from '@shared/types/memory'
import type { CSSProperties } from 'react'

export type MemoryScopeKey = 'global' | `agent:${string}`

export function memoryScopeKey(scope: 'global' | 'agent', agentId?: string | null): MemoryScopeKey {
  if (scope === 'agent' && agentId) return `agent:${agentId}`
  return 'global'
}

export function parseTagsInput(raw: string): string[] {
  return raw
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

export function sortMemoryEntries(entries: MemoryEntry[]): MemoryEntry[] {
  return [...entries].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return b.updatedAt - a.updatedAt
  })
}

export function filterMemoryEntries(
  entries: MemoryEntry[],
  search: string,
  options?: { includeArchived?: boolean }
): MemoryEntry[] {
  const includeArchived = options?.includeArchived ?? false
  let list = includeArchived ? entries : entries.filter((e) => !e.archived)
  const q = search.trim().toLowerCase()
  if (!q) return sortMemoryEntries(list)

  // Scored filter: prefer token overlap ranking (same spirit as memory_recall)
  const scored = list
    .map((e) => {
      const hay = `${e.content} ${e.tags.join(' ')} ${e.id}`.toLowerCase()
      let score = 0
      if (hay.includes(q)) score += 5
      for (const part of q.split(/\s+/).filter(Boolean)) {
        if (hay.includes(part)) score += part.length >= 4 ? 3 : 1
        if (e.tags.some((t) => t.includes(part))) score += 2
      }
      if (e.pinned) score += 1
      return { e, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || (b.e.updatedAt - a.e.updatedAt))

  return scored.map((x) => x.e)
}

/** Soft panel surface matching Chaeboxi settings redesign. */
export const memoryPanelStyle: CSSProperties = {
  borderRadius: 11,
  background: 'var(--chatbox-background-secondary)',
  border: '1px solid var(--chatbox-border-primary)',
  boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.03)',
}
