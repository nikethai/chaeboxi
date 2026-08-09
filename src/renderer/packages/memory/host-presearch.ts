import type { MemoryBank } from '@shared/types/memory'
import type { MemorySettings } from '@shared/types/memory'
import { recallEntries, type RecallHit } from './recall'
import { tokenizeForIndex } from './query-index'
import type { MemoryQueryIndex } from './query-index'
import type { SemanticVectors } from './semantic'

export type HostPreSearchHit = {
  id: string
  scope: 'global' | 'agent'
  content: string
  tags: string[]
  pinned: boolean
  score: number
}

export { tokenizeForIndex as tokenizeQuery }

/**
 * Keyword/hybrid pre-search across global + agent banks for the latest user message.
 * Thin wrapper over unified recallEntries (S1).
 */
export function hostPreSearchMemories(options: {
  query: string
  globalBank?: MemoryBank | null
  agentBank?: MemoryBank | null
  globalIndex?: MemoryQueryIndex | null
  agentIndex?: MemoryQueryIndex | null
  semanticVectors?: SemanticVectors | null
  settings?: Pick<MemorySettings, 'semanticSearchEnabled' | 'semanticFusionWeight'> | null
  limit?: number
}): HostPreSearchHit[] {
  const hits: RecallHit[] = recallEntries({
    query: options.query,
    globalBank: options.globalBank,
    agentBank: options.agentBank,
    globalIndex: options.globalIndex,
    agentIndex: options.agentIndex,
    semanticVectors: options.semanticVectors,
    settings: options.settings,
    limit: options.limit ?? 5,
    enabledOnly: true,
    includeArchived: false,
    asPresearch: true,
  })
  return hits.map((h) => ({
    id: h.id,
    scope: h.scope,
    content: h.content,
    tags: h.tags,
    pinned: h.pinned,
    score: h.score,
  }))
}

/**
 * Always-on host lookup block for hybrid/on_demand.
 * Emits matches OR an explicit "no match" so the model knows memory was checked
 * before web search / other tools.
 */
export function formatHostPreSearchSection(
  hits: HostPreSearchHit[],
  budgetTokens: number,
  options?: { queryTokens?: string[]; alwaysEmit?: boolean }
): string {
  const alwaysEmit = options?.alwaysEmit !== false
  const tokens = options?.queryTokens ?? []
  const est = (text: string) => Math.ceil(text.length / 4)

  if (!hits.length) {
    if (!alwaysEmit) return ''
    const lines = [
      '### Memory lookup (host — ran before model tools)',
      tokens.length ? `Query tokens: ${tokens.slice(0, 12).join(', ')}` : 'Query tokens: (none usable)',
      'No matching memories for this message.',
      "If the question may still refer to the user's projects, stack, or prefs, call memory_recall once with keywords before web search.",
    ]
    return lines.join('\n')
  }

  if (budgetTokens < 20) return ''
  const lines: string[] = [
    '### Memory lookup (host — ran before model tools)',
    'Matched from the latest user message (not full memory). Prefer these over guessing; still call memory_recall for more.',
  ]
  let used = est(lines.join('\n'))
  for (const h of hits) {
    const bullet = `- [${h.scope}] ${h.content}`
    const next = used + est(bullet)
    if (next > budgetTokens) break
    lines.push(bullet)
    used = next
  }
  if (lines.length <= 2) return ''
  return lines.join('\n')
}
