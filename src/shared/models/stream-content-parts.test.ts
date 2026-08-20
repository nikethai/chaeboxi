import { describe, expect, it } from 'vitest'
import type { MessageContentParts } from '../types'
import {
  applyReasoningDelta,
  applyTextDelta,
  finalizeReasoningDuration,
  flushPendingStreamText,
  resolveStreamResultText,
  type StreamContentCursor,
} from './stream-content-parts'

function emptyCursor(parts: MessageContentParts = []): StreamContentCursor {
  return {
    contentParts: parts,
    currentTextPart: undefined,
    currentReasoningPart: undefined,
    pendingTextWhitespace: '',
  }
}

describe('stream-content-parts', () => {
  it('does not end reasoning on whitespace-only text-delta', () => {
    let cursor = emptyCursor()
    cursor = applyReasoningDelta(cursor, 'thinking', 1000)
    cursor = applyTextDelta(cursor, '\n\n', 1100)

    expect(cursor.contentParts).toHaveLength(1)
    expect(cursor.contentParts[0]).toMatchObject({ type: 'reasoning', text: 'thinking' })
    expect(cursor.currentReasoningPart?.duration).toBeUndefined()
    expect(cursor.pendingTextWhitespace).toBe('\n\n')
    expect(cursor.currentTextPart).toBeUndefined()
  })

  it('atomically opens answer with buffered whitespace + readable text', () => {
    let cursor = emptyCursor()
    cursor = applyReasoningDelta(cursor, 'thinking', 1000)
    cursor = applyTextDelta(cursor, '\n', 1100)
    cursor = applyTextDelta(cursor, 'Answer', 1500)

    expect(cursor.contentParts).toHaveLength(2)
    expect(cursor.contentParts[0]).toMatchObject({
      type: 'reasoning',
      text: 'thinking',
      duration: 500,
    })
    expect(cursor.contentParts[1]).toMatchObject({ type: 'text', text: '\nAnswer' })
    expect(cursor.pendingTextWhitespace).toBe('')
    expect(cursor.currentReasoningPart).toBeUndefined()
  })

  it('appends whitespace after answer has started', () => {
    let cursor = emptyCursor()
    cursor = applyTextDelta(cursor, 'Hi', 1000)
    cursor = applyTextDelta(cursor, '\n\n', 1100)
    expect(cursor.contentParts[0]).toMatchObject({ type: 'text', text: 'Hi\n\n' })
  })

  it('preserves leading whitespace-only text-only streams until readable text', () => {
    let cursor = emptyCursor()
    cursor = applyTextDelta(cursor, '  ', 1000)
    expect(cursor.contentParts).toHaveLength(0)
    expect(cursor.pendingTextWhitespace).toBe('  ')
    cursor = applyTextDelta(cursor, 'Hello', 1100)
    expect(cursor.contentParts[0]).toMatchObject({ type: 'text', text: '  Hello' })
  })

  it('flushes pending whitespace and reasoning duration at stream end', () => {
    let cursor = emptyCursor()
    cursor = applyReasoningDelta(cursor, 'r', 1000)
    cursor = applyTextDelta(cursor, '\n', 1100)
    cursor = flushPendingStreamText(cursor, 2000)

    expect(cursor.contentParts[0]).toMatchObject({ type: 'reasoning', text: 'r', duration: 1000 })
    expect(cursor.contentParts[1]).toMatchObject({ type: 'text', text: '\n' })
    expect(cursor.pendingTextWhitespace).toBe('')
  })

  it('finalizeReasoningDuration is idempotent', () => {
    const part = { type: 'reasoning' as const, text: 'x', startTime: 1000, duration: 42 }
    finalizeReasoningDuration(part, 9999)
    expect(part.duration).toBe(42)
  })

  it('falls back to aggregated provider text when stream parts have no answer', () => {
    expect(resolveStreamResultText([], 'Recovered answer')).toBe('Recovered answer')
    expect(
      resolveStreamResultText(
        [
          {
            type: 'tool-call',
            state: 'result',
            toolCallId: 't1',
            toolName: 'web_search',
            args: {},
            result: {},
          },
        ],
        'Recovered after tools'
      )
    ).toBe('Recovered after tools')
    expect(resolveStreamResultText([{ type: 'text', text: 'Streamed' }], 'Ignored aggregate')).toBe('Streamed')
  })
})
