import { describe, expect, it } from 'vitest'
import { calculateCost, getModelPricing } from '../calculator'

describe('getModelPricing', () => {
  it('returns exact match pricing for known provider+model', () => {
    const pricing = getModelPricing('openai', 'gpt-4o')
    expect(pricing.input).toBe(2.5)
    expect(pricing.output).toBe(10)
    expect(pricing.cachedInput).toBe(1.25)
  })

  it('returns prefix match for model variants', () => {
    const pricing = getModelPricing('claude', 'claude-3-5-sonnet-20241022')
    expect(pricing.input).toBe(3)
    expect(pricing.output).toBe(15)
    expect(pricing.cachedInput).toBe(0.3)
  })

  it('returns longest prefix match', () => {
    // 'gpt-4o-mini' should match over 'gpt-4o'
    const pricing = getModelPricing('openai', 'gpt-4o-mini-2024')
    expect(pricing.input).toBe(0.15)
    expect(pricing.output).toBe(0.6)
  })

  it('returns provider _default for unknown models', () => {
    const pricing = getModelPricing('openai', 'some-future-model')
    expect(pricing.input).toBe(2.5)
    expect(pricing.output).toBe(10)
    expect(pricing.cachedInput).toBe(1.25)
  })

  it('returns fallback pricing for unknown providers', () => {
    const pricing = getModelPricing('unknown-provider', 'some-model')
    expect(pricing.input).toBe(1)
    expect(pricing.output).toBe(3)
    expect(pricing.cachedInput).toBe(0.5)
  })

  it('handles empty strings gracefully', () => {
    const pricing = getModelPricing('', '')
    expect(pricing).toBeDefined()
    expect(pricing.input).toBeGreaterThan(0)
  })
})

describe('calculateCost', () => {
  const pricing = { input: 3, output: 15, cachedInput: 0.3 }

  it('calculates correct cost with no caching', () => {
    const result = calculateCost(1000, 500, 0, pricing)
    // input: 1000/1M * 3 = 0.003, output: 500/1M * 15 = 0.0075
    expect(result.costWithoutCache).toBeCloseTo(0.0105, 6)
    expect(result.actualCost).toBeCloseTo(0.0105, 6)
    expect(result.savings).toBeCloseTo(0, 6)
  })

  it('calculates correct cost with full caching', () => {
    const result = calculateCost(1000, 500, 1000, pricing)
    // Without cache: 0.003 + 0.0075 = 0.0105
    // Actual: 0/1M * 3 + 1000/1M * 0.3 + 500/1M * 15 = 0 + 0.0003 + 0.0075 = 0.0078
    expect(result.costWithoutCache).toBeCloseTo(0.0105, 6)
    expect(result.actualCost).toBeCloseTo(0.0078, 6)
    expect(result.savings).toBeCloseTo(0.0027, 6)
  })

  it('calculates correct cost with partial caching', () => {
    const result = calculateCost(1000, 500, 600, pricing)
    // Without cache: 0.003 + 0.0075 = 0.0105
    // Actual: 400/1M*3 + 600/1M*0.3 + 500/1M*15 = 0.0012 + 0.00018 + 0.0075 = 0.00888
    expect(result.costWithoutCache).toBeCloseTo(0.0105, 6)
    expect(result.actualCost).toBeCloseTo(0.00888, 5)
    expect(result.savings).toBeCloseTo(0.00162, 5)
  })

  it('handles zero tokens', () => {
    const result = calculateCost(0, 0, 0, pricing)
    expect(result.costWithoutCache).toBe(0)
    expect(result.actualCost).toBe(0)
    expect(result.savings).toBe(0)
  })

  it('clamps savings to zero when cachedInput exceeds input', () => {
    // Edge case: cachedInputTokens > inputTokens (shouldn't happen but be safe)
    const result = calculateCost(100, 100, 200, pricing)
    expect(result.savings).toBeGreaterThanOrEqual(0)
  })
})
