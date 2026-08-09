import { describe, expect, it } from 'vitest'
import { defaultMemorySettings, emptyMemoryBank } from '@shared/types/memory'
import {
  createEntry,
  pruneEntries,
  retainEntry,
  searchEntries,
  simpleProfileFromEntries,
  updateEntry,
  deleteEntry,
} from './bank-ops'
// createEntry / pruneEntries also used in edge-case tests below
import { redactSecrets, isEmptyAfterRedaction } from './redaction'
import { buildMemoryInjectBlock, estimateInjectTokens } from './inject'
import { migratePersonalInfoToBank } from './migrate-personal-info'

describe('redaction', () => {
  it('redacts api keys', () => {
    const out = redactSecrets('my key is sk-abcdefghijklmnopqrstuvwxyz012345')
    expect(out).toContain('[REDACTED]')
    expect(out).not.toContain('sk-abc')
  })

  it('detects empty after redaction', () => {
    expect(isEmptyAfterRedaction('sk-abcdefghijklmnopqrstuvwxyz012345')).toBe(true)
  })
})

describe('bank-ops', () => {
  const settings = defaultMemorySettings()

  it('creates and retains entries with dedupe', () => {
    let bank = emptyMemoryBank('global')
    const e1 = createEntry({
      content: 'User prefers dark mode',
      scope: 'global',
      source: 'user',
      maxEntryChars: 500,
      tags: ['preference'],
    })
    expect(e1).not.toBeNull()
    bank = retainEntry(bank, e1!, settings)
    expect(bank.entries).toHaveLength(1)

    const e2 = createEntry({
      content: 'User prefers dark mode',
      scope: 'global',
      source: 'auto',
      maxEntryChars: 500,
      tags: ['preference'],
    })
    bank = retainEntry(bank, e2!, settings)
    expect(bank.entries).toHaveLength(1)
  })

  it('prunes non-pinned first (hard)', () => {
    const entries = Array.from({ length: 5 }, (_, i) =>
      createEntry({
        content: `fact ${i} unique content value`,
        scope: 'global',
        source: 'user',
        maxEntryChars: 500,
        pinned: i === 0,
      })!
    )
    const pruned = pruneEntries(entries, 3, { softArchive: false })
    expect(pruned.length).toBeLessThanOrEqual(3)
    expect(pruned.some((e) => e.pinned)).toBe(true)
  })

  it('soft-archives overflow instead of dropping', () => {
    const entries = Array.from({ length: 5 }, (_, i) =>
      createEntry({
        content: `fact ${i} unique soft archive`,
        scope: 'global',
        source: 'user',
        maxEntryChars: 500,
        pinned: i === 0,
      })!
    )
    const pruned = pruneEntries(entries, 3, { softArchive: true })
    expect(pruned.some((e) => e.pinned)).toBe(true)
    expect(pruned.some((e) => e.archived)).toBe(true)
  })

  it('search and update/delete', () => {
    let bank = emptyMemoryBank('global')
    const e = createEntry({
      content: 'Name is Alice',
      scope: 'global',
      source: 'user',
      maxEntryChars: 500,
      tags: ['identity'],
    })!
    bank = retainEntry(bank, e, settings)
    expect(searchEntries(bank, 'alice')).toHaveLength(1)
    bank = updateEntry(bank, e.id, { content: 'Name is Bob' })
    expect(bank.entries[0].content).toContain('Bob')
    bank = deleteEntry(bank, e.id)
    expect(bank.entries).toHaveLength(0)
  })

  it('builds simple profile', () => {
    const bank = emptyMemoryBank('global')
    const e = createEntry({
      content: 'Speaks Vietnamese',
      scope: 'global',
      source: 'user',
      maxEntryChars: 500,
    })!
    const withEntry = retainEntry(bank, e, settings)
    const profile = simpleProfileFromEntries(withEntry.entries)
    expect(profile).toContain('Vietnamese')
  })
})

describe('inject', () => {
  it('respects token budget roughly', () => {
    const settings = defaultMemorySettings()
    settings.injectBudgetTokensGlobal = 200
    settings.injectBudgetTokensAgent = 50
    const bank = emptyMemoryBank('global')
    bank.profileSummary = ['- Prefers dark mode', '- Speaks Vietnamese', '- Uses TypeScript'].join('\n')
    bank.entries = Array.from({ length: 20 }, (_, i) =>
      createEntry({
        content: `Long fact number ${i} with extra detail about preferences and history`,
        scope: 'global',
        source: 'user',
        maxEntryChars: 500,
      })!
    )
    const block = buildMemoryInjectBlock({ settings, globalBank: bank })
    expect(block).toContain('Memory')
    expect(estimateInjectTokens(block)).toBeLessThanOrEqual(settings.injectBudgetTokensGlobal + 120)
  })

  it('returns empty when disabled', () => {
    const settings = defaultMemorySettings()
    settings.enabled = false
    const bank = emptyMemoryBank('global')
    bank.profileSummary = 'Hello'
    expect(buildMemoryInjectBlock({ settings, globalBank: bank })).toBe('')
  })
})

describe('migrate personal info', () => {
  it('converts entries', () => {
    const { bank, migratedCount } = migratePersonalInfoToBank({
      enableInjection: true,
      entries: [
        { id: '1', key: 'name', value: 'Huy' },
        { id: '2', key: 'lang', value: 'vi' },
      ],
    })
    expect(migratedCount).toBe(2)
    expect(bank.entries.length).toBe(2)
    expect(bank.profileSummary.length).toBeGreaterThan(0)
  })
})

describe('createEntry edge cases', () => {
  it('defaults maxEntryChars when 0 or invalid', () => {
    const e = createEntry({
      content: 'User prefers dark mode UI',
      scope: 'global',
      source: 'user',
      maxEntryChars: 0,
    })
    expect(e).not.toBeNull()
    expect(e!.content).toContain('dark mode')
  })

  it('prunes safely when max is invalid', () => {
    const entries = Array.from({ length: 5 }, (_, i) =>
      createEntry({
        content: `fact ${i} unique content here`,
        scope: 'global',
        source: 'user',
        maxEntryChars: 500,
      })!
    )
    const pruned = pruneEntries(entries, Number.NaN)
    expect(pruned.length).toBeGreaterThan(0)
  })
})
