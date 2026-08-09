import type { MemoryBank, MemoryEntry, MemorySettings } from '@shared/types/memory'
import { recordPresearch, recordRecall } from './metrics'
import { MemoryQueryIndex, tokenizeForIndex } from './query-index'
import { semanticBoost, type SemanticVectors } from './semantic'

/** Local fingerprint to avoid circular import with bank-ops. */
function contentFingerprint(content: string): string {
  return content.trim().replace(/\s+/g, ' ').toLowerCase().slice(0, 200)
}

export type RecallHit = {
  id: string
  scope: 'global' | 'agent'
  content: string
  tags: string[]
  pinned: boolean
  score: number
  entry: MemoryEntry
}

export type RecallOptions = {
  query: string
  globalBank?: MemoryBank | null
  agentBank?: MemoryBank | null
  /** Optional prebuilt indexes for scale path */
  globalIndex?: MemoryQueryIndex | null
  agentIndex?: MemoryQueryIndex | null
  limit?: number
  enabledOnly?: boolean
  /** Include soft-archived entries (Settings archive view) */
  includeArchived?: boolean
  settings?: Pick<MemorySettings, 'semanticSearchEnabled' | 'semanticFusionWeight'> | null
  /** Optional semantic vectors keyed by entry id */
  semanticVectors?: SemanticVectors | null
  /** When true, record metrics as host pre-search */
  asPresearch?: boolean
}

function tokensOverlap(a: string, b: string): boolean {
  if (a === b) return true
  if (a.length >= 4 && b.length >= 4) {
    if (a.startsWith(b) || b.startsWith(a)) return true
  }
  return false
}

/** Lexical score for one entry (shared by host + tools + UI). */
export function scoreEntryLexical(
  entry: MemoryEntry,
  queryTokens: string[],
  index?: MemoryQueryIndex | null
): number {
  if (queryTokens.length === 0) return 0
  const hay = `${entry.content} ${entry.tags.join(' ')}`.toLowerCase()
  const entryTokens = index?.tokensFor(entry.id) ?? tokenizeForIndex(hay)
  let score = 0
  for (const t of queryTokens) {
    // BM25-ish IDF when index present
    const idf = index ? index.getIdf(t) : 1
    if (hay.includes(t)) {
      score += (t.length >= 4 ? 3 : 1) * idf
      continue
    }
    for (const et of entryTokens) {
      if (tokensOverlap(t, et)) {
        score += 2 * idf
        break
      }
    }
  }
  // Exact id prefix
  if (queryTokens.some((t) => entry.id.toLowerCase().startsWith(t))) {
    score += 5
  }
  // Exact tag match boost
  for (const tag of entry.tags) {
    if (queryTokens.includes(tag)) score += 2
  }
  if (entry.pinned) score += 1
  // Mild recency / access boost
  const access = entry.lastAccessedAt ?? 0
  if (access > 0) {
    const ageDays = (Date.now() - access) / (1000 * 60 * 60 * 24)
    if (ageDays < 7) score += 0.5
  }
  return score
}

function collectBank(
  bank: MemoryBank | null | undefined,
  scope: 'global' | 'agent',
  queryTokens: string[],
  index: MemoryQueryIndex | null | undefined,
  options: {
    enabledOnly: boolean
    includeArchived: boolean
    settings?: RecallOptions['settings']
    semanticVectors?: SemanticVectors | null
  },
  seen: Set<string>,
  hits: RecallHit[]
): void {
  if (!bank?.entries?.length) return

  let candidates: MemoryEntry[]
  if (queryTokens.length && index && index.getDocCount() > 0) {
    const ids = index.candidates(queryTokens)
    if (ids.size > 0) {
      candidates = []
      for (const id of ids) {
        const e = index.getEntry(id) ?? bank.entries.find((x) => x.id === id)
        if (e) candidates.push(e)
      }
    } else {
      candidates = bank.entries
    }
  } else {
    candidates = bank.entries
  }

  const fusionW =
    options.settings?.semanticSearchEnabled !== false
      ? Math.min(1, Math.max(0, options.settings?.semanticFusionWeight ?? 0.35))
      : 0

  for (const e of candidates) {
    if (options.enabledOnly && !e.enabled) continue
    if (!options.includeArchived && e.archived) continue
    let lex = scoreEntryLexical(e, queryTokens, index)
    if (lex <= 0 && fusionW <= 0) continue

    if (fusionW > 0 && options.semanticVectors) {
      const sem = semanticBoost(e.id, queryTokens, options.semanticVectors)
      if (sem > 0 || lex > 0) {
        // Normalize-ish: semantic is 0..1-ish, lexical can be larger — blend carefully
        const lexNorm = lex
        const fused = (1 - fusionW) * lexNorm + fusionW * sem * Math.max(lexNorm, 3)
        lex = fused
      }
    }

    if (lex <= 0) continue

    const fp = contentFingerprint(e.content)
    if (seen.has(fp)) continue
    seen.add(fp)

    hits.push({
      id: e.id,
      scope,
      content: e.content,
      tags: e.tags,
      pinned: e.pinned,
      score: lex,
      entry: e,
    })
  }
}

/**
 * Unified scored recall across global + agent banks (S1).
 * Host pre-search, memory_recall tools, and Settings search should all use this.
 */
export function recallEntries(options: RecallOptions): RecallHit[] {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const limit =
    typeof options.limit === 'number' && Number.isFinite(options.limit) && options.limit > 0
      ? Math.floor(options.limit)
      : 20
  const query = options.query?.trim() ?? ''
  if (!query || limit <= 0) {
    if (options.asPresearch) recordPresearch(0, 0)
    return []
  }

  const queryTokens = tokenizeForIndex(query)
  if (queryTokens.length === 0) {
    if (options.asPresearch) recordPresearch(0, 0)
    return []
  }

  const enabledOnly = options.enabledOnly ?? true
  const includeArchived = options.includeArchived ?? false
  const hits: RecallHit[] = []
  const seen = new Set<string>()
  const common = {
    enabledOnly,
    includeArchived,
    settings: options.settings,
    semanticVectors: options.semanticVectors,
  }

  collectBank(
    options.globalBank,
    'global',
    queryTokens,
    options.globalIndex,
    common,
    seen,
    hits
  )
  collectBank(options.agentBank, 'agent', queryTokens, options.agentIndex, common, seen, hits)

  const sorted = hits
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return (b.entry.updatedAt ?? 0) - (a.entry.updatedAt ?? 0)
    })
    .slice(0, limit)

  const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
  if (options.asPresearch) {
    recordPresearch(ms, sorted.length)
  } else {
    recordRecall()
  }

  return sorted
}

/** Touch lastAccessedAt on recalled entries; returns updated banks if any change. */
export function touchAccessedEntries(
  bank: MemoryBank,
  ids: string[],
  at = Date.now()
): MemoryBank {
  if (!ids.length) return bank
  const idSet = new Set(ids)
  let changed = false
  const entries = bank.entries.map((e) => {
    if (!idSet.has(e.id)) return e
    changed = true
    return { ...e, lastAccessedAt: at }
  })
  return changed ? { ...bank, entries } : bank
}
