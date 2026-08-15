/**
 * Cost Calculator
 *
 * Built-in local price table (USD per 1M tokens) for spend estimates.
 * Missing models return null — never invent a dollar amount.
 */

import type { EstimatedCost, ModelPricing, PricingOverrides, ProviderPricingMap } from './types'

export const SPEND_PRICE_PROVIDERS = [
  'openai',
  'openai-responses',
  'claude',
  'gemini',
  'deepseek',
  'openrouter',
  'qwen',
] as const

export type SpendPriceProviderId = (typeof SPEND_PRICE_PROVIDERS)[number]

export const SPEND_PRICE_PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  'openai-responses': 'OpenAI (Responses)',
  claude: 'Anthropic',
  gemini: 'Gemini',
  deepseek: 'DeepSeek',
  openrouter: 'OpenRouter',
  qwen: 'Qwen',
}

/**
 * Built-in list prices. Keys use prefix matching — longest prefix wins.
 * There is no _default and no generic fallback: unknown models stay unpriced.
 */
export const BUILTIN_PRICING: Record<string, ProviderPricingMap> = {
  openai: {
    'gpt-4o-mini': { input: 0.15, output: 0.6, cachedInput: 0.075 },
    'gpt-4o': { input: 2.5, output: 10, cachedInput: 1.25 },
    'gpt-4-turbo': { input: 10, output: 30, cachedInput: 5 },
    'gpt-5-nano': { input: 0.05, output: 0.4, cachedInput: 0.005 },
    'gpt-5-mini': { input: 0.25, output: 2, cachedInput: 0.025 },
    'gpt-5.1': { input: 1.25, output: 10, cachedInput: 0.125 },
    'gpt-5-chat': { input: 1.25, output: 10, cachedInput: 0.125 },
    'gpt-5': { input: 1.25, output: 10, cachedInput: 0.125 },
    'o1-mini': { input: 3, output: 12, cachedInput: 1.5 },
    'o1-pro': { input: 150, output: 600, cachedInput: 75 },
    o1: { input: 15, output: 60, cachedInput: 7.5 },
    'o3-mini': { input: 1.1, output: 4.4, cachedInput: 0.55 },
    'o4-mini': { input: 1.1, output: 4.4, cachedInput: 0.55 },
    o3: { input: 10, output: 40, cachedInput: 2.5 },
  },
  'openai-responses': {
    'gpt-4o-mini': { input: 0.15, output: 0.6, cachedInput: 0.075 },
    'gpt-4o': { input: 2.5, output: 10, cachedInput: 1.25 },
    'gpt-5-nano': { input: 0.05, output: 0.4, cachedInput: 0.005 },
    'gpt-5-mini': { input: 0.25, output: 2, cachedInput: 0.025 },
    'gpt-5.1': { input: 1.25, output: 10, cachedInput: 0.125 },
    'gpt-5-chat': { input: 1.25, output: 10, cachedInput: 0.125 },
    'gpt-5': { input: 1.25, output: 10, cachedInput: 0.125 },
    'o3-mini': { input: 1.1, output: 4.4, cachedInput: 0.55 },
    'o4-mini': { input: 1.1, output: 4.4, cachedInput: 0.55 },
    o3: { input: 10, output: 40, cachedInput: 2.5 },
  },
  claude: {
    'claude-3-5-sonnet': { input: 3, output: 15, cachedInput: 0.3 },
    'claude-3-5-haiku': { input: 0.8, output: 4, cachedInput: 0.08 },
    'claude-3-opus': { input: 15, output: 75, cachedInput: 1.5 },
    'claude-3-haiku': { input: 0.25, output: 1.25, cachedInput: 0.03 },
    'claude-3-sonnet': { input: 3, output: 15, cachedInput: 0.3 },
    'claude-sonnet-4-5': { input: 3, output: 15, cachedInput: 0.3 },
    'claude-sonnet-4': { input: 3, output: 15, cachedInput: 0.3 },
    'claude-haiku-4-5': { input: 1, output: 5, cachedInput: 0.1 },
    'claude-opus-4-1': { input: 15, output: 75, cachedInput: 1.5 },
    'claude-opus-4': { input: 15, output: 75, cachedInput: 1.5 },
  },
  gemini: {
    'gemini-2.0-flash': { input: 0.1, output: 0.4, cachedInput: 0.025 },
    'gemini-2.5-flash': { input: 0.15, output: 0.6, cachedInput: 0.0375 },
    'gemini-2.5-pro': { input: 1.25, output: 10, cachedInput: 0.3125 },
    'gemini-1.5-flash': { input: 0.075, output: 0.3, cachedInput: 0.01875 },
    'gemini-1.5-pro': { input: 1.25, output: 5, cachedInput: 0.3125 },
    'gemini-3-pro': { input: 2, output: 12, cachedInput: 0.2 },
  },
  deepseek: {
    // App still ships deepseek-chat / deepseek-reasoner as default IDs.
    'deepseek-chat': { input: 0.27, output: 1.1, cachedInput: 0.07 },
    'deepseek-reasoner': { input: 0.55, output: 2.19, cachedInput: 0.14 },
    'deepseek-v4-flash': { input: 0.14, output: 0.28, cachedInput: 0.0028 },
    'deepseek-v4-pro': { input: 0.435, output: 0.87, cachedInput: 0.003625 },
  },
  openrouter: {
    'openai/gpt-4o-2024-11-20': { input: 2.5, output: 10, cachedInput: 1.25 },
    'openai/gpt-4o': { input: 2.5, output: 10, cachedInput: 1.25 },
    'openai/gpt-5-chat': { input: 1.25, output: 10, cachedInput: 0.125 },
    'google/gemini-2.5-pro': { input: 1.25, output: 10, cachedInput: 0.3125 },
    'google/gemini-2.5-flash': { input: 0.15, output: 0.6, cachedInput: 0.0375 },
    'google/gemini-3-pro': { input: 2, output: 12, cachedInput: 0.2 },
    'x-ai/grok-3-mini': { input: 0.3, output: 0.5, cachedInput: 0.075 },
    'deepseek/deepseek-chat-v3.1:free': { input: 0, output: 0, cachedInput: 0 },
    'deepseek/deepseek-chat-v3-0324:free': { input: 0, output: 0, cachedInput: 0 },
    'deepseek/deepseek-r1:free': { input: 0, output: 0, cachedInput: 0 },
    'deepseek/deepseek-r1-0528': { input: 0.55, output: 2.19, cachedInput: 0.14 },
    'tngtech/deepseek-r1t2-chimera:free': { input: 0, output: 0, cachedInput: 0 },
  },
  qwen: {
    'qwen-turbo': { input: 0.05, output: 0.2, cachedInput: 0.01 },
    'qwen-plus': { input: 0.4, output: 1.2, cachedInput: 0.08 },
    'qwen-max': { input: 1.6, output: 6.4, cachedInput: 0.32 },
    'qwen3.8-max': { input: 2, output: 6, cachedInput: 0.4 },
    'qwen3.7-max': { input: 1.25, output: 3.75, cachedInput: 0.25 },
    'qwen3.7-plus': { input: 0.32, output: 1.28, cachedInput: 0.064 },
    'qwen3.6-plus': { input: 0.4, output: 1.2, cachedInput: 0.08 },
    'qwen3.6-flash': { input: 0.05, output: 0.4, cachedInput: 0.01 },
    'qwen3.5-plus': { input: 0.4, output: 1.2, cachedInput: 0.08 },
    'qwen3-coder-plus': { input: 1, output: 5, cachedInput: 0.2 },
    'qwen3-coder-next': { input: 1, output: 5, cachedInput: 0.2 },
    'qwen3-max': { input: 1.2, output: 6, cachedInput: 0.24 },
  },
}

