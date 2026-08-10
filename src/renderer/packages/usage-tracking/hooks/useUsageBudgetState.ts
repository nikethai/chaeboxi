import type { BudgetEvaluation, UsagePeriod } from '@shared/providers/usage'
import { DEFAULT_USAGE_BUDGET } from '@shared/providers/usage'
import { useEffect, useState } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'
import { evaluateBudget } from '../budget'
import { providerUsageService } from '../service'

export function useUsageBudgetState(providerId?: string, periodOverride?: UsagePeriod): BudgetEvaluation {
  const usageBudget = useSettingsStore((s) => s.usageBudget)
  const config = usageBudget ?? DEFAULT_USAGE_BUDGET
  const period = periodOverride ?? config.period
  // Version counter — only bumps when the service emits (local usage / quota cache)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    void providerUsageService.init()
    return providerUsageService.subscribe(() => {
      setVersion((n) => n + 1)
    })
  }, [])

  // Recompute from service snapshots when version / config / provider changes
  void version
  const globalLocal = providerUsageService.getLocalSnapshot(period)
  const providerLocal = providerId
    ? providerUsageService.getLocalSnapshot(period, providerId)
    : undefined
  return evaluateBudget({
    config,
    globalLocal,
    providerLocal,
    providerId,
  })
}
