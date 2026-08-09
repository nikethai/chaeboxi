import { describe, expect, it } from 'vitest'
import { normalizeBank } from '@/packages/memory/clone'

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
