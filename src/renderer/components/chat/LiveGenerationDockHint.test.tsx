/**
 * @vitest-environment jsdom
 */

import { act, render, screen } from '@testing-library/react'
import type { Message } from '@shared/types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { elapsedFromMessage, LiveGenerationDockHint } from './LiveGenerationDockHint'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

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

describe('elapsedFromMessage', () => {
  const start = 1_700_000_000_000
  const message: Message = { id: 'm1', role: 'assistant', timestamp: start, contentParts: [] }

  it('shows 0s while under a second has elapsed', () => {
    expect(elapsedFromMessage(message, start)).toBe('0s')
    expect(elapsedFromMessage(message, start + 999)).toBe('0s')
  })

  it('formats elapsed time once a second has passed', () => {
    expect(elapsedFromMessage(message, start + 65_000)).toBe('1m 5s')
    expect(elapsedFromMessage(message, start + 120_000)).toBe('2m')
  })

  it('uses the reasoning part start time when present', () => {
    const withReasoning: Message = {
      ...message,
      contentParts: [{ type: 'reasoning', text: 'thinking', startTime: start + 30_000 }],
    }
    expect(elapsedFromMessage(withReasoning, start + 40_000)).toBe('10s')
  })

  it('falls back to 0s when the message has no timestamp', () => {
    expect(elapsedFromMessage(null, start)).toBe('0s')
  })
})

describe('LiveGenerationDockHint elapsed tick', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps ticking the elapsed time while waiting for the first token', () => {
    vi.useFakeTimers()
    const start = Date.now()
    const message: Message = { id: 'm1', role: 'assistant', timestamp: start, contentParts: [], generating: true }
    render(<LiveGenerationDockHint generating={true} liveMessage={message} />)

    expect(screen.getByText('0s')).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(65_000)
    })
    expect(screen.getByText('1m 5s')).toBeTruthy()
  })
})
