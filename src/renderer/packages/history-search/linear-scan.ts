import type { Message, Session } from '@shared/types'
import { getMessageText, migrateMessage } from '@shared/utils/message'
import { migrateSession } from '@/utils/session-utils'

/** Current global-search stop after this many matching messages. */
export const LINEAR_HISTORY_SEARCH_RESULT_CAP = 50

/**
 * Escape user input so history search is a case-insensitive substring, not a regex.
 * Preserves the existing SearchDialog contract.
 */
export function escapeHistorySearchInput(searchInput: string): string {
  return searchInput.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')
}

export function createHistorySearchRegexp(searchInput: string): RegExp {
  return new RegExp(escapeHistorySearchInput(searchInput), 'i')
}

/**
 * Linear in-memory match against a session's current thread and archived threads.
 * Does not scan `messageForksHash` (forks) or tool-call / image-only parts.
 */
export function matchSessionMessages(sessionInput: Session, regexp: RegExp): Message[] {
  const session = migrateSession(sessionInput)
  const matchedMessages: Message[] = []
  for (let i = session.messages.length - 1; i >= 0; i--) {
    const message = session.messages[i]
    if (regexp.test(getMessageText(message))) {
      matchedMessages.push(message)
    }
  }
  if (session.threads) {
    for (let i = session.threads.length - 1; i >= 0; i--) {
      const thread = session.threads[i]
      for (let j = thread.messages.length - 1; j >= 0; j--) {
        const message = thread.messages[j]
        if (regexp.test(getMessageText(message))) {
          matchedMessages.push(message)
        }
      }
    }
  }
  return matchedMessages.map((m) => migrateMessage(m))
}
