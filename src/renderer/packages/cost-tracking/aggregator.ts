/**
 * Cost Aggregator
 *
 * Aggregates prompt caching metrics across messages in a session,
 * producing per-session and per-provider cost breakdowns.
 * Unknown models contribute tokens only — never a fake dollar amount.
 */

import type { Message } from '@shared/types/session'
import { estimateUsageCost, getModelPricing } from './calculator'
import type { PricingOverrides, ProviderCostMetrics, SessionCostMetrics } from './types'

export function aggregateSessionCosts(
  messages: Message[],
  overrides?: PricingOverrides
): SessionCostMetrics {
  const byProvider: Record<string, ProviderCostMetrics> = {}

  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalCachedInputTokens = 0
  let totalReasoningTokens = 0
  let costWithoutCache = 0
  let actualCost = 0
  let messagesWithUsage = 0
  let hasKnownPrice = false
  let hasUnpricedTokens = false

  for (const msg of messages) {
    if (msg.role !== 'assistant' || !msg.usage) continue

    const input = msg.usage.inputTokens ?? 0
    const output = msg.usage.outputTokens ?? 0
    const cached = msg.usage.cachedInputTokens ?? 0
    const reasoning = msg.usage.reasoningTokens ?? 0

    if (input === 0 && output === 0) continue

    messagesWithUsage++

    const provider = String(msg.aiProvider ?? 'unknown')
    const model = msg.model ?? 'unknown'
    const pricing = getModelPricing(provider, model, overrides)
    const costs = estimateUsageCost(input, output, cached, pricing)
    if (costs.knownPrice) hasKnownPrice = true
    else hasUnpricedTokens = true

    totalInputTokens += input
    totalOutputTokens += output
    totalCachedInputTokens += cached
    totalReasoningTokens += reasoning
    costWithoutCache += costs.costWithoutCache
    actualCost += costs.actualCost

    if (!byProvider[provider]) {
      byProvider[provider] = {
        provider,
        inputTokens: 0,
        outputTokens: 0,
        cachedInputTokens: 0,
        cacheHitRate: 0,
        costWithoutCache: 0,
        actualCost: 0,
        savings: 0,
        hasKnownPrice: false,
      }
    }
    const p = byProvider[provider]
    p.inputTokens += input
    p.outputTokens += output
    p.cachedInputTokens += cached
    p.costWithoutCache += costs.costWithoutCache
    p.actualCost += costs.actualCost
    p.savings += costs.savings
    if (costs.knownPrice) p.hasKnownPrice = true
  }

  for (const p of Object.values(byProvider)) {
    p.cacheHitRate = p.inputTokens > 0 ? p.cachedInputTokens / p.inputTokens : 0
  }

  const totalSavings = Math.max(0, costWithoutCache - actualCost)
  const cacheHitRate = totalInputTokens > 0 ? totalCachedInputTokens / totalInputTokens : 0
  const savingsPercent = costWithoutCache > 0 ? (totalSavings / costWithoutCache) * 100 : 0

  return {
    totalInputTokens,
    totalOutputTokens,
    totalCachedInputTokens,
    totalReasoningTokens,
    cacheHitRate,
    tokensSaved: totalCachedInputTokens,
    costWithoutCache,
    actualCost,
    totalSavings,
    savingsPercent,
    hasKnownPrice,
    hasUnpricedTokens,
    byProvider,
    messagesWithUsage,
  }
}

/**
 * Format a USD cost value for display.
 * Uses appropriate precision based on magnitude.
 */
export function formatCost(usd: number): string {
  if (usd === 0) return '$0.00'
  if (usd < 0.001) return `<$0.001`
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  if (usd < 1) return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(2)}`
}

/** Show $ only when a known price produced a number; otherwise tokens-only label. */
export function formatSpendOrTokens(opts: {
  estimatedCostUsd: number
  knownPrice?: boolean
  tokens: number
  tokensLabel?: string
}): string {
  const known = opts.knownPrice ?? opts.estimatedCostUsd > 0
  if (known && opts.estimatedCostUsd > 0) return formatCost(opts.estimatedCostUsd)
  if (known && opts.estimatedCostUsd === 0) return formatCost(0)
  return `${opts.tokens.toLocaleString()} ${opts.tokensLabel ?? 'tokens'}`
}
