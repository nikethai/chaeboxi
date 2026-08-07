import { describe, expect, it } from 'vitest'
import { computeVisionResizeDimensions, VISION_MAX_PIXEL_L1, VISION_MAX_PIXEL_L2 } from './vision-resize'

describe('computeVisionResizeDimensions', () => {
  it('leaves small images unchanged', () => {
    expect(computeVisionResizeDimensions(640, 480)).toEqual({ width: 640, height: 480 })
  })

  it('caps long side to L1', () => {
    const { width, height } = computeVisionResizeDimensions(4000, 2000)
    expect(Math.max(width, height)).toBeLessThanOrEqual(VISION_MAX_PIXEL_L1)
  })

  it('caps short side to L2', () => {
    const { width, height } = computeVisionResizeDimensions(2000, 2000)
    expect(Math.min(width, height)).toBeLessThanOrEqual(VISION_MAX_PIXEL_L2)
  })
})
