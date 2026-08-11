import { describe, expect, it } from 'vitest'
import { mapScreenshotToDisplay } from './coords'

describe('mapScreenshotToDisplay', () => {
  it('maps 1:1 when sizes match', () => {
    expect(mapScreenshotToDisplay(100, 50, { width: 1000, height: 500 }, { width: 1000, height: 500 })).toEqual({
      x: 100,
      y: 50,
    })
  })

  it('scales when display larger than screenshot', () => {
    const r = mapScreenshotToDisplay(100, 50, { width: 1000, height: 500 }, { width: 2000, height: 1000 })
    expect(r.x).toBe(200)
    expect(r.y).toBe(100)
  })

  it('returns identity when screenshot size zero', () => {
    expect(mapScreenshotToDisplay(10, 20, { width: 0, height: 0 }, { width: 100, height: 100 })).toEqual({
      x: 10,
      y: 20,
    })
  })

  it('clamps to display bounds', () => {
    const r = mapScreenshotToDisplay(2000, 2000, { width: 1000, height: 500 }, { width: 1000, height: 500 })
    expect(r.x).toBe(1000)
    expect(r.y).toBe(500)
  })
})
