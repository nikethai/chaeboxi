import type { Message } from '@shared/types'
import { getMessageText as sharedGetMessageText } from '@shared/utils/message'

/**
 * Robust text extraction for memory pin: contentParts + legacy content fallback.
 */
export function getMemoryMessageText(message: Message): string {
  let text = ''
  try {
    text = sharedGetMessageText(message, false, false) || ''
  } catch {
    text = ''
  }

  if (!text.trim() && message.contentParts?.length) {
    text = message.contentParts
      .map((p) => {
        if (p.type === 'text' && 'text' in p) return p.text || ''
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }

  // Legacy field used by some older sessions
  if (!text.trim() && 'content' in message && typeof (message as { content?: unknown }).content === 'string') {
    text = String((message as { content?: string }).content || '')
  }

  return text.trim()
}
