import type { MessageContentParts } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { buildVisibleAnswerContinuePrompt, mergeContinuedContentParts } from './tool-only-continue'

describe('tool-only-continue', () => {
  it('includes tool results in the continue prompt', () => {
    const parts: MessageContentParts = [
      {
        type: 'tool-call',
        state: 'result',
        toolCallId: 't1',
        toolName: 'web_search',
        args: { query: 'dc-down' },
        result: { query: 'dc-down', searchResults: [] },
      },
    ]
    const prompt = buildVisibleAnswerContinuePrompt(parts)
    expect(prompt).toContain('did not write a user-visible reply')
    expect(prompt).toContain('web_search')
    expect(prompt).toContain('dc-down')
  })

  it('drops host memory_lookup from the continued parts', () => {
    const first: MessageContentParts = [
      {
        type: 'tool-call',
        state: 'result',
        toolCallId: 't1',
        toolName: 'web_search',
        args: {},
        result: {},
      },
    ]
    const continued: MessageContentParts = [
      {
        type: 'tool-call',
        state: 'result',
        toolCallId: 'm2',
        toolName: 'memory_lookup',
        args: {},
        result: {},
      },
      { type: 'text', text: 'Use docker compose down -p, not docker -p.' },
    ]
    expect(mergeContinuedContentParts(first, continued)).toEqual([
      first[0],
      { type: 'text', text: 'Use docker compose down -p, not docker -p.' },
    ])
  })
})
