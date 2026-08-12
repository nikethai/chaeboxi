/**
 * Session-level "live generation" lock for UI (Stop button, statusline, scroll).
 * Independent of message.generating cache patches so multi-step tool rounds never
 * flash Send / idle chrome mid-turn.
 */

type Listener = () => void

const liveBySession = new Map<string, string>() // sessionId -> messageId
const listeners = new Set<Listener>()

function emit() {
  for (const l of listeners) {
    try {
      l()
    } catch {
      // non-fatal
    }
  }
}

export function markSessionGenerationLive(sessionId: string, messageId: string): void {
  const prev = liveBySession.get(sessionId)
  if (prev === messageId) return
  liveBySession.set(sessionId, messageId)
  emit()
}

export function clearSessionGenerationLive(sessionId: string, messageId?: string): void {
  const cur = liveBySession.get(sessionId)
  if (!cur) return
  if (messageId && cur !== messageId) return
  liveBySession.delete(sessionId)
  emit()
}

export function isSessionGenerationLive(sessionId: string): boolean {
  return liveBySession.has(sessionId)
}

export function getLiveGenerationMessageId(sessionId: string): string | undefined {
  return liveBySession.get(sessionId)
}

export function subscribeSessionGenerationLive(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
