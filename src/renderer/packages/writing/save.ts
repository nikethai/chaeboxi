import { createMessage, type Session } from '@shared/types'
import type { WritingResult } from './rewrite'

/** Explicit opt-in only; never call this from generation completion or modal cleanup. */
export function writingResultToSession(result: WritingResult, name: string): Omit<Session, 'id'> {
  return {
    name,
    type: 'chat',
    messages: [
      createMessage('user', result.request.draft),
      { ...createMessage('assistant', result.text), usage: result.usage },
    ],
    settings: {
      ...result.request.model,
      memoryAutoSave: false,
    },
  }
}

export async function saveWritingResult(result: WritingResult, name: string): Promise<string> {
  const { createSession } = await import('@/stores/chatStore')
  const session = await createSession(writingResultToSession(result, name))
  return session.id
}
