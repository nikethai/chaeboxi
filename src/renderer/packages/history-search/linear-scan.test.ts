import type { Message, Session } from '@shared/types'
import { describe, expect, it } from 'vitest'
import {
  createHistorySearchRegexp,
  escapeHistorySearchInput,
  LINEAR_HISTORY_SEARCH_RESULT_CAP,
  matchSessionMessages,
} from './linear-scan'

function makeMessage(overrides: Partial<Message> & Pick<Message, 'id' | 'role'>): Message {
  return {
    contentParts: [{ type: 'text', text: 'hello' }],
    timestamp: 1,
    ...overrides,
  }
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 's1',
    name: 'Session',
    type: 'chat',
    messages: [],
    ...overrides,
  }
}

describe('escapeHistorySearchInput', () => {
  it('treats regex metacharacters as literals', () => {
    expect(escapeHistorySearchInput('foo.*bar')).toBe('foo\\.\\*bar')
    expect(escapeHistorySearchInput('a+b?')).toBe('a\\+b\\?')
  })

  it('does not treat .* as a wildcard in message text', () => {
    const session = makeSession({
      messages: [makeMessage({ id: 'm1', role: 'user', contentParts: [{ type: 'text', text: 'fooXbar' }] })],
    })
    expect(matchSessionMessages(session, createHistorySearchRegexp('foo.*bar'))).toEqual([])
  })
})

describe('matchSessionMessages', () => {
  it('matches current-thread text case-insensitively and newest-first', () => {
    const session = makeSession({
      messages: [
        makeMessage({ id: 'old', role: 'user', contentParts: [{ type: 'text', text: 'Alpha project' }] }),
        makeMessage({ id: 'new', role: 'assistant', contentParts: [{ type: 'text', text: 'ALPHA notes' }] }),
      ],
    })
    const hits = matchSessionMessages(session, createHistorySearchRegexp('alpha'))
    expect(hits.map((m) => m.id)).toEqual(['new', 'old'])
  })

  it('matches archived threads', () => {
    const session = makeSession({
      messages: [makeMessage({ id: 'live', role: 'user', contentParts: [{ type: 'text', text: 'unrelated' }] })],
      threads: [
        {
          id: 't1',
          name: 'old',
          createdAt: 1,
          messages: [makeMessage({ id: 'thread-hit', role: 'user', contentParts: [{ type: 'text', text: 'needle' }] })],
        },
      ],
    })
    const hits = matchSessionMessages(session, createHistorySearchRegexp('needle'))
    expect(hits.map((m) => m.id)).toEqual(['thread-hit'])
  })

  it('does not search message forks', () => {
    const session = makeSession({
      messages: [makeMessage({ id: 'visible', role: 'user', contentParts: [{ type: 'text', text: 'visible only' }] })],
      messageForksHash: {
        visible: {
          position: 0,
          createdAt: 1,
          lists: [
            {
              id: 'fork',
              messages: [
                makeMessage({ id: 'forked', role: 'user', contentParts: [{ type: 'text', text: 'secret fork' }] }),
              ],
            },
          ],
        },
      },
    })
    expect(matchSessionMessages(session, createHistorySearchRegexp('secret fork'))).toEqual([])
  })

  it('does not match tool-call parts (text-only search)', () => {
    const session = makeSession({
      messages: [
        makeMessage({
          id: 'tool',
          role: 'assistant',
          contentParts: [
            {
              type: 'tool-call',
              state: 'result',
              toolCallId: 'c1',
              toolName: 'web_search',
              args: { query: 'hidden-tool-text' },
              result: { query: 'hidden-tool-text', searchResults: [] },
            },
          ],
        }),
      ],
    })
    expect(matchSessionMessages(session, createHistorySearchRegexp('hidden-tool-text'))).toEqual([])
  })

  it('matches unicode letters with the case-insensitive flag', () => {
    const session = makeSession({
      messages: [makeMessage({ id: 'vi', role: 'user', contentParts: [{ type: 'text', text: 'Đà Nẵng notes' }] })],
    })
    expect(matchSessionMessages(session, createHistorySearchRegexp('đà nẵng')).map((m) => m.id)).toEqual(['vi'])
  })
})

describe('linear search baseline envelope', () => {
  it('scans 10k in-memory messages well under the 200ms warm-search candidate', () => {
    const messages: Message[] = []
    for (let i = 0; i < 10_000; i++) {
      messages.push(
        makeMessage({
          id: `m${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          contentParts: [{ type: 'text', text: i === 9_500 ? 'unique-needle-xyz' : `padding ${i} lorem ipsum` }],
        })
      )
    }
    const session = makeSession({ id: 'huge', messages })
    const regexp = createHistorySearchRegexp('unique-needle-xyz')
    const started = performance.now()
    const hits = matchSessionMessages(session, regexp)
    const elapsedMs = performance.now() - started
    expect(hits).toHaveLength(1)
    expect(elapsedMs).toBeLessThan(200)
  })

  it('documents the existing global result cap', () => {
    expect(LINEAR_HISTORY_SEARCH_RESULT_CAP).toBe(50)
  })
})
