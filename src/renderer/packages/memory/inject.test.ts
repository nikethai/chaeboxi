import { describe, expect, it } from 'vitest'
import type { MemoryBank, MemoryEntry, MemorySettings } from '@shared/types/memory'
import { defaultMemorySettings, emptyMemoryBank } from '@shared/types/memory'
import { buildMemoryInjectBlock, getMemoryInjectStats } from './inject'

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

function bankWith(entries: MemoryEntry[], profile = ''): MemoryBank {
  return { ...emptyMemoryBank('global'), entries, profileSummary: profile }
}

function settings(patch: Partial<MemorySettings> = {}): MemorySettings {
  return { ...defaultMemorySettings(), ...patch }
}

describe('buildMemoryInjectBlock modes', () => {
  const unpinned = entry({ id: 'u1', content: 'Uses pnpm for installs', pinned: false, updatedAt: 2 })
  const pinned = entry({ id: 'p1', content: 'Name is Alex', pinned: true, updatedAt: 3 })

  it('disabled returns empty', () => {
    const text = buildMemoryInjectBlock({
      settings: settings({ enabled: false }),
      globalBank: bankWith([pinned, unpinned]),
    })
    expect(text).toBe('')
  })

  it('always injects unpinned facts when budget allows', () => {
    const text = buildMemoryInjectBlock({
      settings: settings({ retrievalMode: 'always' }),
      globalBank: bankWith([pinned, unpinned]),
    })
    expect(text).toContain('Name is Alex')
    expect(text).toContain('Uses pnpm for installs')
    expect(text).toContain('Key facts:')
  })

  it('hybrid injects pinned only, not unpinned', () => {
    const text = buildMemoryInjectBlock({
      settings: settings({ retrievalMode: 'hybrid', hostPreSearchEnabled: false }),
      globalBank: bankWith([pinned, unpinned]),
    })
    expect(text).toContain('Name is Alex')
    expect(text).toContain('Pinned facts:')
    expect(text).not.toContain('Uses pnpm for installs')
    expect(text).toContain('memory_recall')
  })

  it('on_demand is policy-only without pre-search hits', () => {
    const text = buildMemoryInjectBlock({
      settings: settings({ retrievalMode: 'on_demand', hostPreSearchEnabled: false }),
      globalBank: bankWith([pinned, unpinned]),
    })
    expect(text).toContain('on-demand')
    expect(text).toContain('memory_recall')
    expect(text).not.toContain('Name is Alex')
    expect(text).not.toContain('pnpm')
  })

  it('on_demand forceHybridFallback injects pinned core', () => {
    const text = buildMemoryInjectBlock({
      settings: settings({ retrievalMode: 'on_demand', hostPreSearchEnabled: false }),
      globalBank: bankWith([pinned, unpinned]),
      forceHybridFallback: true,
    })
    expect(text).toContain('Name is Alex')
    expect(text).not.toContain('Uses pnpm for installs')
  })

  it('host pre-search attaches matching unpinned fact in hybrid', () => {
    const text = buildMemoryInjectBlock({
      settings: settings({
        retrievalMode: 'hybrid',
        hostPreSearchEnabled: true,
        hostPreSearchLimit: 5,
      }),
      globalBank: bankWith([pinned, unpinned]),
      userQuery: 'How do I install packages with pnpm?',
    })
    expect(text).toContain('Name is Alex')
    expect(text).toContain('Memory lookup')
    expect(text).toContain('Uses pnpm for installs')
  })

  it('host pre-search always emits lookup section even when no match', () => {
    const text = buildMemoryInjectBlock({
      settings: settings({
        retrievalMode: 'hybrid',
        hostPreSearchEnabled: true,
      }),
      globalBank: bankWith([unpinned]),
      userQuery: 'hello there',
    })
    expect(text).not.toContain('Uses pnpm for installs')
    expect(text).toContain('Memory lookup')
    expect(text).toContain('No matching memories')
  })

  it('getMemoryInjectStats reports mode and tokens', () => {
    const stats = getMemoryInjectStats({
      settings: settings({ retrievalMode: 'hybrid', hostPreSearchEnabled: false }),
      globalBank: bankWith([pinned]),
    })
    expect(stats.enabled).toBe(true)
    expect(stats.mode).toBe('hybrid')
    expect(stats.factCount).toBe(1)
    expect(stats.injectTokens).toBeGreaterThan(0)
  })
})
