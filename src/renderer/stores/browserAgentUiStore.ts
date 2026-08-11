import { create } from 'zustand'

export type BrowserUiStatus = {
  running: boolean
  url: string | null
  lastTool: string | null
  error: string | null
  tabCount?: number
}

type State = {
  bySession: Record<string, BrowserUiStatus>
  setStatus: (sessionId: string, status: BrowserUiStatus) => void
  patchStatus: (sessionId: string, patch: Partial<BrowserUiStatus>) => void
  clear: (sessionId: string) => void
}

const empty: BrowserUiStatus = {
  running: false,
  url: null,
  lastTool: null,
  error: null,
}

export const browserAgentUiStore = create<State>((set) => ({
  bySession: {},
  setStatus: (sessionId, status) =>
    set((s) => ({
      bySession: { ...s.bySession, [sessionId]: status },
    })),
  patchStatus: (sessionId, patch) =>
    set((s) => ({
      bySession: {
        ...s.bySession,
        [sessionId]: { ...(s.bySession[sessionId] || empty), ...patch },
      },
    })),
  clear: (sessionId) =>
    set((s) => {
      const next = { ...s.bySession }
      delete next[sessionId]
      return { bySession: next }
    }),
}))

export function useBrowserAgentStatus(sessionId: string | undefined): BrowserUiStatus {
  return browserAgentUiStore((s) => (sessionId ? s.bySession[sessionId] : undefined) || empty)
}
