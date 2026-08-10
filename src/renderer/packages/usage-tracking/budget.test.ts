import { describe, expect, it } from 'vitest'
import type { LocalUsageSnapshot, UsageBudgetConfig } from '@shared/providers/usage'
import { EMPTY_LOCAL_USAGE } from '@shared/providers/usage'
import { evaluateBudget, shouldNotifyBudget } from './budget'

function local(partial: Partial<LocalUsageSnapshot> = {}): LocalUsageSnapshot {
  return { ...EMPTY_LOCAL_USAGE('30d'), ...partial }
}

describe('evaluateBudget', () => {
  const baseConfig: UsageBudgetConfig = {
    enabled: true,
    period: '30d',
    tokenLimit: 1000,
    warnAtPercent: 80,
    criticalAtPercent: 100,
    pauseWhenExceeded: false,
  }

  it('returns ok when disabled', () => {
    const r = evaluateBudget({
      config: { ...baseConfig, enabled: false },
      globalLocal: local({ inputTokens: 9999, outputTokens: 0 }),
    })
    expect(r.level).toBe('ok')
  })

  it('warns at threshold', () => {
    const r = evaluateBudget({
      config: baseConfig,
      globalLocal: local({ inputTokens: 800, outputTokens: 0 }),
    })
    expect(r.level).toBe('warn')
    expect(r.percent).toBe(80)
  })

  it('critical at or above 100%', () => {
    const r = evaluateBudget({
      config: baseConfig,
      globalLocal: local({ inputTokens: 1000, outputTokens: 0 }),
    })
    expect(r.level).toBe('critical')
  })

  it('uses cost limit', () => {
    const r = evaluateBudget({
      config: { ...baseConfig, tokenLimit: undefined, costLimitUsd: 1 },
      globalLocal: local({ estimatedCostUsd: 0.9 }),
    })
    expect(r.level).toBe('warn')
  })

  it('notifies only once per level per period', () => {
    const evalResult = evaluateBudget({
      config: baseConfig,
      globalLocal: local({ inputTokens: 900, outputTokens: 0 }),
    })
    const first = shouldNotifyBudget({ lastNotified: {} }, evalResult, '30d')
    expect(first.notify).toBe(true)
    const second = shouldNotifyBudget(first.nextState, evalResult, '30d')
    expect(second.notify).toBe(false)
  })
})
