/**
 * Pure: turn a completed assistant message into a local usage event.
 * Unknown models record tokens with $0 (no fake price).
 */

import type { LocalUsageEvent } from '@shared/providers/usage'
import type { Message } from '@shared/types'
import { estimateUsageCost, getModelPricing, type PricingOverrides } from '@/packages/cost-tracking'

export function usageEventFromMessage(
  msg: Message,
  overrides?: PricingOverrides
): LocalUsageEvent | null {
  if (msg.role !== 'assistant' || !msg.usage) return null
  const providerId = String(msg.aiProvider ?? '')
  const modelId = msg.model ?? 'unknown'
  if (!providerId) return null

  const input = msg.usage.inputTokens ?? 0
  const output = msg.usage.outputTokens ?? 0
  const cached = msg.usage.cachedInputTokens ?? 0
  const reasoning = msg.usage.reasoningTokens ?? 0
  if (input === 0 && output === 0) return null

  const pricing = getModelPricing(providerId, modelId, overrides)
  const costs = estimateUsageCost(input, output, cached, pricing)

  return {
    providerId,
    modelId,
    inputTokens: input,
    outputTokens: output,
    cachedInputTokens: cached,
    reasoningTokens: reasoning,
    estimatedCostUsd: costs.knownPrice ? costs.actualCost : 0,
    at: msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now(),
  }
}
