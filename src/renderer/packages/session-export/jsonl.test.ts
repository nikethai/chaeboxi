import { describe, expect, it } from 'vitest'
import { exportSessionToJSONL, importSessionFromJSONL } from './jsonl'
import type { Message, Session } from '@shared/types/session'

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    role: 'user',
    contentParts: [{ type: 'text', text: 'Hello' }],
    timestamp: 1700000000000,
    ...overrides,
  }
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-1',
    name: 'Test Session',
    type: 'chat',
    messages: [makeMessage()],
    agentMode: false,
    ...overrides,
  }
}

describe('exportSessionToJSONL', () => {
  it('should serialize a session with messages to JSONL lines', () => {
    const session = makeSession()
    const messages = session.messages

    const result = exportSessionToJSONL(session, messages)
    const lines = result.split('\n')

    expect(lines.length).toBe(2) // 1 meta + 1 message
    const meta = JSON.parse(lines[0])
    expect(meta.type).toBe('session_meta')
    expect(meta.data.id).toBe('session-1')
    expect(meta.data.name).toBe('Test Session')
    expect(meta.data.messages).toBeUndefined()

    const msg = JSON.parse(lines[1])
    expect(msg.type).toBe('message')
    expect(msg.data.id).toBe('msg-1')
    expect(msg.data.role).toBe('user')
  })

  it('should include compaction points', () => {
    const session = makeSession({
      compactionPoints: [
        { summaryMessageId: 'sum-1', boundaryMessageId: 'bound-1', createdAt: 1700000000000 },
      ],
    })

    const result = exportSessionToJSONL(session, session.messages)
    const lines = result.split('\n')

    expect(lines.length).toBe(3) // meta + compaction + message
    const cp = JSON.parse(lines[1])
    expect(cp.type).toBe('compaction_point')
    expect(cp.data.summaryMessageId).toBe('sum-1')
  })

  it('should strip transient fields (cancel, generating, status)', () => {
    const msg = makeMessage({ generating: true })
    const session = makeSession({ messages: [msg] })

    const result = exportSessionToJSONL(session, [msg])
    const lines = result.split('\n')
    const exported = JSON.parse(lines[1])

    expect(exported.data.generating).toBeUndefined()
  })

  it('should handle tool-call content parts', () => {
    const msg = makeMessage({
      contentParts: [
        {
          type: 'tool-call',
          state: 'result',
          toolCallId: 'tc-1',
          toolName: 'search',
          args: { query: 'test' },
          result: { answer: 'found' },
        },
      ],
    })
    const session = makeSession({ messages: [msg] })

    const result = exportSessionToJSONL(session, [msg])
    const lines = result.split('\n')
    const exported = JSON.parse(lines[1])

    expect(exported.data.contentParts[0].type).toBe('tool-call')
    expect(exported.data.contentParts[0].toolName).toBe('search')
    expect(exported.data.contentParts[0].args).toEqual({ query: 'test' })
    expect(exported.data.contentParts[0].result).toEqual({ answer: 'found' })
  })

  it('should handle sessions with settings', () => {
    const session = makeSession({
      settings: { provider: 'openai', modelId: 'gpt-4o' },
    })

    const result = exportSessionToJSONL(session, session.messages)
    const meta = JSON.parse(result.split('\n')[0])

    expect(meta.data.settings.provider).toBe('openai')
    expect(meta.data.settings.modelId).toBe('gpt-4o')
  })
})

describe('importSessionFromJSONL', () => {
  it('should deserialize JSONL into session and messages', () => {
    const session = makeSession()
    const jsonl = exportSessionToJSONL(session, session.messages)

    const result = importSessionFromJSONL(jsonl)

    expect(result.session.id).toBe('session-1')
    expect(result.session.name).toBe('Test Session')
    expect(result.messages.length).toBe(1)
    expect(result.messages[0].id).toBe('msg-1')
    expect(result.errors.length).toBe(0)
  })

  it('should handle compaction points', () => {
    const session = makeSession({
      compactionPoints: [
        { summaryMessageId: 'sum-1', boundaryMessageId: 'bound-1', createdAt: 1700000000000 },
      ],
    })

    const jsonl = exportSessionToJSONL(session, session.messages)
    const result = importSessionFromJSONL(jsonl)

    expect(result.compactionPoints.length).toBe(1)
    expect(result.compactionPoints[0].summaryMessageId).toBe('sum-1')
  })

  it('should collect errors for invalid lines without failing', () => {
    const validLine = JSON.stringify({
      type: 'session_meta',
      data: { id: 's-1', name: 'Test', messages: [], agentMode: false },
    })
    const invalidLine = 'not valid json'
    const badTypeLine = JSON.stringify({ type: 'unknown_type', data: {} })

    const jsonl = [validLine, invalidLine, badTypeLine].join('\n')
    const result = importSessionFromJSONL(jsonl)

    expect(result.session.id).toBe('s-1')
    expect(result.errors.length).toBe(2)
    expect(result.errors[0]).toContain('Line 2')
    expect(result.errors[1]).toContain('Line 3')
  })

  it('should report error when no valid data found', () => {
    const result = importSessionFromJSONL('not json\nalso not json')

    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors.some((e) => e.includes('No valid session data'))).toBe(true)
  })

  it('should handle empty lines gracefully', () => {
    const session = makeSession()
    const jsonl = exportSessionToJSONL(session, session.messages)
    const withEmptyLines = `\n${jsonl}\n\n`

    const result = importSessionFromJSONL(withEmptyLines)

    expect(result.session.id).toBe('session-1')
    expect(result.messages.length).toBe(1)
    expect(result.errors.length).toBe(0)
  })

  it('should roundtrip session with multiple messages and threads', () => {
    const msg1 = makeMessage({ id: 'msg-1', role: 'user' })
    const msg2 = makeMessage({
      id: 'msg-2',
      role: 'assistant',
      contentParts: [{ type: 'text', text: 'Hi there!' }],
    })
    const threadMsg = makeMessage({ id: 'msg-3', role: 'user', contentParts: [{ type: 'text', text: 'Thread msg' }] })

    const session = makeSession({
      messages: [msg1, msg2],
      threads: [
        {
          id: 'thread-1',
          name: 'Thread 1',
          messages: [threadMsg],
          createdAt: 1700000000000,
        },
      ],
    })

    const allMessages = [...session.threads![0].messages, ...session.messages]
    const jsonl = exportSessionToJSONL(session, allMessages)
    const result = importSessionFromJSONL(jsonl)

    expect(result.messages.length).toBe(3)
    expect(result.session.threads?.length).toBe(1)
    expect(result.errors.length).toBe(0)
  })
})
