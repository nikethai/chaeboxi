import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizeBank } from '@/packages/memory/clone'
import * as persistence from '@/packages/memory/persistence'
import storage from '@/storage'
import type { MemoryBank } from '@shared/types/memory'

describe('normalizeBank sync fields', () => {
  it('preserves revision and deleted flags', () => {
    const bank = normalizeBank(
      {
        scope: 'global',
        version: 1,
        revision: 4,
        entries: [
          {
            id: 'm1',
            content: 'User prefers concise answers',
            tags: ['preference'],
            scope: 'global',
            source: 'user',
            enabled: true,
            pinned: false,
            createdAt: 1,
            updatedAt: 2,
            revision: 3,
            deleted: true,
          },
        ],
        profileSummary: '',
      },
      'global'
    )

    expect(bank.revision).toBe(4)
    expect(bank.entries[0].revision).toBe(3)
    expect(bank.entries[0].deleted).toBe(true)
  })
})

describe('listAgentBankIds', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('finds all memory:agent:* keys', async () => {
    vi.spyOn(storage, 'getAllKeys').mockResolvedValue([
      'memory:agent:agent-1',
      'memory:agent:agent-2',
      'memory-bank-global',
    ])

    await expect(persistence.listAgentBankIds()).resolves.toEqual(['agent-1', 'agent-2'])
  })
})

describe('loadAllAgentBanks', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads a bank for every enumerated agent id', async () => {
    vi.spyOn(storage, 'getAllKeys').mockResolvedValue(['memory:agent:agent-1'])
    const bank = {
      scope: 'agent',
      agentId: 'agent-1',
      version: 1,
      revision: 2,
      entries: [],
      profileSummary: '',
      profileSlots: { identity: '', prefs: '', projects: '' },
    } as MemoryBank
    vi.spyOn(storage, 'getItem').mockResolvedValue(bank)

    const result = await persistence.loadAllAgentBanks()

    expect(result).toEqual([{ agentId: 'agent-1', bank }])
  })
})
