import type { Message } from '@shared/types/session'
import { describe, expect, it } from 'vitest'
import { aggregateSessionCosts, formatCost } from '../aggregator'

function createAssistantMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: `msg-${Math.random().toString(36).slice(2, 8)}`,
    role: 'assistant',
    contentParts: [{ type: 'text', text: 'Response' }],
    aiProvider: 'openai',
    model: 'gpt-4o',
    usage: {
      inputTokens: 1000,
      outputTokens: 500,
      cachedInputTokens: 400,
    },
    ...overrides,
  }
}

function createUserMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: `msg-${Math.random().toString(36).slice(2, 8)}`,
    role: 'user',
    contentParts: [{ type: 'text', text: 'Question' }],
    ...overrides,
  }
}

describe('aggregateSessionCosts', () => {
  it('returns zeroed metrics for empty messages', () => {
    const result = aggregateSessionCosts([])
    expect(result.totalInputTokens).toBe(0)
    expect(result.totalOutputTokens).toBe(0)
    expect(result.totalCachedInputTokens).toBe(0)
    expect(result.cacheHitRate).toBe(0)
    expect(result.messagesWithUsage).toBe(0)
  })

  it('skips user messages', () => {
    const messages = [createUserMessage()]
    const result = aggregateSessionCosts(messages)
    expect(result.messagesWithUsage).toBe(0)
  })

  it('skips assistant messages without usage', () => {
    const messages = [createAssistantMessage({ usage: undefined })]
    const result = aggregateSessionCosts(messages)
    expect(result.messagesWithUsage).toBe(0)
  })

  it('aggregates single assistant message correctly', () => {
    const messages = [
      createAssistantMessage({
        aiProvider: 'claude',
        model: 'claude-3-5-sonnet-20241022',
        usage: {
          inputTokens: 10000,
          outputTokens: 2000,
          cachedInputTokens: 8000,
        },
      }),
    ]
    const result = aggregateSessionCosts(messages)
    expect(result.totalInputTokens).toBe(10000)
    expect(result.totalOutputTokens).toBe(2000)
    expect(result.totalCachedInputTokens).toBe(8000)
    expect(result.cacheHitRate).toBeCloseTo(0.8, 2)
    expect(result.messagesWithUsage).toBe(1)
    expect(result.actualCost).toBeLessThan(result.costWithoutCache)
    expect(result.totalSavings).toBeGreaterThan(0)
    expect(result.savingsPercent).toBeGreaterThan(0)
  })

  it('aggregates multiple providers separately', () => {
    const messages = [
      createAssistantMessage({
        aiProvider: 'openai',
        model: 'gpt-4o',
        usage: { inputTokens: 5000, outputTokens: 1000, cachedInputTokens: 2000 },
      }),
      createAssistantMessage({
        aiProvider: 'claude',
        model: 'claude-3-5-sonnet-20241022',
        usage: { inputTokens: 5000, outputTokens: 1000, cachedInputTokens: 3000 },
      }),
    ]
    const result = aggregateSessionCosts(messages)
    expect(result.messagesWithUsage).toBe(2)
    expect(Object.keys(result.byProvider)).toHaveLength(2)
    expect(result.byProvider.openai).toBeDefined()
    expect(result.byProvider.claude).toBeDefined()
    expect(result.byProvider.openai.inputTokens).toBe(5000)
    expect(result.byProvider.claude.cachedInputTokens).toBe(3000)
  })

  it('computes cache hit rate per provider', () => {
    const messages = [
      createAssistantMessage({
        aiProvider: 'openai',
        model: 'gpt-4o',
        usage: { inputTokens: 1000, outputTokens: 100, cachedInputTokens: 500 },
      }),
    ]
    const result = aggregateSessionCosts(messages)
    expect(result.byProvider.openai.cacheHitRate).toBeCloseTo(0.5, 2)
  })

  it('handles messages with zero tokens', () => {
    const messages = [
      createAssistantMessage({
        usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 },
      }),
    ]
    const result = aggregateSessionCosts(messages)
    expect(result.messagesWithUsage).toBe(0)
  })
})

describe('formatCost', () => {
  it('formats zero', () => {
    expect(formatCost(0)).toBe('$0.00')
  })

  it('formats very small amounts', () => {
    expect(formatCost(0.0001)).toBe('<$0.001')
  })

  it('formats small amounts', () => {
    expect(formatCost(0.005)).toBe('$0.0050')
  })

  it('formats sub-dollar amounts', () => {
    expect(formatCost(0.123)).toBe('$0.123')
  })

  it('formats dollar amounts', () => {
    expect(formatCost(1.5)).toBe('$1.50')
  })

  it('formats large amounts', () => {
    expect(formatCost(42.7)).toBe('$42.70')
  })
})
