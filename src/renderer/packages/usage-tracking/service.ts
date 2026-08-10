/**
 * ProviderUsageService — facade for plan/usage status, local rollup, budgets.
 */

import {
  classifyQuotaError,
  DEFAULT_USAGE_BUDGET,
  EMPTY_LOCAL_USAGE,
  exhaustedQuota,
  findQuotaAdapter,
  type LocalUsageEvent,
  type LocalUsageRollupStore,
  type LocalUsageSnapshot,
  type ProviderQuotaSnapshot,
  type ProviderUsageStatus,
  type QuotaCacheStore,
  type UsageBudgetConfig,
  type UsagePeriod,
  USAGE_ROLLUP_VERSION,
} from '@shared/providers/usage'
import type { Message, ProviderBaseInfo, ProviderSettings, Settings } from '@shared/types'
import { calculateCost, getModelPricing } from '@/packages/cost-tracking'
import { hasProviderCredentials, isProviderListedInSettings } from '@shared/providers/provider-credentials'
import { getSystemProviders } from '@shared/providers/registry'
import storage, { StorageKey } from '@/storage'
import { ensureQuotaAdaptersRegistered } from './adapters'
import { evaluateBudget, shouldNotifyBudget } from './budget'
import {
  aggregateRows,
  dayKey,
  totalTokens,
  upsertRollupRow,
} from './local-rollup'
import {
  emptyBudgetNotify,
  emptyQuotaCache,
  emptyRollupStore,
  loadBudgetNotify,
  loadQuotaCache,
  loadRollupStore,
  saveBudgetNotify,
  saveQuotaCache,
  saveRollupStore,
  saveRollupStoreNow,
} from './local-store'

const QUOTA_TTL_MS = 10 * 60 * 1000

type Listener = () => void

class ProviderUsageServiceImpl {
  private rollup: LocalUsageRollupStore = emptyRollupStore()
  private quotaCache: QuotaCacheStore = emptyQuotaCache()
  private ready = false
  private initPromise: Promise<void> | null = null
  private listeners = new Set<Listener>()
  private backfillRunning = false

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit() {
    for (const l of this.listeners) l()
  }

  async init(): Promise<void> {
    if (this.ready) return
    if (this.initPromise) return this.initPromise
    this.initPromise = (async () => {
      ensureQuotaAdaptersRegistered()
      this.rollup = await loadRollupStore()
      this.quotaCache = await loadQuotaCache()
      this.ready = true
      this.emit()
    })()
    return this.initPromise
  }

  isReady(): boolean {
    return this.ready
  }

  getRollup(): LocalUsageRollupStore {
    return this.rollup
  }

  getBudgetConfig(settings: Settings): UsageBudgetConfig {
    return settings.usageBudget ?? DEFAULT_USAGE_BUDGET
  }

  getLocalSnapshot(period: UsagePeriod, providerId?: string): LocalUsageSnapshot {
    return aggregateRows(this.rollup.rows, { period, providerId })
  }

  async recordLocalUsage(event: LocalUsageEvent): Promise<void> {
    await this.init()
    this.rollup = {
      ...this.rollup,
      rows: upsertRollupRow(this.rollup.rows, event),
    }
    await saveRollupStore(this.rollup)
    this.emit()
  }

  /**
   * Record usage from a completed assistant message.
   */
  async recordFromMessage(msg: Message): Promise<void> {
    if (msg.role !== 'assistant' || !msg.usage) return
    const providerId = String(msg.aiProvider ?? '')
    const modelId = msg.model ?? 'unknown'
    if (!providerId) return

    const input = msg.usage.inputTokens ?? 0
    const output = msg.usage.outputTokens ?? 0
    const cached = msg.usage.cachedInputTokens ?? 0
    const reasoning = msg.usage.reasoningTokens ?? 0
    if (input === 0 && output === 0) return

    const pricing = getModelPricing(providerId, modelId)
    const costs = calculateCost(input, output, cached, pricing)

    await this.recordLocalUsage({
      providerId,
      modelId,
      inputTokens: input,
      outputTokens: output,
      cachedInputTokens: cached,
      reasoningTokens: reasoning,
      estimatedCostUsd: costs.actualCost,
      at: msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now(),
    })
  }

  async markExhausted(
    providerId: string,
    meta?: { modelId?: string; detail?: string; message?: string; responseBody?: string; status?: number; errorCode?: number }
  ): Promise<void> {
    await this.init()
    const classified = classifyQuotaError({
      message: meta?.message,
      responseBody: meta?.responseBody,
      status: meta?.status,
      errorCode: meta?.errorCode,
    })

    // Only mark exhausted for quota errors (or explicit detail)
    if (classified.kind !== 'exhausted' && !meta?.detail) return

    const quota = exhaustedQuota({
      modelId: meta?.modelId,
      detail: meta?.detail ?? classified.detail,
    })
    this.quotaCache = {
      entries: {
        ...this.quotaCache.entries,
        [providerId]: {
          providerId,
          quota,
          plan: this.quotaCache.entries[providerId]?.plan,
          fetchedAt: Date.now(),
        },
      },
    }
    await saveQuotaCache(this.quotaCache)
    this.emit()
  }

