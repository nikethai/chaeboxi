import { describe, expect, it } from 'vitest'
import {
  aggregateRows,
  dayKey,
  isDayInPeriod,
  periodStartDay,
  upsertRollupRow,
} from './local-rollup'

describe('local-rollup', () => {
  it('upserts rows by day×provider×model', () => {
    const at = new Date(2026, 0, 15, 12).getTime()
    let rows = upsertRollupRow([], {
      providerId: 'openai',
      modelId: 'gpt-4o',
      inputTokens: 100,
      outputTokens: 50,
      cachedInputTokens: 10,
      reasoningTokens: 0,
      estimatedCostUsd: 0.01,
      at,
    })
    rows = upsertRollupRow(rows, {
      providerId: 'openai',
      modelId: 'gpt-4o',
      inputTokens: 50,
      outputTokens: 25,
      cachedInputTokens: 0,
      reasoningTokens: 0,
      estimatedCostUsd: 0.005,
      at,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].inputTokens).toBe(150)
    expect(rows[0].outputTokens).toBe(75)
    expect(rows[0].messageCount).toBe(2)
  })

  it('aggregates by period and provider', () => {
    const end = new Date(2026, 0, 20)
    const rows = [
      {
        day: '2026-01-18',
        providerId: 'openai',
        modelId: 'gpt-4o',
        inputTokens: 100,
        outputTokens: 20,
        cachedInputTokens: 0,
        reasoningTokens: 0,
        estimatedCostUsd: 0.02,
        messageCount: 1,
      },
      {
        day: '2026-01-10',
        providerId: 'openai',
        modelId: 'gpt-4o',
        inputTokens: 999,
        outputTokens: 0,
        cachedInputTokens: 0,
        reasoningTokens: 0,
        estimatedCostUsd: 1,
        messageCount: 1,
      },
      {
        day: '2026-01-19',
        providerId: 'qwen',
        modelId: 'qwen3',
        inputTokens: 30,
        outputTokens: 10,
        cachedInputTokens: 0,
        reasoningTokens: 0,
        estimatedCostUsd: 0.001,
        messageCount: 1,
      },
    ]

    const snap7 = aggregateRows(rows, { period: '7d', providerId: 'openai', end })
    // Jan 10 is outside 7d window ending Jan 20 (start = Jan 14)
    expect(snap7.inputTokens).toBe(100)
    expect(snap7.messageCount).toBe(1)

    const snapAll = aggregateRows(rows, { period: '30d', end })
    expect(snapAll.inputTokens).toBe(100 + 999 + 30)
  })

  it('period windows include today', () => {
    const end = new Date(2026, 5, 10)
    expect(periodStartDay('7d', end)).toBe('2026-06-04')
    expect(periodStartDay('calendar-month', end)).toBe('2026-06-01')
    expect(isDayInPeriod(dayKey(end), '7d', end)).toBe(true)
  })
})
