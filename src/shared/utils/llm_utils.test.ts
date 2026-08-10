import type { Message } from 'src/shared/types'
import { describe, expect, it } from 'vitest'
import { normalizeOpenAIApiHostAndPath, normalizeOpenAIResponsesHostAndPath } from './llm_utils'
import { fixMessageRoleSequence } from './message'

describe('normalizeOpenAIApiHostAndPath', () => {
  it('default value', () => {
    const result = normalizeOpenAIApiHostAndPath({})
    expect(result).toEqual({ apiHost: 'https://api.openai.com/v1', apiPath: '/chat/completions' })
  })

  it('OpenAI API', () => {
    const result = normalizeOpenAIApiHostAndPath({
      apiHost: 'https://api.openai.com/v1',
      apiPath: '/chat/completions',
    })
    expect(result).toEqual({ apiHost: 'https://api.openai.com/v1', apiPath: '/chat/completions' })
  })
  it('OpenAI API 2', () => {
    const result = normalizeOpenAIApiHostAndPath({ apiHost: 'https://api.openai.com/v1' })
    expect(result).toEqual({ apiHost: 'https://api.openai.com/v1', apiPath: '/chat/completions' })
  })
  it('OpenAI API 3', () => {
    const result = normalizeOpenAIApiHostAndPath({ apiHost: 'https://api.openai.com' })
    expect(result).toEqual({ apiHost: 'https://api.openai.com/v1', apiPath: '/chat/completions' })
  })
  it('OpenAI API 4', () => {
    const result = normalizeOpenAIApiHostAndPath({ apiHost: 'https://api.openai.com/v1/chat/completions' })
    expect(result).toEqual({ apiHost: 'https://api.openai.com/v1', apiPath: '/chat/completions' })
  })
  it('OpenAI API 4', () => {
    const result = normalizeOpenAIApiHostAndPath({
      apiHost: 'https://api.openai.com/',
      apiPath: '/v1/chat/completions',
    })
    expect(result).toEqual({ apiHost: 'https://api.openai.com/v1', apiPath: '/chat/completions' })
  })

  it('OpenRouter API 1', () => {
    const result = normalizeOpenAIApiHostAndPath({
      apiHost: 'https://openrouter.ai/api/v1',
      apiPath: '/chat/completions',
    })
    expect(result).toEqual({ apiHost: 'https://openrouter.ai/api/v1', apiPath: '/chat/completions' })
  })
  it('OpenRouter API 2', () => {
    const result = normalizeOpenAIApiHostAndPath({ apiHost: 'https://openrouter.ai/api/v1' })
    expect(result).toEqual({ apiHost: 'https://openrouter.ai/api/v1', apiPath: '/chat/completions' })
  })
  it('OpenRouter API 3', () => {
    const result = normalizeOpenAIApiHostAndPath({ apiHost: 'https://openrouter.ai/api' })
    expect(result).toEqual({ apiHost: 'https://openrouter.ai/api/v1', apiPath: '/chat/completions' })
  })
  it('OpenRouter API 4', () => {
    const result = normalizeOpenAIApiHostAndPath({ apiHost: 'https://openrouter.ai/api/v1/chat/completions/' })
    expect(result).toEqual({ apiHost: 'https://openrouter.ai/api/v1', apiPath: '/chat/completions' })
  })

  it('xAPI 1', () => {
    const result = normalizeOpenAIApiHostAndPath({ apiHost: 'https://api.x.com/v1', apiPath: '/chat/completions' })
    expect(result).toEqual({ apiHost: 'https://api.x.com/v1', apiPath: '/chat/completions' })
  })
  it('xAPI 2', () => {
    const result = normalizeOpenAIApiHostAndPath({ apiHost: 'https://api.x.com/v1' })
    expect(result).toEqual({ apiHost: 'https://api.x.com/v1', apiPath: '/chat/completions' })
  })
  it('xAPI 3', () => {
    const result = normalizeOpenAIApiHostAndPath({ apiHost: 'https://api.x.com' })
    expect(result).toEqual({ apiHost: 'https://api.x.com/v1', apiPath: '/chat/completions' })
  })
  it('xAPI 4', () => {
    const result = normalizeOpenAIApiHostAndPath({ apiHost: 'https://api.x.com/v1/chat/completions/' })
    expect(result).toEqual({ apiHost: 'https://api.x.com/v1', apiPath: '/chat/completions' })
  })
  it('xAPI 5', () => {
    const result = normalizeOpenAIApiHostAndPath({ apiHost: 'https://api.x.com', apiPath: '/chat/completions' })
    expect(result).toEqual({ apiHost: 'https://api.x.com/v1', apiPath: '/chat/completions' })
  })

  it('custom proxy URL', () => {
    const result = normalizeOpenAIApiHostAndPath({ apiHost: 'https://my-proxy.com' })
    expect(result).toEqual({ apiHost: 'https://my-proxy.com/v1', apiPath: '/chat/completions' })
  })
  it('custom proxy URL with full path', () => {
    const result = normalizeOpenAIApiHostAndPath({ apiHost: 'https://my-proxy.com/v1/chat/completions' })
    expect(result).toEqual({ apiHost: 'https://my-proxy.com/v1', apiPath: '/chat/completions' })
  })
  it('custom API path', () => {
    const result = normalizeOpenAIApiHostAndPath({ apiHost: 'https://my-proxy.com', apiPath: '/custom/path' })
    expect(result).toEqual({ apiHost: 'https://my-proxy.com', apiPath: '/custom/path' })
  })

  it('slash 1', () => {
    const result = normalizeOpenAIApiHostAndPath({ apiHost: 'https://my-proxy.com/', apiPath: '/chat/completions' })
    expect(result).toEqual({ apiHost: 'https://my-proxy.com', apiPath: '/chat/completions' })
  })
  it('slash 2', () => {
    const result = normalizeOpenAIApiHostAndPath({ apiHost: 'https://my-proxy.com', apiPath: 'custom/path' })
    expect(result).toEqual({ apiHost: 'https://my-proxy.com', apiPath: '/custom/path' })
  })

  it('http protocol', () => {
    const result = normalizeOpenAIApiHostAndPath({ apiHost: 'http://my-proxy.com', apiPath: '/chat/completions' })
    expect(result).toEqual({ apiHost: 'http://my-proxy.com', apiPath: '/chat/completions' })
  })
  it('http protocol 2', () => {
    const result = normalizeOpenAIApiHostAndPath({ apiHost: 'https://my-proxy.com', apiPath: '/chat/completions' })
    expect(result).toEqual({ apiHost: 'https://my-proxy.com', apiPath: '/chat/completions' })
  })
  it('http protocol 3', () => {
    const result = normalizeOpenAIApiHostAndPath({ apiHost: 'my-proxy.com', apiPath: '/chat/completions' })
    expect(result).toEqual({ apiHost: 'https://my-proxy.com', apiPath: '/chat/completions' })
  })
})

