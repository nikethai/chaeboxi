/**
 * Cost Tracking Module
 *
 * Local spend estimates from a built-in editable price table.
 * Missing models stay tokens-only — never a fake dollar amount.
 */

export type {
  EstimatedCost,
  ModelPricing,
  PricedCost,
  PricingOverrides,
  ProviderCostMetrics,
  SessionCostMetrics,
  UnpricedCost,
} from './types'

export {
  BUILTIN_PRICING,
  SPEND_PRICE_PROVIDER_LABELS,
  SPEND_PRICE_PROVIDERS,
  calculateCost,
  estimateUsageCost,
  getModelPricing,
  listPriceTableRows,
  removePricingOverride,
  upsertPricingOverride,
} from './calculator'
export type { PriceTableRow, SpendPriceProviderId } from './calculator'

export { aggregateSessionCosts, formatCost, formatSpendOrTokens } from './aggregator'