  async clearExhausted(providerId: string): Promise<void> {
    await this.init()
    const entry = this.quotaCache.entries[providerId]
    if (!entry || entry.quota.state !== 'exhausted') return
    const { [providerId]: _, ...rest } = this.quotaCache.entries
    this.quotaCache = { entries: rest }
    await saveQuotaCache(this.quotaCache)
    this.emit()
  }

  async handleGenerationError(opts: {
    providerId: string
    modelId?: string
    message?: string
    responseBody?: string
    errorCode?: number
  }): Promise<'exhausted' | 'rate_limit' | 'none'> {
    const classified = classifyQuotaError({
      message: opts.message,
      responseBody: opts.responseBody,
      errorCode: opts.errorCode,
    })
    if (classified.kind === 'exhausted') {
      await this.markExhausted(opts.providerId, {
        modelId: opts.modelId,
        message: opts.message,
        responseBody: opts.responseBody,
        errorCode: opts.errorCode,
        detail: classified.detail,
      })
    }
    return classified.kind
  }

  listConfiguredProviders(settings: Settings): Array<{ id: string; name: string; settings: ProviderSettings }> {
    const system = getSystemProviders()
    const custom = settings.customProviders ?? []
    const all: ProviderBaseInfo[] = [...system, ...custom]
    const result: Array<{ id: string; name: string; settings: ProviderSettings }> = []

    for (const base of all) {
      if (base.id === 'chatbox-ai') continue // CE: strip first-party license surface
      const ps = settings.providers?.[base.id]
      if (!isProviderListedInSettings(base, ps) && !hasProviderCredentials(ps)) continue
      result.push({
        id: base.id,
        name: base.name,
        settings: ps ?? {},
      })
    }
    // Also include any providers with credentials that may not be "listed" yet
    for (const [id, ps] of Object.entries(settings.providers ?? {})) {
      if (result.some((r) => r.id === id)) continue
      if (id === 'chatbox-ai') continue
      if (!hasProviderCredentials(ps)) continue
      const base = all.find((p) => p.id === id)
      result.push({ id, name: base?.name ?? id, settings: ps })
    }
    return result
  }

  async getStatus(
    providerId: string,
    settings: Settings,
    opts?: {
      period?: UsagePeriod
      forceRefresh?: boolean
      providerName?: string
      providerSettings?: ProviderSettings
      catalogHints?: Array<{ modelId: string; exhausted?: boolean; label?: string }>
      signal?: AbortSignal
    }
  ): Promise<ProviderUsageStatus> {
    await this.init()
    ensureQuotaAdaptersRegistered()

    const period = opts?.period ?? '30d'
    const providerSettings = opts?.providerSettings ?? settings.providers?.[providerId] ?? {}
    const adapter = findQuotaAdapter(providerId, providerSettings)
    const plan = adapter?.getPlan(providerSettings)
    const links = adapter?.getLinks(providerSettings) ?? {}
    const local = this.getLocalSnapshot(period, providerId)
    const connected = hasProviderCredentials(providerSettings)

    let quota: ProviderQuotaSnapshot
    const cached = this.quotaCache.entries[providerId]
    const cacheFresh =
      cached && !opts?.forceRefresh && Date.now() - cached.fetchedAt < QUOTA_TTL_MS

    // Exhausted from errors wins until cleared
    if (cached?.quota.state === 'exhausted' && !opts?.forceRefresh) {
      quota = cached.quota
    } else if (cacheFresh) {
      quota = cached.quota
    } else if (adapter) {
      try {
        quota = await adapter.fetchQuota({
          settings: providerSettings,
          signal: opts?.signal,
          catalogHints: opts?.catalogHints,
        })
      } catch (err) {
        quota = {
          state: 'error',
          source: 'none',
          updatedAt: Date.now(),
          errorMessage: err instanceof Error ? err.message : String(err),
          detail: 'Failed to fetch provider quota.',
        }
      }
      // Preserve exhausted if fetch returned unknown and we had exhausted
      if (
        quota.state === 'unknown' &&
        cached?.quota.state === 'exhausted' &&
        !opts?.forceRefresh
      ) {
        quota = cached.quota
      }
      this.quotaCache = {
        entries: {
          ...this.quotaCache.entries,
          [providerId]: {
            providerId,
            quota,
            plan,
            fetchedAt: Date.now(),
          },
        },
      }
      await saveQuotaCache(this.quotaCache)
    } else {
      quota = {
        state: 'unsupported',
        source: 'none',
        updatedAt: Date.now(),
      }
    }

    return {
      providerId,
      providerName: opts?.providerName ?? providerId,
      connected,
      plan: plan ?? cached?.plan,
      quota,
      local,
      links: {
        ...links,
        settingsPath: `/settings/provider/${providerId}`,
      },
    }
  }

