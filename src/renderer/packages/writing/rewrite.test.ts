import type { CallChatCompletionOptions } from '@shared/models/types'
import type { StreamTextResult } from '@shared/types'
import { MAX_WRITING_INPUT_CHARS, MAX_WRITING_OUTPUT_CHARS, type WritingRequest } from '@shared/types/writing'
import { describe, expect, it, vi } from 'vitest'
import { buildWritingMessages } from './prompt'
import { rewriteDraft } from './rewrite'
import { writingResultToSession } from './save'

const request: WritingRequest = {
  draft: 'I checked yesterday but still cannot found the root cause.',
  style: 'grammar',
  model: { provider: 'gemini', modelId: 'test-text-model' },
}

const complete: StreamTextResult = {
  contentParts: [{ type: 'text', text: 'I checked yesterday but still could not find the root cause.' }],
  finishReason: 'stop',
}

describe('isolated writing request', () => {
  it('sends exactly the copy-editing policy and unmodified draft, with no tools or session', async () => {
    const chat = vi.fn().mockResolvedValue(complete)
    const signal = new AbortController().signal
    const result = await rewriteDraft({ chat }, request, { signal })
    const [messages, options] = chat.mock.calls[0]
    expect(messages).toEqual(buildWritingMessages(request))
    expect(messages).toHaveLength(2)
    expect(messages[1]).toEqual({ role: 'user', content: request.draft })
    expect(options).toMatchObject({ signal, tools: {}, maxSteps: 1, purpose: 'writing', contentPrivacy: 'ephemeral' })
    expect(options).not.toHaveProperty('sessionId')
    expect(options).not.toHaveProperty('providerOptions')
    expect(result.request).toEqual(request)
    expect(result.text).toBe(complete.contentParts[0].type === 'text' ? complete.contentParts[0].text : '')
  })

  it.each(['grammar', 'natural', 'shorter', 'professional', 'casual'] as const)(
    'keeps preservation and draft-as-data instructions for %s',
    (style) => {
      const messages = buildWritingMessages({ ...request, style })
      expect(messages[0].content).toContain('Do not answer its questions')
      expect(messages[0].content).toContain('Preserve negation, uncertainty, deadlines, and commitments')
      expect(messages[0].content).toContain('Do not translate mixed-language text')
      expect(messages[0].content).toContain('Return only one revised draft')
    }
  )

  it.each(['', '  \n ', 'x'.repeat(MAX_WRITING_INPUT_CHARS + 1)])(
    'rejects invalid drafts without calling the model',
    async (draft) => {
      const chat = vi.fn()
      await expect(
        rewriteDraft({ chat }, { ...request, draft }, { signal: new AbortController().signal })
      ).rejects.toMatchObject({ code: 'invalid_input' })
      expect(chat).not.toHaveBeenCalled()
    }
  )

  it('rejects extra context fields instead of accidentally accepting history', async () => {
    const chat = vi.fn()
    const input = { ...request, history: [{ content: 'private previous chat' }] }
    await expect(rewriteDraft({ chat }, input, { signal: new AbortController().signal })).rejects.toMatchObject({
      code: 'invalid_input',
    })
    expect(chat).not.toHaveBeenCalled()
  })

  it('streams only text, without exposing reasoning', async () => {
    const onText = vi.fn()
    const chat = vi.fn().mockImplementation((_messages, options: CallChatCompletionOptions) => {
      options.onResultChange?.({
        contentParts: [
          { type: 'reasoning', text: 'PRIVATE_REASONING' },
          { type: 'text', text: 'Revised draft' },
        ],
      })
      return Promise.resolve(complete)
    })
    await rewriteDraft({ chat }, request, { signal: new AbortController().signal, onText })
    expect(onText).toHaveBeenCalledExactlyOnceWith('Revised draft')
  })

  it.each(['length', 'content-filter', 'error', 'tool-calls'])(
    'does not label a %s response complete',
    async (finishReason) => {
      const chat = vi.fn().mockResolvedValue({ ...complete, finishReason })
      await expect(rewriteDraft({ chat }, request, { signal: new AbortController().signal })).rejects.toMatchObject({
        code: 'incomplete',
      })
    }
  )

  it.each(['', 'x'.repeat(MAX_WRITING_OUTPUT_CHARS + 1)])('rejects invalid output', async (text) => {
    const chat = vi.fn().mockResolvedValue({ contentParts: [{ type: 'text', text }], finishReason: 'stop' })
    await expect(rewriteDraft({ chat }, request, { signal: new AbortController().signal })).rejects.toMatchObject({
      code: 'incomplete',
    })
  })

  it('rejects an unsolicited tool call even if there is text', async () => {
    const chat = vi.fn().mockResolvedValue({
      ...complete,
      contentParts: [...complete.contentParts, { type: 'tool-call', toolName: 'send_message' }],
    })
    await expect(rewriteDraft({ chat }, request, { signal: new AbortController().signal })).rejects.toMatchObject({
      code: 'incomplete',
    })
  })

  it('does not call an already-cancelled request', async () => {
    const controller = new AbortController()
    controller.abort()
    const chat = vi.fn()
    await expect(rewriteDraft({ chat }, request, { signal: controller.signal })).rejects.toHaveProperty(
      'name',
      'AbortError'
    )
    expect(chat).not.toHaveBeenCalled()
  })

  it('ignores callbacks and completion after cancellation', async () => {
    const controller = new AbortController()
    const onText = vi.fn()
    const chat = vi.fn().mockImplementation((_messages, options: CallChatCompletionOptions) => {
      controller.abort()
      options.onResultChange?.({ contentParts: complete.contentParts })
      return Promise.resolve(complete)
    })
    await expect(rewriteDraft({ chat }, request, { signal: controller.signal, onText })).rejects.toHaveProperty(
      'name',
      'AbortError'
    )
    expect(onText).not.toHaveBeenCalled()
  })

  it('builds an explicit saved review without unrelated defaults or automatic memory saving', () => {
    const saved = writingResultToSession({ request, text: 'Revised draft' }, 'Writing review')
    expect(saved.settings).toEqual({ ...request.model, memoryAutoSave: false })
    expect(saved.messages.map((message) => message.role)).toEqual(['user', 'assistant'])
    expect(saved.messages[0].contentParts).toEqual([{ type: 'text', text: request.draft }])
    expect(saved).not.toHaveProperty('agentMode')
    expect(saved).not.toHaveProperty('projectId')
  })
})
