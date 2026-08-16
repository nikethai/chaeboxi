import { describe, expect, it } from 'vitest'
import {
  calculateCost,
  estimateUsageCost,
  getModelPricing,
  listPriceTableRows,
  upsertPricingOverride,
} from '../calculator'

describe('getModelPricing', () => {
  it('returns exact match pricing for known provider+model', () => {
    const pricing = getModelPricing('openai', 'gpt-4o')
    expect(pricing).not.toBeNull()
    expect(pricing!.input).toBe(2.5)
    expect(pricing!.output).toBe(10)
    expect(pricing!.cachedInput).toBe(1.25)
  })

  it('returns prefix match for model variants', () => {
    const pricing = getModelPricing('claude', 'claude-3-5-sonnet-20241022')
    expect(pricing).not.toBeNull()
    expect(pricing!.input).toBe(3)
    expect(pricing!.output).toBe(15)
  })

  it('returns longest prefix match', () => {
    const pricing = getModelPricing('openai', 'gpt-4o-mini-2024')
    expect(pricing!.input).toBe(0.15)
    expect(pricing!.output).toBe(0.6)
  })

  it('returns known DeepSeek chat price (non-zero $)', () => {
    const pricing = getModelPricing('deepseek', 'deepseek-chat')
    expect(pricing).not.toBeNull()
    expect(pricing!.input).toBe(0.27)
    expect(pricing!.output).toBe(1.1)
    const cost = calculateCost(1_000_000, 1_000_000, 0, pricing!)
    expect(cost.actualCost).toBeCloseTo(1.37, 6)
  })

  it('returns null for a missing model — never a fake $', () => {
    expect(getModelPricing('openai', 'some-future-model')).toBeNull()
    expect(getModelPricing('unknown-provider', 'some-model')).toBeNull()
    expect(getModelPricing('', '')).toBeNull()
  })

  it('applies user overrides before the built-in table', () => {
    const overrides = upsertPricingOverride(undefined, 'deepseek', 'deepseek-chat', {
      input: 1,
      output: 2,
      cachedInput: 0.5,
    })
    const pricing = getModelPricing('deepseek', 'deepseek-chat', overrides)
    expect(pricing!.input).toBe(1)
    expect(pricing!.output).toBe(2)
  })

  it('lists built-in OpenAI / Anthropic / Gemini / DeepSeek / OpenRouter / Qwen rows', () => {
    const rows = listPriceTableRows()
    const providers = new Set(rows.map((r) => r.providerId))
    expect(providers.has('openai')).toBe(true)
    expect(providers.has('claude')).toBe(true)
    expect(providers.has('gemini')).toBe(true)
    expect(providers.has('deepseek')).toBe(true)
    expect(providers.has('openrouter')).toBe(true)
    expect(providers.has('qwen')).toBe(true)
    expect(rows.every((r) => r.modelId !== '_default')).toBe(true)
  })
})

describe('estimateUsageCost', () => {
  it('computes $ from a known DeepSeek price', () => {
    const pricing = getModelPricing('deepseek', 'deepseek-chat')
    const result = estimateUsageCost(100_000, 50_000, 0, pricing)
    expect(result.knownPrice).toBe(true)
    // 100k * 0.27 / 1M + 50k * 1.1 / 1M = 0.027 + 0.055 = 0.082
    expect(result.actualCost).toBeCloseTo(0.082, 6)
  })

  it('missing model = tokens only (no fake $)', () => {
    const result = estimateUsageCost(100_000, 50_000, 0, getModelPricing('ollama', 'llama3'))
    expect(result.knownPrice).toBe(false)
    expect(result.actualCost).toBe(0)
    expect(result.costWithoutCache).toBe(0)
  })
})

describe('calculateCost', () => {
  const pricing = { input: 3, output: 15, cachedInput: 0.3 }

  it('calculates correct cost with no caching', () => {
    const result = calculateCost(1000, 500, 0, pricing)
    expect(result.costWithoutCache).toBeCloseTo(0.0105, 6)
    expect(result.actualCost).toBeCloseTo(0.0105, 6)
    expect(result.savings).toBeCloseTo(0, 6)
  })

  it('calculates correct cost with full caching', () => {
    const result = calculateCost(1000, 500, 1000, pricing)
    expect(result.costWithoutCache).toBeCloseTo(0.0105, 6)
    expect(result.actualCost).toBeCloseTo(0.0078, 6)
    expect(result.savings).toBeCloseTo(0.0027, 6)
  })

  it('calculates correct cost with partial caching', () => {
    const result = calculateCost(1000, 500, 600, pricing)
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
    const result = calculateCost(100, 100, 200, pricing)
    expect(result.savings).toBeGreaterThanOrEqual(0)
  })
})
