import type { Message } from '@shared/types'
import { ensureMemoryStoreInit, memoryStore } from '@/stores/memoryStore'
import { getMemoryMessageText } from './message-text'

export type SaveMessageToMemoryResult =
  | { ok: true; id: string; content: string }
  | { ok: false; reason: 'empty' | 'failed' | 'error'; error?: string }

/** Pin a chat message into the Global memory bank. */
export async function saveMessageToGlobalMemory(
  msg: Message,
  sessionId: string
): Promise<SaveMessageToMemoryResult> {
  try {
    await ensureMemoryStoreInit()
    const content = getMemoryMessageText(msg)
    if (!content) return { ok: false, reason: 'empty' }

    const entry = await memoryStore.getState().retain({
      content: content.slice(0, 500),
      scope: 'global',
      tags: ['pinned', msg.role === 'user' ? 'user-message' : 'assistant-message'],
      source: 'user',
      sourceSessionId: sessionId,
      sourceMessageId: msg.id,
      pinned: true,
    })
    if (!entry) return { ok: false, reason: 'failed' }
    return { ok: true, id: entry.id, content: entry.content }
  } catch (e) {
    return { ok: false, reason: 'error', error: e instanceof Error ? e.message : String(e) }
  }
}