describe('normalizeOpenAIResponsesHostAndPath', () => {
  it('appends /v1 when only host is provided', () => {
    const result = normalizeOpenAIResponsesHostAndPath({ apiHost: 'https://api.openai.com' })
    expect(result).toEqual({ apiHost: 'https://api.openai.com/v1', apiPath: '/responses' })
  })

  it('appends /v1 even when caller passes default /responses path', () => {
    const result = normalizeOpenAIResponsesHostAndPath({
      apiHost: 'https://custom-proxy.com',
      apiPath: '/responses',
    })
    expect(result).toEqual({ apiHost: 'https://custom-proxy.com/v1', apiPath: '/responses' })
  })

  it('respects custom api path overrides', () => {
    const result = normalizeOpenAIResponsesHostAndPath({
      apiHost: 'https://custom-proxy.com',
      apiPath: '/custom/path',
    })
    expect(result).toEqual({ apiHost: 'https://custom-proxy.com', apiPath: '/custom/path' })
  })
})

describe('fixMessageRoleSequence', () => {
  it('should handle empty array', () => {
    const messages: Message[] = []
    expect(fixMessageRoleSequence(messages)).toEqual([])
  })

  it('should handle single message', () => {
    const messages: Message[] = [{ id: '', role: 'user', contentParts: [{ type: 'text', text: 'Hello' }] }]
    expect(fixMessageRoleSequence(messages)).toEqual([
      { id: '', role: 'user', contentParts: [{ type: 'text', text: 'Hello' }] },
    ])
  })

  it('should merge consecutive same-role messages', () => {
    const messages: Message[] = [
      { id: '', role: 'user', contentParts: [{ type: 'text', text: 'Hello' }] },
      { id: '', role: 'user', contentParts: [{ type: 'text', text: 'I have a question' }] },
    ]
    expect(fixMessageRoleSequence(messages)).toEqual([
      {
        id: '',
        role: 'user',
        contentParts: [
          { type: 'text', text: 'Hello' },
          { type: 'text', text: 'I have a question' },
        ],
      },
    ])
  })

  it('should handle alternating roles', () => {
    const messages: Message[] = [
      { id: '', role: 'user', contentParts: [{ type: 'text', text: 'Hello' }] },
      { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'Hello! How can I help?' }] },
      { id: '', role: 'user', contentParts: [{ type: 'text', text: 'I have a question' }] },
    ]
    expect(fixMessageRoleSequence(messages)).toEqual([
      { id: '', role: 'user', contentParts: [{ type: 'text', text: 'Hello' }] },
      { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'Hello! How can I help?' }] },
      { id: '', role: 'user', contentParts: [{ type: 'text', text: 'I have a question' }] },
    ])
  })

  it('should merge multiple consecutive same-role messages', () => {
    const messages: Message[] = [
      { id: '', role: 'user', contentParts: [{ type: 'text', text: 'Hello' }] },
      { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'Hello!' }] },
      { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'How can I help?' }] },
      { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'Feel free to ask anytime' }] },
      { id: '', role: 'user', contentParts: [{ type: 'text', text: 'Thanks' }] },
    ]
    expect(fixMessageRoleSequence(messages)).toEqual([
      { id: '', role: 'user', contentParts: [{ type: 'text', text: 'Hello' }] },
      {
        id: '',
        role: 'assistant',
        contentParts: [
          { type: 'text', text: 'Hello!' },
          { type: 'text', text: 'How can I help?' },
          { type: 'text', text: 'Feel free to ask anytime' },
        ],
      },
      { id: '', role: 'user', contentParts: [{ type: 'text', text: 'Thanks' }] },
    ])
  })

  it('should prepend user before first assistant message', () => {
    const messages: Message[] = [
      { id: '', role: 'system', contentParts: [{ type: 'text', text: 'System prompt' }] },
      { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'Hello' }] },
    ]
    const expected: Message[] = [
      { id: '', role: 'system', contentParts: [{ type: 'text', text: 'System prompt' }] },
      { id: 'user_before_assistant_id', role: 'user', contentParts: [{ type: 'text', text: 'OK.' }] },
      { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'Hello' }] },
    ]
    expect(fixMessageRoleSequence(messages)).toEqual(expected)
  })
  it('should prepend user before first assistant message', () => {
    const messages: Message[] = [{ id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'Hello' }] }]
    const expected: Message[] = [
      { id: 'user_before_assistant_id', role: 'user', contentParts: [{ type: 'text', text: 'OK.' }] },
      { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'Hello' }] },
    ]
    expect(fixMessageRoleSequence(messages)).toEqual(expected)
  })

  it('should not prepend user when user already exists', () => {
    const messages: Message[] = [
      { id: '', role: 'user', contentParts: [{ type: 'text', text: 'Hello' }] },
      { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'Hi' }] },
    ]
    expect(fixMessageRoleSequence(messages)).toEqual(messages)
  })

  it('should handle multi-turn dialogs', () => {
    const messages: Message[] = [
      { id: '', role: 'system', contentParts: [{ type: 'text', text: 'System prompt' }] },
      { id: '', role: 'user', contentParts: [{ type: 'text', text: 'Hello' }] },
      { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'Hi' }] },
      { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'How are you?' }] },
      { id: '', role: 'user', contentParts: [{ type: 'text', text: 'Good' }] },
    ]
    const expected: Message[] = [
      { id: '', role: 'system', contentParts: [{ type: 'text', text: 'System prompt' }] },
      { id: '', role: 'user', contentParts: [{ type: 'text', text: 'Hello' }] },
      {
        id: '',
        role: 'assistant',
        contentParts: [
          { type: 'text', text: 'Hi' },
          { type: 'text', text: 'How are you?' },
        ],
      },
      { id: '', role: 'user', contentParts: [{ type: 'text', text: 'Good' }] },
    ]
    expect(fixMessageRoleSequence(messages)).toEqual(expected)
  })
})
