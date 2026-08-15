import type { LocalUsageSnapshot, UsagePeriod } from '@shared/providers/usage'
import { useEffect, useState } from 'react'
import { aggregateByProviderModel, type ProviderModelSpend } from '../local-rollup'
import { providerUsageService } from '../service'

export function useLocalSpend(period: UsagePeriod): {
  snapshot: LocalUsageSnapshot
  byProviderModel: ProviderModelSpend[]
} {
  const [version, setVersion] = useState(0)

  useEffect(() => {
    void providerUsageService.init()
    return providerUsageService.subscribe(() => {
      setVersion((n) => n + 1)
    })
  }, [])

  void version
  const snapshot = providerUsageService.getLocalSnapshot(period)
  const byProviderModel = aggregateByProviderModel(providerUsageService.getRollup().rows, { period })
  return { snapshot, byProviderModel }
}
