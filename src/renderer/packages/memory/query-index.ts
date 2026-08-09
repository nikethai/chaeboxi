import type { MemoryBank, MemoryEntry } from '@shared/types/memory'

/** Shared stopwords + tokenizer for index and recall (keep in sync with host pre-search). */
const STOP = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'that',
  'this',
  'have',
  'what',
  'when',
  'where',
  'which',
  'your',
  'you',
  'are',
  'was',
  'were',
  'how',
  'can',
  'could',
  'would',
  'should',
  'will',
  'just',
  'please',
  'about',
  'into',
  'than',
  'then',
  'them',
  'they',
  'does',
  'did',
  'dont',
  "don't",
  'need',
  'want',
  'help',
  'using',
  'use',
  'like',
  'some',
  'any',
  'all',
  'not',
  'but',
  'out',
  'get',
  'got',
  'has',
  'had',
  'our',
  'my',
  'me',
  'we',
  'is',
  'it',
  'in',
  'on',
  'to',
  'of',
  'a',
  'an',
  'or',
  'do',
  'if',
  'so',
  'be',
  'as',
  'at',
  'by',
  'i',
  'develop',
  'make',
  'create',
  'build',
  'building',
])

export function tokenizeForIndex(text: string): string[] {
  const raw = text
    .toLowerCase()
    .split(/[^a-z0-9\u00c0-\u024f]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP.has(t))
  return Array.from(new Set(raw))
}

/**
 * Inverted token → entryId index for a single bank (S2).
 * Rebuild on full bank replace; O(entries) build, O(query tokens) candidate lookup.
 */
export class MemoryQueryIndex {
  private tokenToIds = new Map<string, Set<string>>()
  private idToTokens = new Map<string, string[]>()
  private entryById = new Map<string, MemoryEntry>()
  /** Document frequency per token (for BM25-ish IDF). */
  private df = new Map<string, number>()
  private docCount = 0

  clear(): void {
    this.tokenToIds.clear()
    this.idToTokens.clear()
    this.entryById.clear()
    this.df.clear()
    this.docCount = 0
  }

  rebuild(bank: MemoryBank | null | undefined): void {
    this.clear()
    if (!bank?.entries?.length) return
    for (const e of bank.entries) {
      this.addEntry(e)
    }
  }

  addEntry(entry: MemoryEntry): void {
    this.removeEntry(entry.id)
    const tokens = tokenizeForIndex(`${entry.content} ${entry.tags.join(' ')}`)
    this.idToTokens.set(entry.id, tokens)
    this.entryById.set(entry.id, entry)
    this.docCount += 1
    const seen = new Set<string>()
    for (const t of tokens) {
      let set = this.tokenToIds.get(t)
      if (!set) {
        set = new Set()
        this.tokenToIds.set(t, set)
      }
      set.add(entry.id)
      if (!seen.has(t)) {
        seen.add(t)
        this.df.set(t, (this.df.get(t) ?? 0) + 1)
      }
    }
  }

  removeEntry(id: string): void {
    const tokens = this.idToTokens.get(id)
    if (!tokens) return
    for (const t of tokens) {
      const set = this.tokenToIds.get(t)
      if (set) {
        set.delete(id)
        if (set.size === 0) this.tokenToIds.delete(t)
      }
      const d = this.df.get(t)
      if (d !== undefined) {
        if (d <= 1) this.df.delete(t)
        else this.df.set(t, d - 1)
      }
    }
    this.idToTokens.delete(id)
    this.entryById.delete(id)
    this.docCount = Math.max(0, this.docCount - 1)
  }

  getEntry(id: string): MemoryEntry | undefined {
    return this.entryById.get(id)
  }

  getDocCount(): number {
    return this.docCount
  }

  getIdf(token: string): number {
    const n = this.docCount || 1
    const d = this.df.get(token) ?? 0
    // BM25-style smoothed IDF
    return Math.log(1 + (n - d + 0.5) / (d + 0.5))
  }

  /**
   * Candidate entry ids that share at least one query token.
   * Falls back to empty (caller may full-scan) when no tokens.
   */
  candidates(queryTokens: string[]): Set<string> {
    const out = new Set<string>()
    if (!queryTokens.length) return out
    for (const t of queryTokens) {
      const set = this.tokenToIds.get(t)
      if (set) {
        for (const id of set) out.add(id)
      }
      // prefix overlap for short stems
      if (t.length >= 4) {
        for (const [tok, ids] of this.tokenToIds) {
          if (tok.startsWith(t) || t.startsWith(tok)) {
            for (const id of ids) out.add(id)
          }
        }
      }
    }
    return out
  }

  tokensFor(id: string): string[] {
    return this.idToTokens.get(id) ?? []
  }
}

export function buildQueryIndex(bank: MemoryBank | null | undefined): MemoryQueryIndex {
  const idx = new MemoryQueryIndex()
  idx.rebuild(bank)
  return idx
}
