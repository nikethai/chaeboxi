import { describe, expect, it } from 'vitest'
import { clampMaxChars, truncateTranscript } from './truncate'

describe('truncateTranscript', () => {
  it('clamps max chars', () => {
    expect(clampMaxChars(10)).toBe(500)
    expect(clampMaxChars(100_000)).toBe(50_000)
    expect(clampMaxChars(8000)).toBe(8000)
  })

  it('does not truncate short text', () => {
    const r = truncateTranscript(
      { source: 'captions', text: 'hello world', segments: [{ startSec: 0, text: 'hello world' }] },
      { maxChars: 1000 }
    )
    expect(r.truncated).toBe(false)
    expect(r.transcript.text).toContain('hello')
  })

  it('truncates by segments with timestamps', () => {
    const segments = Array.from({ length: 50 }, (_, i) => ({
      startSec: i * 2,
      text: `segment number ${i} with some words`,
    }))
    const full = segments.map((s) => s.text).join(' ')
    const r = truncateTranscript(
      {
        source: 'captions',
        text: full,
        segments,
      },
      { maxChars: 600, includeTimestamps: true }
    )
    expect(r.truncated).toBe(true)
    // clampMin is 500; ensure we stayed at/under requested clamp
    expect(r.transcript.text.length).toBeLessThanOrEqual(600)
    expect(r.transcript.text.length).toBeLessThan(full.length)
    expect(r.transcript.segments!.length).toBeGreaterThan(0)
    expect(r.transcript.segments!.length).toBeLessThan(50)
  })

  it('filters by time window', () => {
    const r = truncateTranscript(
      {
        source: 'captions',
        text: 'a b c',
        segments: [
          { startSec: 0, endSec: 1, text: 'a' },
          { startSec: 5, endSec: 6, text: 'b' },
          { startSec: 10, endSec: 11, text: 'c' },
        ],
      },
      { startSec: 4, endSec: 7, includeTimestamps: false, maxChars: 5000 }
    )
    expect(r.transcript.segments).toHaveLength(1)
    expect(r.transcript.segments![0].text).toBe('b')
  })
})
