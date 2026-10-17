import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const add = vi.fn()
vi.mock('@/stores/toastActions', () => ({ add: (...args: unknown[]) => add(...args) }))

vi.mock('i18next', () => ({ t: (key: string) => key }))

import { canUndo, DEFAULT_UNDO_MS, pushUndo, resetUndoForTests, undoEntry, undoLatest, undoStore } from './undo'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(0)
  add.mockClear()
  resetUndoForTests()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('undo records', () => {
  it('expires after 5 s', () => {
    expect(DEFAULT_UNDO_MS).toBe(5000)
    const id = pushUndo({ message: 'm', undo: vi.fn() })
    vi.setSystemTime(4999)
    expect(canUndo(id)).toBe(true)
    vi.setSystemTime(5000)
    expect(canUndo(id)).toBe(false)

    vi.setSystemTime(10_000)
    const id2 = pushUndo({ message: 'm', undo: vi.fn(), durationMs: 10_000 })
    vi.setSystemTime(19_999)
    expect(canUndo(id2)).toBe(true)
    vi.setSystemTime(20_000)
    expect(canUndo(id2)).toBe(false)
  })

  it('runs once', async () => {
    const undo = vi.fn()
    const id = pushUndo({ message: 'm', undo })
    expect(await Promise.all([undoEntry(id), undoEntry(id)])).toEqual([true, false])
    expect(undo).toHaveBeenCalledTimes(1)
    expect(await undoLatest()).toBe(false)
  })

  it('a failing undo says so', async () => {
    const id = pushUndo({ message: 'm', undo: () => Promise.reject(new Error('x')) })
    expect(await undoEntry(id)).toBe(false)
    expect(add).toHaveBeenCalledWith("Couldn't undo. The change stays.")
  })

  it('a synchronous throw also says so', async () => {
    const id = pushUndo({
      message: 'm',
      undo: () => {
        throw new Error('x')
      },
    })
    expect(await undoEntry(id)).toBe(false)
    expect(add).toHaveBeenCalledTimes(1)
  })

  it('only the newest knowledge record', () => {
    const a = pushUndo({ message: 'a', undo: vi.fn(), group: 'knowledge' })
    const c = pushUndo({ message: 'c', undo: vi.fn() })
    const b = pushUndo({ message: 'b', undo: vi.fn(), group: 'knowledge' })
    expect(canUndo(a)).toBe(false)
    expect(canUndo(b)).toBe(true)
    expect(canUndo(c)).toBe(true)
  })

  it('undoLatest skips silent', async () => {
    const vUndo = vi.fn()
    const sUndo = vi.fn()
    pushUndo({ message: 'v', undo: vUndo })
    pushUndo({ message: 's', undo: sUndo, silent: true })
    expect(await undoLatest()).toBe(true)
    expect(vUndo).toHaveBeenCalledTimes(1)
    expect(sUndo).not.toHaveBeenCalled()
    expect(await undoLatest()).toBe(false)
  })

  it('toast follows the latest visible record', async () => {
    const v = pushUndo({ message: 'v', undo: vi.fn() })
    expect(undoStore.getState().toast).toMatchObject({ id: v, message: 'v' })
    pushUndo({ message: 's', undo: vi.fn(), silent: true })
    expect(undoStore.getState().toast?.id).toBe(v)
    const w = pushUndo({ message: 'w', undo: vi.fn() })
    expect(undoStore.getState().toast).toMatchObject({ id: w, message: 'w' })
    await undoEntry(w)
    expect(undoStore.getState().toast).toBeUndefined()

    pushUndo({ message: 'x', undo: vi.fn() })
    expect(undoStore.getState().toast).toBeDefined()
    vi.advanceTimersByTime(5000)
    expect(undoStore.getState().toast).toBeUndefined()
  })

  it('retiring the toast record clears the toast', () => {
    pushUndo({ message: 'a', undo: vi.fn(), group: 'knowledge' })
    expect(undoStore.getState().toast).toBeDefined()
    pushUndo({ message: 'b', undo: vi.fn(), group: 'knowledge', silent: true })
    expect(undoStore.getState().toast).toBeUndefined()
  })

  it('extra is carried, not run', async () => {
    const onClick = vi.fn()
    const extra = { label: 'See', onClick }
    const id = pushUndo({ message: 'm', undo: vi.fn(), extra })
    expect(undoStore.getState().toast?.extra).toBe(extra)
    await undoEntry(id)
    pushUndo({ message: 'm2', undo: vi.fn(), extra })
    await undoLatest()
    expect(onClick).not.toHaveBeenCalled()
  })
})
