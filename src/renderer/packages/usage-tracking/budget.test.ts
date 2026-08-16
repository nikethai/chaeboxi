import { describe, expect, it } from 'vitest'
import type { LocalUsageSnapshot, UsageBudgetConfig } from '@shared/providers/usage'
import { EMPTY_LOCAL_USAGE } from '@shared/providers/usage'
import { evaluateBudget, shouldHardStopSend, shouldNotifyBudget } from './budget'

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

  it('uses a per-provider monthly cap', () => {
    const r = evaluateBudget({
      config: {
        ...baseConfig,
        tokenLimit: undefined,
        costLimitUsd: 100,
        perProvider: { deepseek: { costLimitUsd: 1 } },
      },
      globalLocal: local({ estimatedCostUsd: 0.2 }),
      providerLocal: local({ estimatedCostUsd: 0.9 }),
      providerId: 'deepseek',
    })
    expect(r.level).toBe('warn')
    expect(r.scope).toBe('provider')
    expect(r.providerId).toBe('deepseek')
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

describe('shouldHardStopSend', () => {
  const baseConfig: UsageBudgetConfig = {
    enabled: true,
    period: 'calendar-month',
    costLimitUsd: 1,
    warnAtPercent: 80,
    criticalAtPercent: 100,
    pauseWhenExceeded: true,
  }

  it('hard-stop blocks send when over cap and opt-in is on', () => {
    const evalResult = evaluateBudget({
      config: baseConfig,
      globalLocal: local({ estimatedCostUsd: 1.2 }),
    })
    expect(evalResult.level).toBe('critical')
    expect(shouldHardStopSend(baseConfig, evalResult)).toBe(true)
  })

  it('does not block send at 80% warn', () => {
    const evalResult = evaluateBudget({
      config: baseConfig,
      globalLocal: local({ estimatedCostUsd: 0.8 }),
    })
    expect(evalResult.level).toBe('warn')
    expect(shouldHardStopSend(baseConfig, evalResult)).toBe(false)
  })

  it('does not block send when hard-stop is off', () => {
    const evalResult = evaluateBudget({
      config: { ...baseConfig, pauseWhenExceeded: false },
      globalLocal: local({ estimatedCostUsd: 2 }),
    })
    expect(evalResult.level).toBe('critical')
    expect(shouldHardStopSend({ ...baseConfig, pauseWhenExceeded: false }, evalResult)).toBe(false)
  })
})
