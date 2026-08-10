/**
 * @vitest-environment jsdom
 */
import { MantineProvider } from '@mantine/core'
import type { MemoryEntry } from '@shared/types/memory'
import { defaultMemorySettings } from '@shared/types/memory'
import { render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryAdvancedPanel } from './MemoryAdvancedPanel'
import { filterMemoryEntries, memoryScopeKey, parseTagsInput, sortMemoryEntries } from './memory-ui-state'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('@/stores/settingsStore', () => ({
  useSettingsStore: (selector: (state: unknown) => unknown) =>
    selector({
      extension: {
        memorySync: { enabled: false, endpoint: '', token: '', autoSync: false, intervalSeconds: 60 },
      },
      setSettings: vi.fn(),
    }),
}))

vi.mock('@/stores/memorySync', () => ({
  getMemorySyncState: vi.fn(async () => ({ revision: 0 })),
  testMemorySyncConnection: vi.fn(),
  pullMemoryFromServer: vi.fn(),
  pushMemoryToServer: vi.fn(),
  syncMemoryNow: vi.fn(),
}))

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: () => ({
    addEventListener: vi.fn(),
    matches: false,
    removeEventListener: vi.fn(),
  }),
})

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverMock,
})

function renderSyncPanel() {
  render(
    createElement(
      MantineProvider,
      null,
      createElement(MemoryAdvancedPanel, {
        settings: defaultMemorySettings(),
        factCount: 0,
        injectTokens: 0,
        injectText: '',
        onSettingsChange: vi.fn(),
      })
    )
  )
}

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

describe('MemoryAdvancedPanel sync section', () => {
  it('shows endpoint, token, passphrase, and sync actions', () => {
    renderSyncPanel()
    expect(screen.getByLabelText(/sync server endpoint/i)).not.toBeNull()
    expect(screen.getByLabelText(/sync token/i)).not.toBeNull()
    expect(screen.getByLabelText(/sync passphrase/i)).not.toBeNull()
    expect(screen.getByRole('button', { name: /sync now/i })).not.toBeNull()
  })
})
