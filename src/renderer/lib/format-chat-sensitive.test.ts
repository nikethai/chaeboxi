import { describe, expect, it, vi } from 'vitest'
import { createMessage } from '@shared/types'

const SENTINEL = 'SECRET_SENTINEL_BYTES_9f3a'

describe('chat export redacts sensitive tool payloads', () => {
  it('omits file content from markdown and txt exports', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    })
    const { formatChatAsMarkdown, formatChatAsTxt } = await import('./format-chat')
    const message = createMessage('assistant', '')
    message.contentParts = [
      {
        type: 'tool-call',
        state: 'call',
        toolCallId: 't1',
        toolName: 'create_file',
        args: { path: 'a.txt', content: SENTINEL },
      },
    ]
    const thread = { id: 'th', name: 't', messages: [message], createdAt: 1 }
    const md = formatChatAsMarkdown('s', [thread])
    const txt = formatChatAsTxt('s', [thread])
    expect(md).not.toContain(SENTINEL)
    expect(txt).not.toContain(SENTINEL)
    expect(md).toMatch(/create_file/)
  })
})
