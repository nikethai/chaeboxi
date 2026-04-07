/**
 * Cost Tracking Module
 *
 * Aggregate and display prompt caching metrics (hit rate, tokens saved, cost savings per provider).
 */

// ============================================================================
// Types
// ============================================================================

export type {
  ModelPricing,
  ProviderCostMetrics,
  SessionCostMetrics,
} from './types'

// ============================================================================
// Calculator
// ============================================================================

export { calculateCost, getModelPricing } from './calculator'

// ============================================================================
// Aggregator
// ============================================================================

export { aggregateSessionCosts, formatCost } from './aggregator'
