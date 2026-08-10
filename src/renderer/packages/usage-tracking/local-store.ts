/**
 * Persist local usage rollup, quota cache, and budget notify state.
 */

import type {
  BudgetNotifyState,
  LocalUsageRollupStore,
  QuotaCacheStore,
  USAGE_ROLLUP_VERSION as RollupVersionType,
} from '@shared/providers/usage'
import { USAGE_ROLLUP_VERSION } from '@shared/providers/usage'
import storage, { StorageKey } from '@/storage'

export const emptyRollupStore = (): LocalUsageRollupStore => ({
  version: USAGE_ROLLUP_VERSION,
  rows: [],
  backfillComplete: false,
})

export const emptyQuotaCache = (): QuotaCacheStore => ({ entries: {} })

export const emptyBudgetNotify = (): BudgetNotifyState => ({ lastNotified: {} })

export async function loadRollupStore(): Promise<LocalUsageRollupStore> {
  const data = await storage.getItem<LocalUsageRollupStore>(
    StorageKey.UsageRollup,
    emptyRollupStore()
  )
  if (!data || typeof data !== 'object') return emptyRollupStore()
  if (data.version !== USAGE_ROLLUP_VERSION) {
    return { ...emptyRollupStore(), version: USAGE_ROLLUP_VERSION as typeof RollupVersionType }
  }
  return {
    version: data.version ?? USAGE_ROLLUP_VERSION,
    rows: Array.isArray(data.rows) ? data.rows : [],
    backfillComplete: Boolean(data.backfillComplete),
    backfillProgress: data.backfillProgress,
    lastBackfillAt: data.lastBackfillAt,
  }
}

export async function saveRollupStore(store: LocalUsageRollupStore): Promise<void> {
  await storage.setItem(StorageKey.UsageRollup, store)
}

export async function saveRollupStoreNow(store: LocalUsageRollupStore): Promise<void> {
  await storage.setItemNow(StorageKey.UsageRollup, store)
}

export async function loadQuotaCache(): Promise<QuotaCacheStore> {
  const data = await storage.getItem<QuotaCacheStore>(StorageKey.UsageQuotaCache, emptyQuotaCache())
  if (!data || typeof data !== 'object' || !data.entries) return emptyQuotaCache()
  return { entries: data.entries }
}

export async function saveQuotaCache(store: QuotaCacheStore): Promise<void> {
  await storage.setItem(StorageKey.UsageQuotaCache, store)
}

export async function loadBudgetNotify(): Promise<BudgetNotifyState> {
  const data = await storage.getItem<BudgetNotifyState>(
    StorageKey.UsageBudgetNotify,
    emptyBudgetNotify()
  )
  if (!data || typeof data !== 'object') return emptyBudgetNotify()
  return { lastNotified: data.lastNotified ?? {} }
}

export async function saveBudgetNotify(state: BudgetNotifyState): Promise<void> {
  await storage.setItemNow(StorageKey.UsageBudgetNotify, state)
}
