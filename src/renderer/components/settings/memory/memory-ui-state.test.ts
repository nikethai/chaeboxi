import type { MemoryEntry } from '@shared/types/memory'
import { describe, expect, it } from 'vitest'
import { filterMemoryEntries, memoryScopeKey, parseTagsInput, sortMemoryEntries } from './memory-ui-state'

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

describe('memory-ui-state', () => {
  it('memoryScopeKey isolates global vs agent', () => {
    expect(memoryScopeKey('global')).toBe('global')
    expect(memoryScopeKey('agent', 'a1')).toBe('agent:a1')
    expect(memoryScopeKey('agent', null)).toBe('global')
  })

  it('parseTagsInput trims and drops empties', () => {
    expect(parseTagsInput(' a, b , ,c ')).toEqual(['a', 'b', 'c'])
    expect(parseTagsInput('')).toEqual([])
  })

  it('sortMemoryEntries pins first then newest', () => {
    const list = [
      entry({ id: '1', content: 'old', pinned: false, updatedAt: 10 }),
      entry({ id: '2', content: 'pin', pinned: true, updatedAt: 5 }),
      entry({ id: '3', content: 'new', pinned: false, updatedAt: 20 }),
    ]
    expect(sortMemoryEntries(list).map((e) => e.id)).toEqual(['2', '3', '1'])
  })

  it('filterMemoryEntries matches content, tags, id', () => {
    const list = [
      entry({ id: 'abc', content: 'Prefers dark mode', tags: ['ui'], updatedAt: 2 }),
      entry({ id: 'def', content: 'Lives in Hanoi', tags: ['bio'], updatedAt: 1 }),
    ]
    expect(filterMemoryEntries(list, 'dark').map((e) => e.id)).toEqual(['abc'])
    expect(filterMemoryEntries(list, 'bio').map((e) => e.id)).toEqual(['def'])
    expect(filterMemoryEntries(list, 'abc').map((e) => e.id)).toEqual(['abc'])
  })
})
