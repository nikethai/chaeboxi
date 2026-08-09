import { describe, expect, it } from 'vitest'
import type { MemoryEntry } from '@shared/types/memory'
import { emptyMemoryBank } from '@shared/types/memory'
import { hostPreSearchMemories } from './host-presearch'

function entry(partial: Partial<MemoryEntry> & Pick<MemoryEntry, 'id' | 'content'>): MemoryEntry {
  return {
    tags: [],
    scope: 'global',
    source: 'user',
    enabled: true,
    pinned: false,
    createdAt: 1,
    updatedAt: 1,
    ...partial,
  }
}

describe('hostPreSearchMemories', () => {
  it('returns empty for blank query', () => {
    expect(
      hostPreSearchMemories({
        query: '   ',
        globalBank: { ...emptyMemoryBank('global'), entries: [entry({ id: '1', content: 'pnpm user' })] },
      })
    ).toEqual([])
  })

  it('ranks matching facts and respects limit', () => {
    const globalBank = {
      ...emptyMemoryBank('global'),
      entries: [
        entry({ id: '1', content: 'Prefers pnpm', updatedAt: 2 }),
        entry({ id: '2', content: 'Lives in Hanoi', updatedAt: 1 }),
        entry({ id: '3', content: 'pnpm monorepos', pinned: true, updatedAt: 3 }),
      ],
    }
    const hits = hostPreSearchMemories({
      query: 'install with pnpm please',
      globalBank,
      limit: 2,
    })
    expect(hits.length).toBe(2)
    expect(hits.every((h) => h.content.toLowerCase().includes('pnpm'))).toBe(true)
  })
})
