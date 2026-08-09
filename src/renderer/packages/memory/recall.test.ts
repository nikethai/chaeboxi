import { describe, expect, it } from 'vitest'
import type { MemoryEntry } from '@shared/types/memory'
import { emptyMemoryBank } from '@shared/types/memory'
import { buildQueryIndex } from './query-index'
import { recallEntries } from './recall'
import { hostPreSearchMemories } from './host-presearch'
import { buildTokenVector, cosineSimilarity, rebuildSemanticForBank } from './semantic'
import { contentTokenJaccard, pruneEntries, retainEntry, createEntry } from './bank-ops'
import { defaultMemorySettings } from '@shared/types/memory'
import { resetMemoryMetrics, getMemoryMetrics } from './metrics'

function entry(partial: Partial<MemoryEntry> & Pick<MemoryEntry, 'id' | 'content'>): MemoryEntry {
  return {
    tags: [],
    scope: 'global',
    source: 'user',
    enabled: true,
    pinned: false,
    archived: false,
    createdAt: 1,
    updatedAt: 1,
    ...partial,
  }
}

describe('recallEntries (unified)', () => {
  it('ranks same way as host pre-search for same query', () => {
    const globalBank = {
      ...emptyMemoryBank('global'),
      entries: [
        entry({ id: '1', content: 'Prefers pnpm package manager', updatedAt: 2 }),
        entry({ id: '2', content: 'Lives in Hanoi', updatedAt: 1 }),
        entry({ id: '3', content: 'pnpm monorepos', pinned: true, updatedAt: 3 }),
      ],
    }
    const query = 'install with pnpm please'
    const host = hostPreSearchMemories({ query, globalBank, limit: 5 })
    const recall = recallEntries({ query, globalBank, limit: 5, asPresearch: false })
    expect(recall.map((h) => h.id)).toEqual(host.map((h) => h.id))
  })

  it('uses inverted index candidates at scale', () => {
    const entries = Array.from({ length: 2000 }, (_, i) =>
      entry({
        id: `e${i}`,
        content: i === 1234 ? 'User prefers typescript strict mode' : `generic fact number ${i} about nothing special`,
        updatedAt: i,
      })
    )
    const bank = { ...emptyMemoryBank('global'), entries }
    const index = buildQueryIndex(bank)
    const t0 = performance.now()
    const hits = recallEntries({
      query: 'typescript strict',
      globalBank: bank,
      globalIndex: index,
      limit: 5,
    })
    const ms = performance.now() - t0
    expect(hits.some((h) => h.id === 'e1234')).toBe(true)
    expect(ms).toBeLessThan(100)
  })
})

describe('near-dup retain', () => {
  it('merges high-jaccard content', () => {
    expect(contentTokenJaccard('User prefers dark mode UI', 'User prefers dark mode interface')).toBeGreaterThan(
      0.5
    )
    const settings = defaultMemorySettings()
    let bank = emptyMemoryBank('global')
    const e1 = createEntry({
      content: 'User prefers dark mode for the editor UI',
      scope: 'global',
      source: 'user',
      maxEntryChars: 500,
    })!
    bank = retainEntry(bank, e1, settings)
    const e2 = createEntry({
      content: 'User prefers dark mode for the editor UI layout',
      scope: 'global',
      source: 'auto',
      maxEntryChars: 500,
    })!
    // exact-ish near dup via fingerprint or jaccard
    bank = retainEntry(bank, e2, settings)
    expect(bank.entries.length).toBe(1)
  })
})

describe('soft archive prune', () => {
  it('archives overflow instead of hard delete when softArchive', () => {
    const entries = Array.from({ length: 5 }, (_, i) =>
      createEntry({
        content: `unique fact content item ${i} value`,
        scope: 'global',
        source: 'user',
        maxEntryChars: 500,
        pinned: i === 0,
      })!
    )
    const pruned = pruneEntries(entries, 3, { softArchive: true })
    expect(pruned.length).toBeGreaterThanOrEqual(3)
    expect(pruned.some((e) => e.pinned)).toBe(true)
    const archived = pruned.filter((e) => e.archived)
    expect(archived.length).toBeGreaterThan(0)
  })

  it('prefers lastAccessed when pruning hard', () => {
    const a = entry({ id: 'a', content: 'alpha fact unique', updatedAt: 100, lastAccessedAt: 1000 })
    const b = entry({ id: 'b', content: 'beta fact unique', updatedAt: 200, lastAccessedAt: 10 })
    const c = entry({ id: 'c', content: 'gamma fact unique', updatedAt: 300, pinned: true })
    const pruned = pruneEntries([a, b, c], 2, { softArchive: false })
    expect(pruned.some((e) => e.id === 'c')).toBe(true)
    expect(pruned.some((e) => e.id === 'a')).toBe(true)
  })
})

describe('semantic local vectors', () => {
  it('similar texts have higher cosine than unrelated', () => {
    const v1 = buildTokenVector('prefers typescript strict mode projects')
    const v2 = buildTokenVector('typescript strict mode preference')
    const v3 = buildTokenVector('favorite food is pizza')
    expect(cosineSimilarity(v1, v2)).toBeGreaterThan(cosineSimilarity(v1, v3))
  })

  it('semantic fusion can surface paraphrase-ish hits', () => {
    const bank = {
      ...emptyMemoryBank('global'),
      entries: [
        entry({ id: '1', content: 'User likes TypeScript strict compiler options' }),
        entry({ id: '2', content: 'Favorite pizza topping is pepperoni' }),
      ],
    }
    const vectors = rebuildSemanticForBank(bank.entries)
    const hits = recallEntries({
      query: 'typescript compiler preferences',
      globalBank: bank,
      semanticVectors: vectors,
      settings: { semanticSearchEnabled: true, semanticFusionWeight: 0.5 },
      limit: 2,
    })
    expect(hits[0]?.id).toBe('1')
  })
})

describe('metrics', () => {
  it('records presearch', () => {
    resetMemoryMetrics()
    recallEntries({
      query: 'pnpm',
      globalBank: {
        ...emptyMemoryBank('global'),
        entries: [entry({ id: '1', content: 'uses pnpm' })],
      },
      asPresearch: true,
      limit: 3,
    })
    const m = getMemoryMetrics()
    expect(m.presearchCount).toBe(1)
    expect(m.presearchLastHits).toBeGreaterThanOrEqual(1)
  })
})
