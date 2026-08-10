import type { ProviderSettings } from '../../types'
import type { ProviderPlanInfo, ProviderQuotaSnapshot } from './types'

export type ProviderQuotaFetchContext = {
  settings: ProviderSettings
  signal?: AbortSignal
  /** Optional pre-fetched model catalog flags (e.g. Gemini Antigravity) */
  catalogHints?: Array<{ modelId: string; exhausted?: boolean; label?: string }>
}

/**
 * Best-effort provider quota adapter.
 * Must never throw for offline/failure — return unknown|error snapshots instead.
 */
export interface ProviderQuotaAdapter {
  id: string
  supports(providerId: string, settings: ProviderSettings): boolean
  getPlan(settings: ProviderSettings): ProviderPlanInfo | undefined
  fetchQuota(ctx: ProviderQuotaFetchContext): Promise<ProviderQuotaSnapshot>
  getLinks(settings: ProviderSettings): { dashboardUrl?: string; docsUrl?: string }
}

const adapters: ProviderQuotaAdapter[] = []

export function registerQuotaAdapter(adapter: ProviderQuotaAdapter): void {
  const idx = adapters.findIndex((a) => a.id === adapter.id)
  if (idx >= 0) {
    adapters[idx] = adapter
  } else {
    adapters.push(adapter)
  }
}

export function clearQuotaAdapters(): void {
  adapters.length = 0
}

export function getQuotaAdapters(): readonly ProviderQuotaAdapter[] {
  return adapters
}

export function findQuotaAdapter(
  providerId: string,
  settings: ProviderSettings
): ProviderQuotaAdapter | undefined {
  // Prefer specialized adapters over default
  for (const adapter of adapters) {
    if (adapter.id === 'default') continue
    if (adapter.supports(providerId, settings)) return adapter
  }
  return adapters.find((a) => a.id === 'default')
}
