import { describe, expect, it } from 'vitest'
import { allocateFrameBudget, createFrameBudgetState, getRemainingFrameBudget, recordFramesUsed } from './budget'

describe('frame budget', () => {
  it('tracks remaining and allocates under caps', () => {
    const state = createFrameBudgetState(8, 6)
    recordFramesUsed(state, 'v1', 4)
    expect(getRemainingFrameBudget(state, 'v1')).toBe(4)
    expect(allocateFrameBudget(state, 'v1', 10)).toBe(4)
    expect(getRemainingFrameBudget(state, 'v1')).toBe(0)
    expect(allocateFrameBudget(state, 'v1', 2)).toBe(0)
  })

  it('respects per-tool-call max', () => {
    const state = createFrameBudgetState(8, 3)
    expect(allocateFrameBudget(state, 'v1', 8)).toBe(3)
    expect(getRemainingFrameBudget(state, 'v1')).toBe(5)
  })
})
