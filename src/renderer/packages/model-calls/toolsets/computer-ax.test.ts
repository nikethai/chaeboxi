import { describe, expect, it } from 'vitest'
import { isAxVisionFallback, normalizeAxRole } from './computer-ax'

describe('normalizeAxRole', () => {
  it('maps aliases', () => {
    expect(normalizeAxRole('Search_Field')).toBe('search')
    expect(normalizeAxRole('AXButton')).toBe('button')
    expect(normalizeAxRole('textfield')).toBe('text_field')
    expect(normalizeAxRole('')).toBe('any')
  })
})

describe('isAxVisionFallback', () => {
  it('detects explicit fallback and empty errors', () => {
    expect(isAxVisionFallback({ fallback: 'vision' })).toBe(true)
    expect(isAxVisionFallback({ ok: false, error: 'AX_EMPTY' })).toBe(true)
    expect(isAxVisionFallback({ ok: true })).toBe(false)
    expect(isAxVisionFallback(null)).toBe(true)
  })
})
