import { describe, expect, it } from 'vitest'
import { buildChatStarters, CHAT_STARTER_DEFS, isThreadVisuallyEmpty } from './chat-starters'

describe('isThreadVisuallyEmpty', () => {
  it('is empty with no messages', () => {
    expect(isThreadVisuallyEmpty([])).toBe(true)
  })

  it('is empty with only system messages', () => {
    expect(isThreadVisuallyEmpty([{ role: 'system' }])).toBe(true)
  })

  it('is not empty with a user message', () => {
    expect(isThreadVisuallyEmpty([{ role: 'system' }, { role: 'user' }])).toBe(false)
  })

  it('is not empty with an assistant message', () => {
    expect(isThreadVisuallyEmpty([{ role: 'assistant' }])).toBe(false)
  })
})

describe('buildChatStarters', () => {
  it('maps defs through t()', () => {
    const starters = buildChatStarters((k) => `T:${k}`)
    expect(starters).toHaveLength(CHAT_STARTER_DEFS.length)
    expect(starters[0].title).toBe(`T:${CHAT_STARTER_DEFS[0].titleKey}`)
    expect(starters[0].fill).toBe(CHAT_STARTER_DEFS[0].fill)
  })
})
