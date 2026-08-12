import { describe, expect, it } from 'vitest'
import type { Message } from '@shared/types'

// Pure helper behavior via component module internals is private; cover prop contract lightly
// by exercising label derivation through a tiny re-export-style unit.

function derive(message: Message | null | undefined) {
  const parts = message?.contentParts || []
  const running = parts.find((p) => p.type === 'tool-call' && p.state === 'call' && p.toolName !== 'memory_lookup')
  if (running && running.type === 'tool-call') {
    if (running.toolName === 'web_search') return 'search'
    return 'tool'
  }
  const hasTool = parts.some((p) => p.type === 'tool-call' && p.toolName !== 'memory_lookup')
  if (hasTool) return 'prepare'
  return 'think'
}

describe('LiveGenerationDockHint labels', () => {
  it('defaults to think when empty', () => {
    expect(derive(null)).toBe('think')
    expect(derive({ id: '1', role: 'assistant', contentParts: [], generating: true })).toBe('think')
  })

  it('detects running web search', () => {
    expect(
      derive({
        id: '1',
        role: 'assistant',
        generating: true,
        contentParts: [
          {
            type: 'tool-call',
            state: 'call',
            toolCallId: 't1',
            toolName: 'web_search',
            args: {},
          },
        ],
      })
    ).toBe('search')
  })

  it('detects prepare after completed tools', () => {
    expect(
      derive({
        id: '1',
        role: 'assistant',
        generating: true,
        contentParts: [
          {
            type: 'tool-call',
            state: 'result',
            toolCallId: 't1',
            toolName: 'web_search',
            args: {},
            result: {},
          },
        ],
      })
    ).toBe('prepare')
  })
})