function lookupInMap(map: ProviderPricingMap | undefined, model: string): ModelPricing | null {
  if (!map) return null
  if (map[model]) return map[model]

  const modelLower = model.toLowerCase()
  let bestMatch: ModelPricing | undefined
  let bestLen = 0
  for (const key of Object.keys(map)) {
    if (modelLower.startsWith(key.toLowerCase()) && key.length > bestLen) {
      bestMatch = map[key]
      bestLen = key.length
    }
  }
  return bestMatch ?? null
}

/**
 * Look up pricing for a provider + model.
 * User overrides win (exact, then prefix). Built-in table is next.
 * Returns null when the model is not in the table — caller must show tokens only.
 */
export function getModelPricing(
  provider: string,
  model: string,
  overrides?: PricingOverrides
): ModelPricing | null {
  if (!provider || !model) return null
  const overrideMap = overrides?.[provider]
  const fromOverride = lookupInMap(overrideMap, model)
  if (fromOverride) return fromOverride
  return lookupInMap(BUILTIN_PRICING[provider], model)
}

export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens: number,
  pricing: ModelPricing
): { costWithoutCache: number; actualCost: number; savings: number } {
  const perToken = 1_000_000
  const costWithoutCache = (inputTokens / perToken) * pricing.input + (outputTokens / perToken) * pricing.output
  const nonCachedInput = Math.max(0, inputTokens - cachedInputTokens)
  const actualCost =
    (nonCachedInput / perToken) * pricing.input +
    (cachedInputTokens / perToken) * pricing.cachedInput +
    (outputTokens / perToken) * pricing.output
  const savings = Math.max(0, costWithoutCache - actualCost)
  return { costWithoutCache, actualCost, savings }
}

