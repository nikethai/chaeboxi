import { describe, expect, it } from 'vitest'
import type { Message } from '@shared/types'
import { usageEventFromMessage } from './usage-event'
import { upsertRollupRow } from './local-rollup'

function assistant(partial: Partial<Message> = {}): Message {
  return {
    id: 'm1',
    role: 'assistant',
    contentParts: [{ type: 'text', text: 'ok' }],
    aiProvider: 'deepseek',
    model: 'deepseek-chat',
    timestamp: new Date(2026, 7, 15, 12).getTime(),
    usage: {
      inputTokens: 100_000,
      outputTokens: 50_000,
      cachedInputTokens: 0,
    },
    ...partial,
  }
}

describe('usageEventFromMessage / rollup write', () => {
  it('writes a rollup row with non-zero $ from known DeepSeek price', () => {
    const event = usageEventFromMessage(assistant())
    expect(event).not.toBeNull()
    expect(event!.providerId).toBe('deepseek')
    expect(event!.modelId).toBe('deepseek-chat')
    expect(event!.estimatedCostUsd).toBeCloseTo(0.082, 6)
    expect(event!.estimatedCostUsd).toBeGreaterThan(0)

    const rows = upsertRollupRow([], event!)
    expect(rows).toHaveLength(1)
    expect(rows[0].day).toBe('2026-08-15')
    expect(rows[0].estimatedCostUsd).toBeCloseTo(0.082, 6)
    expect(rows[0].messageCount).toBe(1)
  })

  it('missing model = tokens only (no fake $)', () => {
    const event = usageEventFromMessage(
      assistant({
        aiProvider: 'ollama',
        model: 'llama3.2',
      })
    )
    expect(event).not.toBeNull()
    expect(event!.inputTokens).toBe(100_000)
    expect(event!.outputTokens).toBe(50_000)
    expect(event!.estimatedCostUsd).toBe(0)
  })

  it('skips messages without usage', () => {
    expect(usageEventFromMessage(assistant({ usage: undefined }))).toBeNull()
  })
})
