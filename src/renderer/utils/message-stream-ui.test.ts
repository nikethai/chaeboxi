import { describe, expect, it } from 'vitest'
import type { MessageContentParts } from '@shared/types'
import {
  contentPartsRevision,
  groupAssistantContentParts,
  hasReadableTrailingAnswer,
  isWorkActive,
  shouldShowAssistantPending,
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
    // No promoted answer singles while generating
    expect(live.some((g) => g.type === 'single' && g.part.type === 'text')).toBe(false)
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
})
