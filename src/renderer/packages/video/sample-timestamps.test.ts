import { describe, expect, it } from 'vitest'
import { computeSampleTimestamps } from './sample-timestamps'

describe('computeSampleTimestamps', () => {
  it('returns empty for invalid duration', () => {
    expect(computeSampleTimestamps({ durationSec: 0, maxFrames: 4 })).toEqual([])
  })

  it('evenly spaces frames within duration', () => {
    const times = computeSampleTimestamps({ durationSec: 10, maxFrames: 4, mode: 'evenly_spaced' })
    expect(times).toHaveLength(4)
    expect(times[0]).toBeGreaterThanOrEqual(0)
    expect(times[times.length - 1]).toBeLessThan(10)
    // Monotonic
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThan(times[i - 1])
    }
  })

  it('single frame uses midpoint of window', () => {
    const times = computeSampleTimestamps({ durationSec: 10, maxFrames: 1, startSec: 0, endSec: 10 })
    expect(times).toHaveLength(1)
    expect(times[0]).toBeCloseTo(5, 0)
  })

  it('respects explicit timestamps and maxFrames', () => {
    const times = computeSampleTimestamps({
      durationSec: 30,
      maxFrames: 2,
      mode: 'timestamps',
      timestamps: [1, 5, 10, 20],
    })
    expect(times).toHaveLength(2)
    expect(times[0]).toBeCloseTo(1, 1)
    expect(times[1]).toBeCloseTo(5, 1)
  })

  it('interval mode steps until maxFrames', () => {
    const times = computeSampleTimestamps({
      durationSec: 20,
      maxFrames: 3,
      mode: 'interval',
      intervalSec: 5,
      startSec: 0,
      endSec: 20,
    })
    expect(times).toHaveLength(3)
    expect(times[0]).toBeCloseTo(0, 1)
  })

  it('clamps timestamps past end', () => {
    const times = computeSampleTimestamps({
      durationSec: 5,
      maxFrames: 2,
      mode: 'timestamps',
      timestamps: [0, 99],
    })
    expect(times[1]).toBeLessThan(5)
  })
})
