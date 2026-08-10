import { describe, expect, it } from 'vitest'
import { isSessionMemoryAutoSaveAllowed, isSessionMemoryToolRetainAllowed } from './session-policy'

describe('session memory write policy', () => {
  it('blocks both when global memory is disabled', () => {
    const mem = { enabled: false, autoSave: true }
    expect(isSessionMemoryAutoSaveAllowed(mem, undefined)).toBe(false)
    expect(isSessionMemoryToolRetainAllowed(mem, undefined)).toBe(false)
    expect(isSessionMemoryAutoSaveAllowed(mem, { memoryAutoSave: true })).toBe(false)
    expect(isSessionMemoryToolRetainAllowed(mem, { memoryAutoSave: true })).toBe(false)
  })

  it('blocks auto-save but allows tool retain when global autoSave is off', () => {
    const mem = { enabled: true, autoSave: false }
    expect(isSessionMemoryAutoSaveAllowed(mem, undefined)).toBe(false)
    expect(isSessionMemoryToolRetainAllowed(mem, undefined)).toBe(true)
    expect(isSessionMemoryAutoSaveAllowed(mem, { memoryAutoSave: true })).toBe(false)
    expect(isSessionMemoryToolRetainAllowed(mem, { memoryAutoSave: true })).toBe(true)
  })

  it('blocks both when session opts out', () => {
    const mem = { enabled: true, autoSave: true }
    expect(isSessionMemoryAutoSaveAllowed(mem, { memoryAutoSave: false })).toBe(false)
    expect(isSessionMemoryToolRetainAllowed(mem, { memoryAutoSave: false })).toBe(false)
  })

  it('allows both when session inherits or opts in and global auto-save is on', () => {
    const mem = { enabled: true, autoSave: true }
    expect(isSessionMemoryAutoSaveAllowed(mem, undefined)).toBe(true)
    expect(isSessionMemoryToolRetainAllowed(mem, undefined)).toBe(true)
    expect(isSessionMemoryAutoSaveAllowed(mem, { memoryAutoSave: true })).toBe(true)
    expect(isSessionMemoryToolRetainAllowed(mem, { memoryAutoSave: true })).toBe(true)
    expect(isSessionMemoryAutoSaveAllowed(mem, null)).toBe(true)
    expect(isSessionMemoryToolRetainAllowed(mem, null)).toBe(true)
  })

  it('still blocks tool retain on session opt-out even when global autoSave is off', () => {
    const mem = { enabled: true, autoSave: false }
    expect(isSessionMemoryToolRetainAllowed(mem, { memoryAutoSave: false })).toBe(false)
  })
})
