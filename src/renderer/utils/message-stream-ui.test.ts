import type { MessageContentParts } from '@shared/types'
import { describe, expect, it } from 'vitest'
import {
  buildEmptyCompletionError,
  contentPartsRevision,
  findLastWorkIndex,
  groupAssistantContentParts,
  hasReadableTrailingAnswer,
  hasVisibleAssistantReply,
  isReadableAnswerPart,
  isWorkActive,
  shouldContinueForVisibleAnswer,
  shouldShowAssistantPending,
  withFallbackAnswerParts,
} from './message-stream-ui'

describe('message-stream-ui', () => {
  it('keeps work active through trailing whitespace text while generating', () => {
    const parts: MessageContentParts = [
      { type: 'reasoning', text: 'thinking hard', startTime: 1, duration: 100 },
      { type: 'text', text: '\n\n' },
    ]
    expect(hasReadableTrailingAnswer(parts, 0)).toBe(false)
    expect(isWorkActive({ generating: true, contentParts: parts })).toBe(true)
    expect(isWorkActive({ generating: false, contentParts: parts })).toBe(false)
  })

  it('keeps thinking-group while generating even after first readable answer', () => {
    const parts: MessageContentParts = [{ type: 'text', text: 'Hello' }]
    const groups = groupAssistantContentParts(parts, true)
    expect(groups.filter((g) => g.type === 'thinking-group')).toHaveLength(1)
    expect(groups.some((g) => g.type === 'single' && g.part.type === 'text')).toBe(true)
    const strip = groups.find((g) => g.type === 'thinking-group')
    expect(strip?.type === 'thinking-group' && strip.workActive).toBe(false)
  })

  it('drops empty thinking-group after generation ends with answer-only parts', () => {
    const parts: MessageContentParts = [{ type: 'text', text: 'Hello' }]
    const done = groupAssistantContentParts(parts, false)
    expect(done.filter((g) => g.type === 'thinking-group')).toHaveLength(0)
    expect(done.some((g) => g.type === 'single' && g.part.type === 'text')).toBe(true)
  })

  it('keeps empty thinking-group after settle when keepEmptyThinking is set', () => {
    const parts: MessageContentParts = [{ type: 'text', text: 'Hello' }]
    const done = groupAssistantContentParts(parts, false, { keepEmptyThinking: true })
    expect(done.filter((g) => g.type === 'thinking-group')).toHaveLength(1)
    expect(done.find((g) => g.type === 'thinking-group')?.workActive).toBe(false)
    expect(done.some((g) => g.type === 'single' && g.part.type === 'text' && g.part.text === 'Hello')).toBe(true)
  })

  it('keeps thinking-group for the whole live tool turn even after trailing answer', () => {
    const parts: MessageContentParts = [
      {
        type: 'tool-call',
        state: 'result',
        toolCallId: 't1',
        toolName: 'web_search',
        args: {},
        result: {},
      },
      { type: 'text', text: 'Need your location.' },
    ]
    const live = groupAssistantContentParts(parts, true)
    expect(live.filter((g) => g.type === 'thinking-group')).toHaveLength(1)
    expect(live.find((g) => g.type === 'thinking-group')?.workActive).toBe(false)
  })

  it('deactivates work on first readable trailing answer', () => {
    const parts: MessageContentParts = [
      { type: 'reasoning', text: 'thinking hard', startTime: 1, duration: 100 },
      { type: 'text', text: 'Hello' },
    ]
    expect(isWorkActive({ generating: true, contentParts: parts })).toBe(false)
  })

  it('groups work with workActive true when answer is only whitespace', () => {
    const parts: MessageContentParts = [
      { type: 'reasoning', text: 'plan', startTime: 1 },
      { type: 'text', text: '  ' },
    ]
    const groups = groupAssistantContentParts(parts, true)
    const strip = groups.find((g) => g.type === 'thinking-group')
    expect(strip?.type).toBe('thinking-group')
    if (strip?.type === 'thinking-group') {
      expect(strip.workActive).toBe(true)
    }
  })

  it('shows pending when work strip is unavailable (Android) and only reasoning exists', () => {
    const parts: MessageContentParts = [{ type: 'reasoning', text: 'thinking', startTime: 1 }]
    expect(
      shouldShowAssistantPending({
        message: { role: 'assistant', generating: true, status: [] },
        contentParts: parts,
        workStripAvailable: false,
      })
    ).toBe(true)
  })

  it('hides pending when work strip is active', () => {
    const parts: MessageContentParts = [{ type: 'reasoning', text: 'thinking', startTime: 1 }]
    expect(
      shouldShowAssistantPending({
        message: { role: 'assistant', generating: true, status: [] },
        contentParts: parts,
        workStripAvailable: true,
      })
    ).toBe(false)
  })

  it('does not treat tool calls as a readable answer', () => {
    expect(
      isReadableAnswerPart({
        type: 'tool-call',
        state: 'result',
        toolCallId: 't1',
        toolName: 'web_search',
        args: {},
        result: { ok: true },
      } as MessageContentParts[number])
    ).toBe(false)
    expect(isReadableAnswerPart({ type: 'text', text: 'London is 12°C' })).toBe(true)
  })

  it('groups empty generating assistant as a live thinking strip', () => {
    const groups = groupAssistantContentParts([], true)
    expect(groups[0]).toEqual({
      type: 'thinking-group',
      parts: [],
      monologueTexts: [],
      startIndex: 0,
      workActive: true,
    })
    expect(groups.some((g) => g.type === 'single' && g.part.type === 'text' && g.part.text === '')).toBe(true)
    expect(groupAssistantContentParts([], false)).toEqual([])
  })

  it('never dual-mounts pending when work strip is available (desktop)', () => {
    // Empty generating bubble still uses thinking-group, not AssistantPending.
    const parts: MessageContentParts = []
    expect(
      shouldShowAssistantPending({
        message: { role: 'assistant', generating: true, status: [] },
        contentParts: parts,
        workStripAvailable: true,
      })
    ).toBe(false)
    const groups = groupAssistantContentParts(parts, true)
    expect(groups.some((g) => g.type === 'thinking-group' && g.workActive)).toBe(true)
  })

  it('keeps stable thinking-group across empty reasoning and tool rounds', () => {
    const emptyReasoning: MessageContentParts = [{ type: 'reasoning', text: '', startTime: 1 }]
    const g1 = groupAssistantContentParts(emptyReasoning, true)
    expect(g1.filter((g) => g.type === 'thinking-group')).toHaveLength(1)

    const afterTool: MessageContentParts = [
      { type: 'reasoning', text: '', startTime: 1 },
      {
        type: 'tool-call',
        state: 'result',
        toolCallId: 't1',
        toolName: 'web_search',
        args: {},
        result: {},
      },
    ]
    const g2 = groupAssistantContentParts(afterTool, true)
    expect(g2.filter((g) => g.type === 'thinking-group')).toHaveLength(1)
    expect(g2.find((g) => g.type === 'thinking-group')?.workActive).toBe(true)
  })

  it('changes revision when text mutates in place without length change of array', () => {
    const parts: MessageContentParts = [{ type: 'text', text: 'Hi' }]
    const a = contentPartsRevision(parts)
    parts[0] = { type: 'text', text: 'Hello world' }
    const b = contentPartsRevision(parts)
    expect(a).not.toBe(b)
  })

  it('keeps work active between multi-step tools with no trailing answer', () => {
    const parts: MessageContentParts = [
      {
        type: 'tool-call',
        state: 'result',
        toolCallId: 't1',
        toolName: 'web_search',
        args: { query: 'weather' },
        result: { ok: true },
      },
    ]
    expect(isWorkActive({ generating: true, contentParts: parts })).toBe(true)
    const groups = groupAssistantContentParts(parts, true)
    const strip = groups.find((g) => g.type === 'thinking-group')
    expect(strip?.type === 'thinking-group' && strip.workActive).toBe(true)
  })

  it('does not promote mid-turn monologue while generating (multi-step gap)', () => {
    const parts: MessageContentParts = [
      { type: 'text', text: 'Let me search…' },
      {
        type: 'tool-call',
        state: 'result',
        toolCallId: 't1',
        toolName: 'web_search',
        args: {},
        result: {},
      },
    ]
    const live = groupAssistantContentParts(parts, true)
    const liveStrip = live.find((g) => g.type === 'thinking-group')
    expect(liveStrip?.type === 'thinking-group' && liveStrip.workActive).toBe(true)
    expect(liveStrip?.type === 'thinking-group' && liveStrip.monologueTexts).toEqual(['Let me search…'])
    // No promoted monologue as answer while generating (empty reserved slot is OK)
    expect(live.some((g) => g.type === 'single' && g.part.type === 'text' && Boolean(g.part.text?.trim()))).toBe(false)
  })

  it('promotes monologue only after generation ends with no trailing answer', () => {
    const parts: MessageContentParts = [
      { type: 'text', text: 'Let me search…' },
      {
        type: 'tool-call',
        state: 'result',
        toolCallId: 't1',
        toolName: 'web_search',
        args: {},
        result: {},
      },
    ]
    const done = groupAssistantContentParts(parts, false)
    expect(done.some((g) => g.type === 'single' && g.part.type === 'text' && g.part.text === 'Let me search…')).toBe(
      true
    )
  })

  it('deactivates work only when trailing answer text exists', () => {
    const parts: MessageContentParts = [
      {
        type: 'tool-call',
        state: 'result',
        toolCallId: 't1',
        toolName: 'web_search',
        args: {},
        result: {},
      },
      { type: 'text', text: 'Need your location.' },
    ]
    expect(isWorkActive({ generating: true, contentParts: parts })).toBe(false)
  })

  it('reserves empty answer slot while generating with only work parts', () => {
    const parts: MessageContentParts = [
      {
        type: 'tool-call',
        state: 'result',
        toolCallId: 't1',
        toolName: 'web_search',
        args: {},
        result: {},
      },
    ]
    const groups = groupAssistantContentParts(parts, true)
    expect(groups.filter((g) => g.type === 'thinking-group')).toHaveLength(1)
    expect(groups.some((g) => g.type === 'single' && g.part.type === 'text' && g.part.text === '')).toBe(true)
  })

  it('treats completed tool-calls as a visible reply (not an empty finish)', () => {
    expect(
      hasVisibleAssistantReply([
        {
          type: 'tool-call',
          state: 'result',
          toolCallId: 't1',
          toolName: 'web_search',
          args: { query: 'weather' },
          result: { ok: true },
        },
      ])
    ).toBe(true)
  })

  it('does not treat host memory_lookup or thought-only turns as a visible reply', () => {
    expect(
      hasVisibleAssistantReply([
        {
          type: 'tool-call',
          state: 'result',
          toolCallId: 'm1',
          toolName: 'memory_lookup',
          args: {},
          result: {},
        },
        { type: 'reasoning', text: 'thinking only', startTime: 1 },
      ])
    ).toBe(false)
    expect(hasVisibleAssistantReply([{ type: 'reasoning', text: 'thinking only', startTime: 1 }])).toBe(false)
    expect(hasVisibleAssistantReply([{ type: 'text', text: '   ' }])).toBe(false)
  })

  it('treats readable text as a visible reply', () => {
    expect(hasVisibleAssistantReply([{ type: 'text', text: 'London is 12°C' }])).toBe(true)
  })

  it('does not flag tool-only finishes as empty-completion errors', () => {
    const toolOnly: MessageContentParts = [
      {
        type: 'tool-call',
        state: 'result',
        toolCallId: 't1',
        toolName: 'web_search',
        args: {},
        result: {},
      },
    ]
    expect(buildEmptyCompletionError(toolOnly, 'tool-calls')).toBeUndefined()
    expect(buildEmptyCompletionError([{ type: 'reasoning', text: 'thoughts', startTime: 1 }], 'stop')).toContain(
      'without a visible reply'
    )
  })

  it('promotes the last reasoning block to a trailing answer when tools finish with no summary', () => {
    const parts: MessageContentParts = [
      { type: 'reasoning', text: 'Zeroing in on dc-down as an alias.', startTime: 1 },
      {
        type: 'tool-call',
        state: 'result',
        toolCallId: 't1',
        toolName: 'web_search',
        args: {},
        result: {},
      },
      {
        type: 'reasoning',
        text: 'Okay, I have got it. docker compose accepts -p; docker does not.',
        startTime: 2,
      },
      {
        type: 'tool-call',
        state: 'result',
        toolCallId: 't2',
        toolName: 'web_search',
        args: {},
        result: {},
      },
    ]
    const next = withFallbackAnswerParts(parts)
    const last = next[next.length - 1]
    expect(last).toEqual({
      type: 'text',
      text: 'Okay, I have got it. docker compose accepts -p; docker does not.',
    })
    expect(hasReadableTrailingAnswer(next, findLastWorkIndex(next))).toBe(true)
    expect(shouldContinueForVisibleAnswer(next, 'tool-calls')).toBe(false)
  })

  it('does not promote thought-only turns without model tools', () => {
    const parts: MessageContentParts = [{ type: 'reasoning', text: 'thinking only with no tools', startTime: 1 }]
    expect(withFallbackAnswerParts(parts)).toEqual(parts)
  })

  it('does not invent a fallback when a trailing answer already exists', () => {
    const parts: MessageContentParts = [
      {
        type: 'tool-call',
        state: 'result',
        toolCallId: 't1',
        toolName: 'web_search',
        args: {},
        result: {},
      },
      { type: 'text', text: 'Need your location.' },
    ]
    expect(withFallbackAnswerParts(parts)).toEqual(parts)
  })

  it('asks for one more model step when tools finished with no reasoning and no answer', () => {
    const parts: MessageContentParts = [
      {
        type: 'tool-call',
        state: 'result',
        toolCallId: 't1',
        toolName: 'web_search',
        args: {},
        result: {},
      },
    ]
    expect(shouldContinueForVisibleAnswer(parts, 'tool-calls')).toBe(true)
    expect(shouldContinueForVisibleAnswer(parts, 'stop')).toBe(false)
    expect(withFallbackAnswerParts(parts)).toEqual(parts)
  })
})
