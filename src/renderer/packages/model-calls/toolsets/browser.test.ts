import { beforeEach, describe, expect, it, vi } from 'vitest'

const platformMock = vi.hoisted(() => ({
  type: 'desktop' as string,
  browserSessionStart: vi.fn(async () => ({ ok: true })),
  browserSessionStatus: vi.fn(async () => ({ running: false })),
  browserSessionStop: vi.fn(async () => ({ stopped: true })),
  browserNavigate: vi.fn(async () => ({ url: 'https://example.com' })),
  browserSnapshot: vi.fn(async () => ({
    url: 'https://example.com',
    title: 'Example',
    snapshot: '[e1] heading "Hi"',
  })),
  browserAct: vi.fn(async () => ({ ok: true })),
  browserTabs: vi.fn(async () => ({ tabs: [] })),
  browserScreenshot: vi.fn(async () => ({ mimeType: 'image/png', base64: 'xx' })),
}))

vi.mock('@/platform', () => ({
  default: platformMock,
}))

vi.mock('@/stores/settingsStore', () => ({
  settingsStore: {
    getState: () => ({
      getSettings: () => ({
        extension: {
          browserAgent: { enabled: true, headless: false, allowlist: [], maxStepsPerTurn: 12 },
        },
      }),
    }),
  },
}))

vi.mock('@/stores/browserAgentUiStore', () => ({
  browserAgentUiStore: {
    getState: () => ({
      setStatus: vi.fn(),
      patchStatus: vi.fn(),
    }),
  },
}))

import { clearAllBrowserLocks } from '@/packages/browser/lock'
import { createBrowserToolSet } from './browser'

describe('createBrowserToolSet', () => {
  beforeEach(() => {
    clearAllBrowserLocks()
    platformMock.type = 'desktop'
    vi.clearAllMocks()
  })

  it('registers browser_* tools', () => {
    const set = createBrowserToolSet({ sessionId: 's1' })
    expect(Object.keys(set.tools).sort()).toEqual(
      [
        'browser_click',
        'browser_navigate',
        'browser_screenshot',
        'browser_scroll',
        'browser_snapshot',
        'browser_tabs',
        'browser_type',
      ].sort()
    )
  })

  it('navigate blocks file urls', async () => {
    const set = createBrowserToolSet({ sessionId: 's1' })
    const nav = set.tools.browser_navigate as { execute: (a: { url: string }) => Promise<unknown> }
    const result = (await nav.execute({ url: 'file:///tmp/x' })) as { error?: string }
    expect(result.error).toBe('SECURITY_BLOCKED')
    expect(platformMock.browserNavigate).not.toHaveBeenCalled()
  })

  it('navigate works on https when enabled', async () => {
    const set = createBrowserToolSet({ sessionId: 's1', runId: 'r1' })
    const nav = set.tools.browser_navigate as { execute: (a: { url: string }) => Promise<unknown> }
    await nav.execute({ url: 'https://example.com' })
    expect(platformMock.browserSessionStart).toHaveBeenCalled()
    expect(platformMock.browserNavigate).toHaveBeenCalledWith('s1', 'https://example.com/')
  })

  it('returns unsupported on web platform', async () => {
    platformMock.type = 'web'
    const set = createBrowserToolSet({ sessionId: 's1' })
    const snap = set.tools.browser_snapshot as { execute: (a: object) => Promise<unknown> }
    const result = (await snap.execute({})) as { error?: string }
    expect(result.error).toBe('UNSUPPORTED_PLATFORM')
  })
})
