import { describe, expect, it } from 'vitest'
import { markEntryDeleted, purgeExpiredTombstones } from '@/packages/memory/bank-ops'
import {
  mergeMemoryBanks,
  mergeMemoryEntries,
  mergeMemorySnapshots,
} from '@/packages/memory/merge'
import type { MemorySyncSnapshot } from '@/packages/memory/sync-types'
import { defaultMemorySettings, emptyMemoryBank, type MemoryBank, type MemoryEntry } from '@shared/types/memory'

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

function entry(overrides: Partial<MemoryEntry>): MemoryEntry {
  return {
    id: 'm1',
    content: 'Use short answers',
    tags: [],
    scope: 'global',
    source: 'user',
    enabled: true,
    pinned: false,
    createdAt: 1,
    updatedAt: 10,
    revision: 1,
    ...overrides,
  }
}

describe('mergeMemoryEntries', () => {
  it('prefers newer tombstone over older live entry', () => {
    const merged = mergeMemoryEntries(
      entry({ updatedAt: 10, revision: 1 }),
      entry({ enabled: false, updatedAt: 20, revision: 2, deleted: true })
    )

    expect(merged?.deleted).toBe(true)
    expect(merged?.enabled).toBe(false)
    expect(merged?.revision).toBe(2)
  })

  it('keeps the newer live entry when the tombstone is older', () => {
    const merged = mergeMemoryEntries(
      entry({ updatedAt: 20, revision: 2 }),
      entry({ enabled: false, updatedAt: 10, revision: 2, deleted: true })
    )

    expect(merged?.deleted).toBeUndefined()
    expect(merged?.enabled).toBe(true)
    expect(merged?.revision).toBe(2)
  })

  it('uses revision as a tie-breaker when updatedAt matches', () => {
    const merged = mergeMemoryEntries(
      entry({ updatedAt: 10, revision: 3 }),
      entry({ enabled: false, updatedAt: 10, revision: 4, deleted: true })
    )

    expect(merged?.deleted).toBe(true)
    expect(merged?.revision).toBe(4)
  })

  it('returns the existing side when the other side is missing', () => {
    const local = entry({ id: 'm1', revision: 2 })
    const remote = entry({ id: 'm2', revision: 1 })

    expect(mergeMemoryEntries(local, undefined)).toBe(local)
    expect(mergeMemoryEntries(undefined, remote)).toBe(remote)
    expect(mergeMemoryEntries(undefined, undefined)).toBeUndefined()
  })
})

describe('mergeMemoryBanks', () => {
  it('merges entries by id preferring the newer side and keeps tombstones', () => {
    const local: MemoryBank = {
      scope: 'global',
      version: 1,
      revision: 2,
      profileSummary: '',
      entries: [entry({ id: 'm1', updatedAt: 10, revision: 1 })],
    }
    const remote: MemoryBank = {
      scope: 'global',
      version: 1,
      revision: 3,
      profileSummary: '',
      entries: [entry({ id: 'm1', enabled: false, updatedAt: 20, revision: 2, deleted: true })],
    }

    const merged = mergeMemoryBanks(local, remote)

    expect(merged.entries).toHaveLength(1)
    expect(merged.entries[0].deleted).toBe(true)
    expect(merged.entries[0].revision).toBe(2)
    expect(merged.revision).toBe(3)
    // Profile rebuilds from merged entries and excludes the tombstone.
    expect(merged.profileSummary).toBe('')
  })

  it('combines disjoint entry sets from both banks', () => {
    const local: MemoryBank = {
      scope: 'global',
      version: 1,
      revision: 1,
      profileSummary: '',
      entries: [entry({ id: 'm1' })],
    }
    const remote: MemoryBank = {
      scope: 'global',
      version: 1,
      revision: 2,
      profileSummary: '',
      entries: [entry({ id: 'm2', updatedAt: 30, revision: 1 })],
    }

    const merged = mergeMemoryBanks(local, remote)

    expect(merged.entries.map((e) => e.id)).toEqual(['m1', 'm2'])
    expect(merged.revision).toBe(2)
    expect(merged.profileSummary).toContain('Use short answers')
  })
})

describe('mergeMemorySnapshots', () => {
  it('keeps local settings and merges global and agent banks', () => {
    const localSettings = defaultMemorySettings()
    const remoteSettings = { ...defaultMemorySettings(), autoSave: false }

    const local: MemorySyncSnapshot = {
      schemaVersion: 1,
      settings: localSettings,
      globalBank: {
        scope: 'global',
        version: 1,
        revision: 1,
        profileSummary: '',
        entries: [entry({ id: 'm1', content: 'local fact' })],
      },
      agentBanks: [
        {
          agentId: 'agent-1',
          bank: {
            scope: 'agent',
            agentId: 'agent-1',
            version: 1,
            revision: 1,
            profileSummary: '',
            entries: [entry({ id: 'a1', scope: 'agent', agentId: 'agent-1' })],
          },
        },
      ],
    }
    const remote: MemorySyncSnapshot = {
      schemaVersion: 1,
      settings: remoteSettings,
      globalBank: {
        scope: 'global',
        version: 1,
        revision: 2,
        profileSummary: '',
        entries: [entry({ id: 'm1', content: 'remote fact', updatedAt: 20, revision: 2 })],
      },
      agentBanks: [
        {
          agentId: 'agent-2',
          bank: emptyMemoryBank('agent', 'agent-2'),
        },
      ],
    }

    const merged = mergeMemorySnapshots({ local, remote })

    // v1 policy: local wins for settings.
    expect(merged.settings).toBe(localSettings)
    expect(merged.settings.autoSave).toBe(true)
    // Global bank picked the newer remote entry.
    expect(merged.globalBank.entries[0].content).toBe('remote fact')
    expect(merged.globalBank.entries[0].revision).toBe(2)
    expect(merged.globalBank.revision).toBe(2)
    // Agent banks from both sides are present and deterministic.
    expect(merged.agentBanks.map((b) => b.agentId)).toEqual(['agent-1', 'agent-2'])
    expect(merged.agentBanks[0].bank.entries[0].id).toBe('a1')
  })
})
