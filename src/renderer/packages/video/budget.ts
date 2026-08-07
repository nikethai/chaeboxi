import { clampFrameCount } from './limits'

export interface FrameBudgetState {
  /** fileKey → frames already used this turn (auto + tool) */
  usedByFileKey: Map<string, number>
  maxPerVideo: number
  maxPerToolCall: number
}

export function createFrameBudgetState(maxPerVideo: number, maxPerToolCall: number): FrameBudgetState {
  return {
    usedByFileKey: new Map(),
    maxPerVideo,
    maxPerToolCall,
  }
}

export function getRemainingFrameBudget(state: FrameBudgetState, fileKey: string): number {
  const used = state.usedByFileKey.get(fileKey) ?? 0
  return Math.max(0, state.maxPerVideo - used)
}

export function allocateFrameBudget(
  state: FrameBudgetState,
  fileKey: string,
  requested: number
): number {
  const remaining = getRemainingFrameBudget(state, fileKey)
  const allowed = clampFrameCount(requested, Math.min(remaining, state.maxPerToolCall))
  if (allowed <= 0) {
    return 0
  }
  const used = state.usedByFileKey.get(fileKey) ?? 0
  state.usedByFileKey.set(fileKey, used + allowed)
  return allowed
}

export function recordFramesUsed(state: FrameBudgetState, fileKey: string, count: number): void {
  if (count <= 0) {
    return
  }
  const used = state.usedByFileKey.get(fileKey) ?? 0
  state.usedByFileKey.set(fileKey, used + count)
}
