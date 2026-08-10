import { describe, expect, it } from 'vitest'

function readCachedTokens(usage: unknown): number | undefined {
  if (!usage || typeof usage !== 'object') return undefined
  if ('cachedInputTokens' in usage && typeof usage.cachedInputTokens === 'number') return usage.cachedInputTokens
  if (
    'inputTokensDetails' in usage &&
    usage.inputTokensDetails &&
    typeof usage.inputTokensDetails === 'object' &&
    'cachedTokens' in usage.inputTokensDetails &&
    typeof usage.inputTokensDetails.cachedTokens === 'number'
  ) {
    return usage.inputTokensDetails.cachedTokens
  }
  if (
    'input_tokens_details' in usage &&
    usage.input_tokens_details &&
    typeof usage.input_tokens_details === 'object' &&
    'cached_tokens' in usage.input_tokens_details &&
    typeof usage.input_tokens_details.cached_tokens === 'number'
  ) {
    return usage.input_tokens_details.cached_tokens
  }
  return undefined
}

function readReasoningTokens(usage: unknown): number | undefined {
  if (!usage || typeof usage !== 'object') return undefined
  if ('reasoningTokens' in usage && typeof usage.reasoningTokens === 'number') return usage.reasoningTokens
  if (
    'outputTokensDetails' in usage &&
    usage.outputTokensDetails &&
    typeof usage.outputTokensDetails === 'object' &&
    'reasoningTokens' in usage.outputTokensDetails &&
    typeof usage.outputTokensDetails.reasoningTokens === 'number'
  ) {
    return usage.outputTokensDetails.reasoningTokens
  }
  if (
    'output_tokens_details' in usage &&
    usage.output_tokens_details &&
    typeof usage.output_tokens_details === 'object' &&
    'reasoning_tokens' in usage.output_tokens_details &&
    typeof usage.output_tokens_details.reasoning_tokens === 'number'
  ) {
    return usage.output_tokens_details.reasoning_tokens
  }
  return undefined
}

describe('usage normalization contract', () => {
  it('documents response-style cached token fields', () => {
    const usage = {
      inputTokens: 1200,
      outputTokens: 100,
      totalTokens: 1300,
      inputTokensDetails: { cachedTokens: 900 },
    }

    expect(readCachedTokens(usage)).toBe(900)
  })

  it('documents snake_case response-style cached token fields', () => {
    const usage = {
      inputTokens: 1200,
      outputTokens: 100,
      totalTokens: 1300,
      input_tokens_details: { cached_tokens: 750 },
    }

    expect(readCachedTokens(usage)).toBe(750)
  })

  it('documents response-style reasoning token fields', () => {
    const usage = {
      inputTokens: 1200,
      outputTokens: 100,
      totalTokens: 1300,
      outputTokensDetails: { reasoningTokens: 321 },
    }

    expect(readReasoningTokens(usage)).toBe(321)
  })
})
