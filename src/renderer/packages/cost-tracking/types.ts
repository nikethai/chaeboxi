/**
 * Cost Tracking Types
 *
 * Types for prompt caching cost analysis, pricing lookup, and aggregated metrics.
 */

// ============================================================================
// Pricing Types
// ============================================================================

/**
 * Per-million-token pricing for a model.
 * All values are in USD per 1M tokens.
 */
export interface ModelPricing {
  /** Cost per 1M input tokens */
  input: number
  /** Cost per 1M output tokens */
  output: number
  /** Cost per 1M cached input tokens (prompt caching discount) */
  cachedInput: number
}

/**
 * Provider-level pricing map: model name pattern -> pricing
 */
export type ProviderPricingMap = Record<string, ModelPricing>

// ============================================================================
// Cost Metric Types
// ============================================================================

/**
 * Aggregated cost metrics for a session
 */
export interface SessionCostMetrics {
  /** Total input tokens across all messages */
  totalInputTokens: number
  /** Total output tokens across all messages */
  totalOutputTokens: number
  /** Total cached input tokens across all messages */
  totalCachedInputTokens: number
  /** Total reasoning tokens across all messages */
  totalReasoningTokens: number
  /** Cache hit rate (cachedInputTokens / totalInputTokens) as 0-1 */
  cacheHitRate: number
  /** Total tokens saved by caching */
  tokensSaved: number
  /** Estimated total cost without caching */
  costWithoutCache: number
  /** Estimated actual cost (with cache discount) */
  actualCost: number
  /** Total savings from caching */
  totalSavings: number
  /** Savings percentage (0-100) */
  savingsPercent: number
  /** Per-provider breakdown */
  byProvider: Record<string, ProviderCostMetrics>
  /** Number of assistant messages with usage data */
  messagesWithUsage: number
}

/**
 * Cost metrics grouped by provider
 */
export interface ProviderCostMetrics {
  /** Provider display name */
  provider: string
  /** Total input tokens for this provider */
  inputTokens: number
  /** Total output tokens for this provider */
  outputTokens: number
  /** Total cached input tokens for this provider */
  cachedInputTokens: number
  /** Cache hit rate for this provider */
  cacheHitRate: number
  /** Estimated cost without caching */
  costWithoutCache: number
  /** Estimated actual cost */
  actualCost: number
  /** Savings from caching */
  savings: number
}
