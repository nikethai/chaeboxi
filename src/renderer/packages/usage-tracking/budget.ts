/**
 * Soft budget evaluation — warn only by default, never invent hard provider limits.
 */

import type {
  BudgetAlertLevel,
  BudgetEvaluation,
  BudgetNotifyState,
  LocalUsageSnapshot,
  UsageBudgetConfig,
  UsagePeriod,
} from '@shared/providers/usage'
import { totalTokens } from './local-rollup'

function clampPercent(used: number, limit?: number): number | null {
  if (limit == null || limit <= 0) return null
  return Math.min(999, (used / limit) * 100)
}

function levelFromPercent(
  percent: number | null,
  warnAt: number,
  criticalAt: number
): BudgetAlertLevel {
  if (percent == null) return 'ok'
  if (percent >= criticalAt) return 'critical'
  if (percent >= warnAt) return 'warn'
  return 'ok'
}

function maxLevel(a: BudgetAlertLevel, b: BudgetAlertLevel): BudgetAlertLevel {
  const order: BudgetAlertLevel[] = ['ok', 'warn', 'critical']
  return order[Math.max(order.indexOf(a), order.indexOf(b))]
}

export function evaluateBudget(opts: {
  config: UsageBudgetConfig
  globalLocal: LocalUsageSnapshot
  providerLocal?: LocalUsageSnapshot
  providerId?: string
}): BudgetEvaluation {
  const { config, globalLocal, providerLocal, providerId } = opts
  if (!config.enabled) {
    return {
      level: 'ok',
      scope: 'global',
      percent: 0,
      usedTokens: totalTokens(globalLocal),
      usedCostUsd: globalLocal.estimatedCostUsd,
      message: 'Budgets disabled',
    }
  }

  let best: BudgetEvaluation = {
    level: 'ok',
    scope: 'global',
    percent: 0,
    usedTokens: totalTokens(globalLocal),
    usedCostUsd: globalLocal.estimatedCostUsd,
    tokenLimit: config.tokenLimit,
    costLimitUsd: config.costLimitUsd,
    message: 'Within budget',
  }

  const consider = (
    scope: 'global' | 'provider',
    local: LocalUsageSnapshot,
    tokenLimit?: number,
    costLimitUsd?: number,
    pid?: string
  ) => {
    const tokens = totalTokens(local)
    const cost = local.estimatedCostUsd
    const tokenPct = clampPercent(tokens, tokenLimit)
    const costPct = clampPercent(cost, costLimitUsd)
    const pct = Math.max(tokenPct ?? 0, costPct ?? 0)
    const hasLimit = tokenLimit != null || costLimitUsd != null
    if (!hasLimit) return

    const level = levelFromPercent(
      tokenPct != null || costPct != null ? pct : null,
      config.warnAtPercent,
      config.criticalAtPercent
    )

    if (level === 'ok' && best.level !== 'ok') return
    if (
      level === 'ok' ||
      maxLevel(level, best.level) === level
    ) {
      const parts: string[] = []
      if (tokenPct != null && tokenLimit != null) {
        parts.push(`${Math.round(tokens).toLocaleString()} / ${tokenLimit.toLocaleString()} tokens`)
      }
      if (costPct != null && costLimitUsd != null) {
        parts.push(`$${cost.toFixed(2)} / $${costLimitUsd.toFixed(2)}`)
      }
      best = {
        level,
        scope,
        providerId: pid,
        percent: pct,
        usedTokens: tokens,
        usedCostUsd: cost,
        tokenLimit,
        costLimitUsd,
        message:
          level === 'critical'
            ? `Budget exceeded (${parts.join(', ')})`
            : level === 'warn'
              ? `Approaching budget (${parts.join(', ')})`
              : parts.join(', ') || 'Within budget',
      }
    }
  }

  consider('global', globalLocal, config.tokenLimit, config.costLimitUsd)

  if (providerId && providerLocal && config.perProvider?.[providerId]) {
    const override = config.perProvider[providerId]
    consider(
      'provider',
      providerLocal,
      override.tokenLimit,
      override.costLimitUsd,
      providerId
    )
  }

  return best
}

export function notifyKey(period: UsagePeriod, scope: string, providerId?: string): string {
  const end = new Date()
  const periodKey =
    period === 'calendar-month'
      ? `${end.getFullYear()}-${end.getMonth() + 1}`
      : period
  return `${periodKey}:${scope}${providerId ? `:${providerId}` : ''}`
}

/**
 * Returns true if a toast/banner should fire for this evaluation (once per level per period).
 */
export function shouldNotifyBudget(
  state: BudgetNotifyState,
  evalResult: BudgetEvaluation,
  period: UsagePeriod
): { notify: boolean; nextState: BudgetNotifyState } {
  if (evalResult.level === 'ok') {
    return { notify: false, nextState: state }
  }
  const key = notifyKey(period, evalResult.scope, evalResult.providerId)
  const prev = state.lastNotified[key] ?? 'ok'
  const order: BudgetAlertLevel[] = ['ok', 'warn', 'critical']
  if (order.indexOf(evalResult.level) <= order.indexOf(prev)) {
    return { notify: false, nextState: state }
  }
  return {
    notify: true,
    nextState: {
      lastNotified: { ...state.lastNotified, [key]: evalResult.level },
    },
  }
}
