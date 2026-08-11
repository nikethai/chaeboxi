/**
 * Per-chat browser session mutex (D6 / D10).
 * acquire on first browser tool in a run; release on run end / stop / error.
 */

type LockEntry = {
  ownerRunId: string
  acquiredAt: number
}

const locks = new Map<string, LockEntry>()

export function acquireBrowserLock(sessionId: string, ownerRunId: string): { ok: true } | { ok: false; error: string } {
  const existing = locks.get(sessionId)
  if (existing && existing.ownerRunId !== ownerRunId) {
    return {
      ok: false,
      error: `BROWSER_BUSY: browser is in use by another run (${existing.ownerRunId}). Stop that run or wait.`,
    }
  }
  locks.set(sessionId, { ownerRunId, acquiredAt: Date.now() })
  return { ok: true }
}

export function releaseBrowserLock(sessionId: string, ownerRunId?: string): void {
  const existing = locks.get(sessionId)
  if (!existing) return
  if (ownerRunId && existing.ownerRunId !== ownerRunId) return
  locks.delete(sessionId)
}

export function getBrowserLock(sessionId: string): LockEntry | undefined {
  return locks.get(sessionId)
}

export function clearAllBrowserLocks(): void {
  locks.clear()
}
