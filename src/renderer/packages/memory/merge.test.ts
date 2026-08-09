import { describe, expect, it } from 'vitest'
import { markEntryDeleted, purgeExpiredTombstones } from '@/packages/memory/bank-ops'
import type { MemoryBank } from '@shared/types/memory'

describe('markEntryDeleted', () => {
  it('marks an entry deleted without removing it', () => {
    const next = markEntryDeleted(
      {
        scope: 'global',
        version: 1,
        revision: 1,
        profileSummary: '',
        entries: [
          {
            id: 'm1',
            content: 'Use concise replies',
            tags: [],
            scope: 'global',
            source: 'user',
            enabled: true,
            pinned: false,
            createdAt: 1,
            updatedAt: 1,
            revision: 1,
          },
        ],
      } as MemoryBank,
      'm1',
      100
    )

    expect(next.entries).toHaveLength(1)
    expect(next.entries[0].deleted).toBe(true)
    expect(next.entries[0].enabled).toBe(false)
    expect(next.entries[0].updatedAt).toBe(100)
    expect(next.entries[0].revision).toBe(2)
    expect(next.revision).toBe(2)
  })

  it('returns the bank unchanged when the id is not found', () => {
    const bank = {
      scope: 'global',
      version: 1,
      revision: 1,
      profileSummary: '',
      entries: [
        {
          id: 'm1',
          content: 'Use concise replies',
          tags: [],
          scope: 'global',
          source: 'user',
          enabled: true,
          pinned: false,
          createdAt: 1,
          updatedAt: 1,
          revision: 1,
        },
      ],
    } as MemoryBank

    const next = markEntryDeleted(bank, 'missing', 100)

    expect(next).toBe(bank)
    expect(next.entries[0].deleted).toBeUndefined()
  })
})

describe('purgeExpiredTombstones', () => {
  it('removes tombstones older than the TTL but keeps fresh tombstones and live entries', () => {
    const now = 1000
    const bank = {
      scope: 'global',
      version: 1,
      revision: 3,
      profileSummary: '',
      entries: [
        {
          id: 'old-tomb',
          content: 'gone',
          tags: [],
          scope: 'global',
          source: 'user',
          enabled: false,
          pinned: false,
          createdAt: 1,
          updatedAt: 10,
          revision: 2,
          deleted: true,
        },
        {
          id: 'fresh-tomb',
          content: 'recently deleted',
          tags: [],
          scope: 'global',
          source: 'user',
          enabled: false,
          pinned: false,
          createdAt: 50,
          updatedAt: now - 100,
          revision: 2,
          deleted: true,
        },
        {
          id: 'live',
          content: 'still here',
          tags: [],
          scope: 'global',
          source: 'user',
          enabled: true,
          pinned: false,
          createdAt: 1,
          updatedAt: 5,
          revision: 1,
        },
      ],
    } as MemoryBank

    const next = purgeExpiredTombstones(bank, now, 500)

    expect(next.entries.map((e) => e.id)).toEqual(['fresh-tomb', 'live'])
    expect(next.entries[0].deleted).toBe(true)
  })
})