  async getAllStatuses(
    settings: Settings,
    period: UsagePeriod = '30d',
    forceRefresh = false
  ): Promise<ProviderUsageStatus[]> {
    const providers = this.listConfiguredProviders(settings)
    const results = await Promise.all(
      providers.map((p) =>
        this.getStatus(p.id, settings, {
          period,
          forceRefresh,
          providerName: p.name,
          providerSettings: p.settings,
        })
      )
    )
    return results
  }

  async evaluateAndMaybeNotify(
    settings: Settings,
    providerId?: string
  ): Promise<{ level: string; message: string; shouldToast: boolean } | null> {
    await this.init()
    const config = this.getBudgetConfig(settings)
    if (!config.enabled) return null

    const period = config.period
    const globalLocal = this.getLocalSnapshot(period)
    const providerLocal = providerId ? this.getLocalSnapshot(period, providerId) : undefined
    const evalResult = evaluateBudget({
      config,
      globalLocal,
      providerLocal,
      providerId,
    })
    if (evalResult.level === 'ok') return null

    const notifyState = await loadBudgetNotify()
    const { notify, nextState } = shouldNotifyBudget(notifyState, evalResult, period)
    if (notify) {
      await saveBudgetNotify(nextState)
    }
    return {
      level: evalResult.level,
      message: evalResult.message,
      shouldToast: notify,
    }
  }

  /**
   * One-time / re-runnable backfill from session storage.
   */
  async backfillFromSessions(
    onProgress?: (progress: number) => void
  ): Promise<{ scanned: number; events: number }> {
    await this.init()
    if (this.backfillRunning) {
      return { scanned: 0, events: 0 }
    }
    this.backfillRunning = true
    let scanned = 0
    let events = 0
    try {
      const sessionList = await storage.getItem<{ id: string }[]>(StorageKey.ChatSessionsList, [])
      const total = sessionList.length || 1

      // Always rebuild from sessions for consistent backfill
      let rows: typeof this.rollup.rows = []

      for (const meta of sessionList) {
        scanned++
        try {
          const session = await storage.getItem<{
            messages?: Message[]
            threads?: Array<{ messages?: Message[] }>
          } | null>(`session:${meta.id}`, null)
          if (!session) continue

          const allMessages: Message[] = [...(session.messages ?? [])]
          for (const thread of session.threads ?? []) {
            if (thread.messages) allMessages.push(...thread.messages)
          }

          for (const msg of allMessages) {
            if (msg.role !== 'assistant' || !msg.usage) continue
            const providerId = String(msg.aiProvider ?? '')
            const modelId = msg.model ?? 'unknown'
            if (!providerId) continue
            const input = msg.usage.inputTokens ?? 0
            const output = msg.usage.outputTokens ?? 0
            const cached = msg.usage.cachedInputTokens ?? 0
            const reasoning = msg.usage.reasoningTokens ?? 0
            if (input === 0 && output === 0) continue
            const pricing = getModelPricing(providerId, modelId)
            const costs = calculateCost(input, output, cached, pricing)
            const at = msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now()
            rows = upsertRollupRow(rows, {
              providerId,
              modelId,
              inputTokens: input,
              outputTokens: output,
              cachedInputTokens: cached,
              reasoningTokens: reasoning,
              estimatedCostUsd: costs.actualCost,
              at,
            })
            events++
          }
        } catch {
          // skip broken session
        }
        onProgress?.(Math.min(1, scanned / total))
        this.rollup = {
          version: USAGE_ROLLUP_VERSION,
          rows,
          backfillComplete: false,
          backfillProgress: scanned / total,
        }
        // Do not emit per-session — listeners would re-enter load/backfill and thrash React
      }

      this.rollup = {
        version: USAGE_ROLLUP_VERSION,
        rows,
        backfillComplete: true,
        backfillProgress: 1,
        lastBackfillAt: Date.now(),
      }
      await saveRollupStoreNow(this.rollup)
      this.emit()
      return { scanned, events }
    } finally {
      this.backfillRunning = false
    }
  }

  isBackfillComplete(): boolean {
    return this.rollup.backfillComplete
  }

  getQuotaSnapshot(providerId: string): ProviderQuotaSnapshot | undefined {
    return this.quotaCache.entries[providerId]?.quota
  }

  totalLocalTokens(period: UsagePeriod, providerId?: string): number {
    return totalTokens(this.getLocalSnapshot(period, providerId))
  }

  /** Debug / tests */
  _resetForTests() {
    this.rollup = emptyRollupStore()
    this.quotaCache = emptyQuotaCache()
    this.ready = false
    this.initPromise = null
  }
}

export const providerUsageService = new ProviderUsageServiceImpl()

export { dayKey, totalTokens, evaluateBudget }
