import { describe, expect, it } from 'vitest'
import { QUICK_SESSION_REUSE_WINDOW_MS, resolveQuickSessionId } from './quickSession'

describe('resolveQuickSessionId', () => {
  const now = 10_000

  it('reuses the last quick session through the three-minute boundary', () => {
    expect(
      resolveQuickSessionId(
        { sessionId: 'quick-1', lastOpenedAt: now - QUICK_SESSION_REUSE_WINDOW_MS },
        ['quick-1', 'other'],
        now
      )
    ).toBe('quick-1')
  })

  it('starts fresh after three minutes or when the saved session is missing', () => {
    expect(
      resolveQuickSessionId(
        { sessionId: 'quick-1', lastOpenedAt: now - QUICK_SESSION_REUSE_WINDOW_MS - 1 },
        ['quick-1'],
        now
      )
    ).toBeNull()
    expect(resolveQuickSessionId({ sessionId: 'quick-1', lastOpenedAt: now }, ['other'], now)).toBeNull()
  })
})
