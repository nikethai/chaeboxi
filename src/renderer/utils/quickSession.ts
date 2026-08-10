export const QUICK_SESSION_REUSE_WINDOW_MS = 3 * 60 * 1000

export type QuickSessionSnapshot = {
  sessionId: string
  lastOpenedAt: number
}

export function resolveQuickSessionId(
  snapshot: QuickSessionSnapshot | null | undefined,
  availableSessionIds: string[],
  now = Date.now()
): string | null {
  if (!snapshot || !snapshot.sessionId || !Number.isFinite(snapshot.lastOpenedAt)) {
    return null
  }

  if (!availableSessionIds.includes(snapshot.sessionId)) {
    return null
  }

  const elapsed = now - snapshot.lastOpenedAt
  if (elapsed < 0 || elapsed > QUICK_SESSION_REUSE_WINDOW_MS) {
    return null
  }

  return snapshot.sessionId
}
export const QUICK_SESSION_STORAGE_KEY = 'chaeboxi.quick-session'

export function readQuickSessionSnapshot(): QuickSessionSnapshot | null {
  if (typeof localStorage === 'undefined') {
    return null
  }

  try {
    const raw = localStorage.getItem(QUICK_SESSION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<QuickSessionSnapshot>
    if (typeof parsed.sessionId !== 'string' || typeof parsed.lastOpenedAt !== 'number') {
      return null
    }
    return { sessionId: parsed.sessionId, lastOpenedAt: parsed.lastOpenedAt }
  } catch {
    return null
  }
}

export function writeQuickSessionSnapshot(snapshot: QuickSessionSnapshot): void {
  if (typeof localStorage === 'undefined') {
    return
  }

  try {
    localStorage.setItem(QUICK_SESSION_STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // Persistence is best effort; the quick window still works for this session.
  }
}
