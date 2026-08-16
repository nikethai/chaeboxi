/**
 * Local usage rollup — day × provider × model aggregation.
 * Pure functions for unit testing.
 */

import type {
  DayRollupRow,
  LocalUsageEvent,
  LocalUsageSnapshot,
  UsagePeriod,
} from '@shared/providers/usage'
import { EMPTY_LOCAL_USAGE } from '@shared/providers/usage'

/** Format Date as YYYY-MM-DD in local timezone */
export function dayKey(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseDayKey(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

/** Inclusive start day (YYYY-MM-DD) for a period ending at `end` (default today) */
export function periodStartDay(period: UsagePeriod, end: Date = new Date()): string {
  if (period === 'today') {
    return dayKey(end)
  }
  if (period === 'calendar-month') {
    return dayKey(new Date(end.getFullYear(), end.getMonth(), 1))
  }
  const days = period === '7d' ? 6 : 29 // inclusive window
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - days)
  return dayKey(start)
}

export function isDayInPeriod(day: string, period: UsagePeriod, end: Date = new Date()): boolean {
  const start = periodStartDay(period, end)
  const endDay = dayKey(end)
  return day >= start && day <= endDay
}

export function upsertRollupRow(rows: DayRollupRow[], event: LocalUsageEvent): DayRollupRow[] {
  const day = dayKey(new Date(event.at))
  const idx = rows.findIndex(
    (r) => r.day === day && r.providerId === event.providerId && r.modelId === event.modelId
  )
  if (idx < 0) {
    return [
      ...rows,
      {
        day,
        providerId: event.providerId,
        modelId: event.modelId,
        inputTokens: event.inputTokens,
        outputTokens: event.outputTokens,
        cachedInputTokens: event.cachedInputTokens,
        reasoningTokens: event.reasoningTokens,
        estimatedCostUsd: event.estimatedCostUsd,
        messageCount: 1,
      },
    ]
  }
  const prev = rows[idx]
  const next = [...rows]
  next[idx] = {
    ...prev,
    inputTokens: prev.inputTokens + event.inputTokens,
    outputTokens: prev.outputTokens + event.outputTokens,
    cachedInputTokens: prev.cachedInputTokens + event.cachedInputTokens,
    reasoningTokens: prev.reasoningTokens + event.reasoningTokens,
    estimatedCostUsd: prev.estimatedCostUsd + event.estimatedCostUsd,
    messageCount: prev.messageCount + 1,
  }
  return next
}

export function aggregateRows(
  rows: DayRollupRow[],
  opts: {
    period: UsagePeriod
    providerId?: string
    end?: Date
  }
): LocalUsageSnapshot {
  const end = opts.end ?? new Date()
  const snapshot = EMPTY_LOCAL_USAGE(opts.period)
  const byModel = new Map<
    string,
    { modelId: string; inputTokens: number; outputTokens: number; estimatedCostUsd: number }
  >()

  for (const row of rows) {
    if (opts.providerId && row.providerId !== opts.providerId) continue
    if (!isDayInPeriod(row.day, opts.period, end)) continue

    snapshot.inputTokens += row.inputTokens
    snapshot.outputTokens += row.outputTokens
    snapshot.cachedInputTokens += row.cachedInputTokens
    snapshot.reasoningTokens += row.reasoningTokens
    snapshot.estimatedCostUsd += row.estimatedCostUsd
    snapshot.messageCount += row.messageCount

    const existing = byModel.get(row.modelId)
    if (existing) {
      existing.inputTokens += row.inputTokens
      existing.outputTokens += row.outputTokens
      existing.estimatedCostUsd += row.estimatedCostUsd
    } else {
      byModel.set(row.modelId, {
        modelId: row.modelId,
        inputTokens: row.inputTokens,
        outputTokens: row.outputTokens,
        estimatedCostUsd: row.estimatedCostUsd,
      })
    }
  }

  snapshot.byModel = Array.from(byModel.values()).sort(
    (a, b) => b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens)
  )
  return snapshot
}

export function totalTokens(snapshot: LocalUsageSnapshot): number {
  return snapshot.inputTokens + snapshot.outputTokens
}

export type ProviderModelSpend = {
  providerId: string
  modelId: string
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number
  reasoningTokens: number
  estimatedCostUsd: number
  messageCount: number
}

/** Day rollup → provider × model rows for a period (airplane-mode safe). */
export function aggregateByProviderModel(
  rows: DayRollupRow[],
  opts: { period: UsagePeriod; end?: Date }
): ProviderModelSpend[] {
  const end = opts.end ?? new Date()
  const map = new Map<string, ProviderModelSpend>()
  for (const row of rows) {
    if (!isDayInPeriod(row.day, opts.period, end)) continue
    const key = `${row.providerId}\0${row.modelId}`
    const existing = map.get(key)
    if (existing) {
      existing.inputTokens += row.inputTokens
      existing.outputTokens += row.outputTokens
      existing.cachedInputTokens += row.cachedInputTokens
      existing.reasoningTokens += row.reasoningTokens
      existing.estimatedCostUsd += row.estimatedCostUsd
      existing.messageCount += row.messageCount
    } else {
      map.set(key, {
        providerId: row.providerId,
        modelId: row.modelId,
        inputTokens: row.inputTokens,
        outputTokens: row.outputTokens,
        cachedInputTokens: row.cachedInputTokens,
        reasoningTokens: row.reasoningTokens,
        estimatedCostUsd: row.estimatedCostUsd,
        messageCount: row.messageCount,
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    if (b.estimatedCostUsd !== a.estimatedCostUsd) return b.estimatedCostUsd - a.estimatedCostUsd
    return b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens)
  })
}
