/**
 * Session/message abort registry for generation.
 * cancel() on Message is easy to lose (JSON persist strips functions); this Map is the source of truth for Stop.
 */

type CancelEntry = {
  cancel: () => void
  messageId: string
}

const bySession = new Map<string, CancelEntry>()

export function registerGenerationCancel(sessionId: string, messageId: string, cancel: () => void): void {
  // Replace any prior cancel for this session (one active gen per session)
  bySession.set(sessionId, {
    messageId,
    cancel: () => {
      try {
        cancel()
      } finally {
        const cur = bySession.get(sessionId)
        if (cur?.messageId === messageId) {
          bySession.delete(sessionId)
        }
      }
    },
  })
}

export function clearGenerationCancel(sessionId: string, messageId?: string): void {
  const cur = bySession.get(sessionId)
  if (!cur) return
  if (messageId && cur.messageId !== messageId) return
  bySession.delete(sessionId)
}

/** Abort in-flight generation for session. Returns true if a cancel was invoked. */
export function cancelSessionGeneration(sessionId: string): boolean {
  const cur = bySession.get(sessionId)
  if (!cur) return false
  cur.cancel()
  return true
}

export function getActiveGenerationMessageId(sessionId: string): string | undefined {
  return bySession.get(sessionId)?.messageId
}
