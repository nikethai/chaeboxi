import { describe, expect, it, vi } from 'vitest'
import {
  clearSessionGenerationLive,
  isSessionGenerationLive,
  markSessionGenerationLive,
  subscribeSessionGenerationLive,
} from './session-live-generation'

describe('session-live-generation', () => {
  it('marks and clears live generation per session', () => {
    markSessionGenerationLive('s1', 'm1')
    expect(isSessionGenerationLive('s1')).toBe(true)
    expect(isSessionGenerationLive('s2')).toBe(false)

    clearSessionGenerationLive('s1', 'm-other')
    expect(isSessionGenerationLive('s1')).toBe(true)

    clearSessionGenerationLive('s1', 'm1')
    expect(isSessionGenerationLive('s1')).toBe(false)
  })

  it('notifies subscribers on mark/clear', () => {
    const spy = vi.fn()
    const unsub = subscribeSessionGenerationLive(spy)
    markSessionGenerationLive('s3', 'm3')
    expect(spy).toHaveBeenCalled()
    spy.mockClear()
    clearSessionGenerationLive('s3')
    expect(spy).toHaveBeenCalled()
    unsub()
  })
})