/** Honest estimate: known price → $, otherwise tokens only (cost 0, knownPrice false). */
export function estimateUsageCost(
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens: number,
  pricing: ModelPricing | null
): EstimatedCost {
  if (!pricing) {
    return { costWithoutCache: 0, actualCost: 0, savings: 0, knownPrice: false }
  }
  return { ...calculateCost(inputTokens, outputTokens, cachedInputTokens, pricing), knownPrice: true }
}

export type PriceTableRow = {
  providerId: string
  providerLabel: string
  modelId: string
  pricing: ModelPricing
  source: 'builtin' | 'override'
}

export function listPriceTableRows(overrides?: PricingOverrides): PriceTableRow[] {
  const rows: PriceTableRow[] = []
  const seen = new Set<string>()

  const add = (providerId: string, modelId: string, pricing: ModelPricing, source: PriceTableRow['source']) => {
    const key = `${providerId}\0${modelId}`
    if (seen.has(key)) return
    seen.add(key)
    rows.push({
      providerId,
      providerLabel: SPEND_PRICE_PROVIDER_LABELS[providerId] ?? providerId,
      modelId,
      pricing,
      source,
    })
  }

  for (const [providerId, map] of Object.entries(BUILTIN_PRICING)) {
    for (const [modelId, pricing] of Object.entries(map)) {
      const over = overrides?.[providerId]?.[modelId]
      add(providerId, modelId, over ?? pricing, over ? 'override' : 'builtin')
    }
  }
  for (const [providerId, map] of Object.entries(overrides ?? {})) {
    for (const [modelId, pricing] of Object.entries(map)) {
      add(providerId, modelId, pricing, 'override')
    }
  }

  rows.sort((a, b) => {
    const pa = SPEND_PRICE_PROVIDERS.indexOf(a.providerId as SpendPriceProviderId)
    const pb = SPEND_PRICE_PROVIDERS.indexOf(b.providerId as SpendPriceProviderId)
    const oa = pa === -1 ? 99 : pa
    const ob = pb === -1 ? 99 : pb
    if (oa !== ob) return oa - ob
    return a.modelId.localeCompare(b.modelId)
  })
  return rows
}

export function upsertPricingOverride(
  overrides: PricingOverrides | undefined,
  providerId: string,
  modelId: string,
  pricing: ModelPricing
): PricingOverrides {
  const next: PricingOverrides = { ...overrides }
  next[providerId] = { ...next[providerId], [modelId]: pricing }
  return next
}

export function removePricingOverride(
  overrides: PricingOverrides | undefined,
  providerId: string,
  modelId: string
): PricingOverrides | undefined {
  if (!overrides?.[providerId]?.[modelId]) return overrides
  const { [modelId]: _, ...restModels } = overrides[providerId]
  const next = { ...overrides }
  if (Object.keys(restModels).length === 0) {
    delete next[providerId]
  } else {
    next[providerId] = restModels
  }
  return Object.keys(next).length === 0 ? undefined : next
}
