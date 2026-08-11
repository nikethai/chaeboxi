import { create } from 'zustand'

type CaptureMeta = {
  width?: number
  height?: number
  displayId?: string
}

type State = {
  activeBySession: Record<string, boolean>
  lastCapture: Record<string, CaptureMeta>
  setActive: (sessionId: string, active: boolean) => void
  setLastCapture: (sessionId: string, meta: CaptureMeta) => void
  clear: (sessionId: string) => void
}

export const computerUseUiStore = create<State>((set) => ({
  activeBySession: {},
  lastCapture: {},
  setActive: (sessionId, active) =>
    set((s) => ({
      activeBySession: { ...s.activeBySession, [sessionId]: active },
    })),
  setLastCapture: (sessionId, meta) =>
    set((s) => ({
      lastCapture: { ...s.lastCapture, [sessionId]: meta },
    })),
  clear: (sessionId) =>
    set((s) => {
      const activeBySession = { ...s.activeBySession }
      const lastCapture = { ...s.lastCapture }
      delete activeBySession[sessionId]
      delete lastCapture[sessionId]
      return { activeBySession, lastCapture }
    }),
}))
