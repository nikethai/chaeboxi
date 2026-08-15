/**
 * Provider plan usage status — shared contracts.
 * Dual honesty model: provider quota (best-effort) vs local in-app usage.
 */

export type UsagePeriod = 'today' | '7d' | '30d' | 'calendar-month'

export type LocalUsageSnapshot = {
  period: UsagePeriod
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number
  reasoningTokens: number
  estimatedCostUsd: number
  messageCount: number
  byModel: Array<{
    modelId: string
    inputTokens: number
    outputTokens: number
    estimatedCostUsd: number
  }>
}

export type QuotaState = 'known' | 'partial' | 'unknown' | 'exhausted' | 'unsupported' | 'error'

export type QuotaUnit = 'tokens' | 'requests' | 'credits' | 'percent' | 'messages' | 'custom'

export type ProviderQuotaSnapshot = {
  state: QuotaState
  used?: number
  limit?: number
  unit?: QuotaUnit
  resetsAt?: string
  models?: Array<{ modelId: string; exhausted?: boolean; label?: string }>
  detail?: string
  source: 'provider-api' | 'response-headers' | 'model-catalog' | 'inferred-error' | 'none'
  updatedAt: number
  errorMessage?: string
}

export type ProviderPlanInfo = {
  label: string
  planId?: string
  region?: string
  authMode: 'oauth' | 'api_key' | 'none'
  accountHint?: string
}

export type ProviderUsageStatus = {
  providerId: string
  providerName: string
  connected: boolean
  plan?: ProviderPlanInfo
  quota: ProviderQuotaSnapshot
  local: LocalUsageSnapshot
  links?: { dashboardUrl?: string; docsUrl?: string; settingsPath: string }
}

export type UsageBudgetConfig = {
  enabled: boolean
  period: UsagePeriod
  tokenLimit?: number
  costLimitUsd?: number
  perProvider?: Record<string, { tokenLimit?: number; costLimitUsd?: number }>
  warnAtPercent: number
  criticalAtPercent: number
  /** When true, generation should be paused after critical budget (user opt-in) */
  pauseWhenExceeded: boolean
}

export type LocalUsageEvent = {
  providerId: string
  modelId: string
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number
  reasoningTokens: number
  estimatedCostUsd: number
  at: number
}

export type DayRollupRow = {
  day: string // YYYY-MM-DD
  providerId: string
  modelId: string
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number
  reasoningTokens: number
  estimatedCostUsd: number
  messageCount: number
}

export type LocalUsageRollupStore = {
  version: number
  rows: DayRollupRow[]
  backfillComplete: boolean
  backfillProgress?: number
  lastBackfillAt?: number
}

export type QuotaCacheEntry = {
  providerId: string
  quota: ProviderQuotaSnapshot
  plan?: ProviderPlanInfo
  fetchedAt: number
}

export type QuotaCacheStore = {
  entries: Record<string, QuotaCacheEntry>
}

export type BudgetAlertLevel = 'ok' | 'warn' | 'critical'

export type BudgetEvaluation = {
  level: BudgetAlertLevel
  scope: 'global' | 'provider'
  providerId?: string
  percent: number
  usedTokens: number
  usedCostUsd: number
  tokenLimit?: number
  costLimitUsd?: number
  message: string
}

export type BudgetNotifyState = {
  /** period key → last notified level */
  lastNotified: Record<string, BudgetAlertLevel>
}

export const USAGE_ROLLUP_VERSION = 1

export const DEFAULT_USAGE_BUDGET: UsageBudgetConfig = {
  enabled: false,
  period: 'calendar-month',
  warnAtPercent: 80,
  criticalAtPercent: 100,
  pauseWhenExceeded: false,
}

export const EMPTY_LOCAL_USAGE = (period: UsagePeriod): LocalUsageSnapshot => ({
  period,
  inputTokens: 0,
  outputTokens: 0,
  cachedInputTokens: 0,
  reasoningTokens: 0,
  estimatedCostUsd: 0,
  messageCount: 0,
  byModel: [],
})

export const unsupportedQuota = (): ProviderQuotaSnapshot => ({
  state: 'unsupported',
  source: 'none',
  updatedAt: Date.now(),
  detail: 'Subscription quota is not available for this provider.',
})

export const unknownQuota = (detail?: string): ProviderQuotaSnapshot => ({
  state: 'unknown',
  source: 'none',
  updatedAt: Date.now(),
  detail: detail ?? 'Remaining provider quota is not exposed by this plan.',
})

export const exhaustedQuota = (opts?: {
  modelId?: string
  detail?: string
  source?: ProviderQuotaSnapshot['source']
}): ProviderQuotaSnapshot => ({
  state: 'exhausted',
  source: opts?.source ?? 'inferred-error',
  updatedAt: Date.now(),
  detail: opts?.detail ?? 'Provider reported quota exhausted.',
  models: opts?.modelId ? [{ modelId: opts.modelId, exhausted: true }] : undefined,
})
