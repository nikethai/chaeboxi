/**
 * Cost Calculator
 *
 * Pricing lookup table and cost calculation logic per provider/model.
 * Prices are in USD per 1M tokens.
 */

import type { ModelPricing, ProviderPricingMap } from './types'

// ============================================================================
// Pricing Tables (USD per 1M tokens)
// ============================================================================

/**
 * Provider pricing maps keyed by provider ID.
 * Model keys use prefix matching — the first match wins.
 * A '_default' key serves as fallback for unknown models within a provider.
 */
const PRICING: Record<string, ProviderPricingMap> = {
  openai: {
    'gpt-4o-mini': { input: 0.15, output: 0.6, cachedInput: 0.075 },
    'gpt-4o': { input: 2.5, output: 10, cachedInput: 1.25 },
    'gpt-4-turbo': { input: 10, output: 30, cachedInput: 5 },
    'o1-mini': { input: 3, output: 12, cachedInput: 1.5 },
    'o1-pro': { input: 150, output: 600, cachedInput: 75 },
    o1: { input: 15, output: 60, cachedInput: 7.5 },
    o3: { input: 10, output: 40, cachedInput: 2.5 },
    'o3-mini': { input: 1.1, output: 4.4, cachedInput: 0.55 },
    'o4-mini': { input: 1.1, output: 4.4, cachedInput: 0.55 },
    _default: { input: 2.5, output: 10, cachedInput: 1.25 },
  },
  'openai-responses': {
    'gpt-4o-mini': { input: 0.15, output: 0.6, cachedInput: 0.075 },
    'gpt-4o': { input: 2.5, output: 10, cachedInput: 1.25 },
    o3: { input: 10, output: 40, cachedInput: 2.5 },
    'o3-mini': { input: 1.1, output: 4.4, cachedInput: 0.55 },
    'o4-mini': { input: 1.1, output: 4.4, cachedInput: 0.55 },
    _default: { input: 2.5, output: 10, cachedInput: 1.25 },
  },
  claude: {
    'claude-3-5-sonnet': { input: 3, output: 15, cachedInput: 0.3 },
    'claude-3-5-haiku': { input: 0.8, output: 4, cachedInput: 0.08 },
    'claude-3-opus': { input: 15, output: 75, cachedInput: 1.5 },
    'claude-3-haiku': { input: 0.25, output: 1.25, cachedInput: 0.03 },
    'claude-3-sonnet': { input: 3, output: 15, cachedInput: 0.3 },
    'claude-sonnet-4': { input: 3, output: 15, cachedInput: 0.3 },
    'claude-opus-4': { input: 15, output: 75, cachedInput: 1.5 },
    _default: { input: 3, output: 15, cachedInput: 0.3 },
  },
  gemini: {
    'gemini-2.0-flash': { input: 0.1, output: 0.4, cachedInput: 0.025 },
    'gemini-2.5-flash': { input: 0.15, output: 0.6, cachedInput: 0.0375 },
    'gemini-2.5-pro': { input: 1.25, output: 10, cachedInput: 0.3125 },
    'gemini-1.5-flash': { input: 0.075, output: 0.3, cachedInput: 0.01875 },
    'gemini-1.5-pro': { input: 1.25, output: 5, cachedInput: 0.3125 },
    _default: { input: 0.15, output: 0.6, cachedInput: 0.0375 },
  },
  deepseek: {
    'deepseek-chat': { input: 0.27, output: 1.1, cachedInput: 0.07 },
    'deepseek-reasoner': { input: 0.55, output: 2.19, cachedInput: 0.14 },
    _default: { input: 0.27, output: 1.1, cachedInput: 0.07 },
  },
  groq: {
    'llama-3.3-70b': { input: 0.59, output: 0.79, cachedInput: 0.3 },
    'llama-3.1-8b': { input: 0.05, output: 0.08, cachedInput: 0.025 },
    'mixtral-8x7b': { input: 0.24, output: 0.24, cachedInput: 0.12 },
    _default: { input: 0.59, output: 0.79, cachedInput: 0.3 },
  },
  perplexity: {
    _default: { input: 1, output: 1, cachedInput: 0.5 },
  },
  'mistral-ai': {
    'mistral-large': { input: 2, output: 6, cachedInput: 1 },
    'mistral-small': { input: 0.1, output: 0.3, cachedInput: 0.05 },
    codestral: { input: 0.3, output: 0.9, cachedInput: 0.15 },
    _default: { input: 2, output: 6, cachedInput: 1 },
  },
  xAI: {
    'grok-3': { input: 3, output: 15, cachedInput: 0.75 },
    'grok-3-mini': { input: 0.3, output: 0.5, cachedInput: 0.075 },
    'grok-2': { input: 2, output: 10, cachedInput: 1 },
    _default: { input: 3, output: 15, cachedInput: 0.75 },
  },
}

/**
 * Generic fallback pricing used when no provider/model match is found.
 */
const FALLBACK_PRICING: ModelPricing = {
  input: 1,
  output: 3,
  cachedInput: 0.5,
}

// ============================================================================
// Lookup Logic
// ============================================================================

/**
 * Look up pricing for a provider + model combination.
 * Uses prefix matching on model name within the provider pricing map.
 */
export function getModelPricing(provider: string, model: string): ModelPricing {
  const providerMap = PRICING[provider]
  if (!providerMap) {
    return FALLBACK_PRICING
  }

  // Exact match first
  if (providerMap[model]) {
    return providerMap[model]
  }

  // Prefix match (longest prefix wins)
  const modelLower = model.toLowerCase()
  let bestMatch: ModelPricing | undefined
  let bestLen = 0

  for (const key of Object.keys(providerMap)) {
    if (key === '_default') continue
    if (modelLower.startsWith(key.toLowerCase()) && key.length > bestLen) {
      bestMatch = providerMap[key]
      bestLen = key.length
    }
  }

  return bestMatch ?? providerMap._default ?? FALLBACK_PRICING
}

// ============================================================================
// Cost Calculation
// ============================================================================

/**
 * Calculate cost for a given token breakdown using the provided pricing.
 *
 * @param inputTokens - Total input tokens (including cached)
 * @param outputTokens - Total output tokens
 * @param cachedInputTokens - Number of input tokens served from cache
 * @param pricing - Per-million-token pricing
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens: number,
  pricing: ModelPricing
): { costWithoutCache: number; actualCost: number; savings: number } {
  const perToken = 1_000_000

  // Cost if no caching existed (all input charged at full price)
  const costWithoutCache = (inputTokens / perToken) * pricing.input + (outputTokens / perToken) * pricing.output

  // Actual cost: non-cached input at full price, cached input at cached price
  const nonCachedInput = Math.max(0, inputTokens - cachedInputTokens)
  const actualCost =
    (nonCachedInput / perToken) * pricing.input +
    (cachedInputTokens / perToken) * pricing.cachedInput +
    (outputTokens / perToken) * pricing.output

  const savings = Math.max(0, costWithoutCache - actualCost)

  return { costWithoutCache, actualCost, savings }
}
