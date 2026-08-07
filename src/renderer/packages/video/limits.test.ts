import { describe, expect, it } from 'vitest'
import { clampFrameCount, formatBytesForDisplay, formatDurationForDisplay, getVideoLimits } from './limits'

describe('getVideoLimits', () => {
  it('returns desktop caps', () => {
    const limits = getVideoLimits('desktop')
    expect(limits.maxFileBytes).toBe(200 * 1024 * 1024)
    expect(limits.maxDurationSec).toBe(600)
    expect(limits.defaultAutoFrames).toBe(6)
    expect(limits.maxFramesPerToolCall).toBe(8)
    expect(limits.maxFramesPerVideoPerTurn).toBe(8)
    expect(limits.maxVideosPerMessage).toBe(2)
  })

  it('returns mobile caps for mobile and web', () => {
    for (const form of ['mobile', 'web'] as const) {
      const limits = getVideoLimits(form)
      expect(limits.maxFileBytes).toBe(50 * 1024 * 1024)
      expect(limits.maxDurationSec).toBe(300)
      expect(limits.defaultAutoFrames).toBe(4)
      expect(limits.maxFramesPerToolCall).toBe(6)
      expect(limits.maxFramesPerVideoPerTurn).toBe(6)
      expect(limits.maxVideosPerMessage).toBe(1)
    }
  })
})

describe('clampFrameCount', () => {
  it('clamps and floors', () => {
    expect(clampFrameCount(0, 8)).toBe(1)
    expect(clampFrameCount(-1, 8)).toBe(1)
    expect(clampFrameCount(3.9, 8)).toBe(3)
    expect(clampFrameCount(99, 6)).toBe(6)
  })
})

describe('format helpers', () => {
  it('formats bytes and duration', () => {
    expect(formatBytesForDisplay(500)).toBe('500 B')
    expect(formatBytesForDisplay(2048)).toContain('KB')
    expect(formatBytesForDisplay(50 * 1024 * 1024)).toBe('50 MB')
    expect(formatDurationForDisplay(45)).toBe('45s')
    expect(formatDurationForDisplay(125)).toBe('2m 05s')
  })
})
