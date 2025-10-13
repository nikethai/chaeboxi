import { describe, expect, test, vi } from 'vitest'
import { UpdateQueue } from './updateQueue'

type State = { value: number }

describe('UpdateQueue concurrency', () => {
  test('processes concurrent updates sequentially', async () => {
    const onChange = vi.fn()
    const queue = new UpdateQueue<State>({ value: 0 }, onChange)

    const seen: Array<number | undefined> = []
    const updates = Array.from({ length: 3 }, () =>
      vi.fn((prev: State | null | undefined) => {
        seen.push(prev?.value)
        return { value: (prev?.value ?? 0) + 1 }
      })
    )
    const results = await Promise.all(updates.map((update) => queue.set(update)))

    expect(results).toEqual([{ value: 1 }, { value: 2 }, { value: 3 }])
    expect(seen).toEqual([0, 1, 2])
    updates.forEach((update) => expect(update).toHaveBeenCalledTimes(1))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({ value: 3 })
  })

  test('does not lose updates enqueued during flush', async () => {
    const queue = new UpdateQueue<State>({ value: 0 })

    let innerPromise: Promise<State> | undefined
    const outerPromise = queue.set((prev) => {
      innerPromise = queue.set((innerPrev) => ({ value: (innerPrev?.value ?? 0) + 1 }))
      return { value: (prev?.value ?? 0) + 1 }
    })

    await expect(outerPromise).resolves.toEqual({ value: 1 })
    expect(innerPromise).toBeDefined()
    await expect(innerPromise!).resolves.toEqual({ value: 2 })
  })

  test('initializes from async loader once for concurrent requests', async () => {
    const initialLoader = vi.fn(async () => {
      await Promise.resolve()
      return { value: 5 }
    })
    const queue = new UpdateQueue<State>(initialLoader)

    const results = await Promise.all([
      queue.set((prev) => ({ value: (prev?.value ?? 0) + 2 })),
      queue.set((prev) => ({ value: (prev?.value ?? 0) * 2 })),
    ])

    expect(results).toEqual([{ value: 7 }, { value: 14 }])
    expect(initialLoader).toHaveBeenCalledTimes(1)
  })

  test('continues processing after updater throws', async () => {
    const onChange = vi.fn()
    const queue = new UpdateQueue<State>({ value: 0 }, onChange)
    const error = new Error('boom')

    const first = queue.set((prev) => ({ value: (prev?.value ?? 0) + 1 }))
    const failing = queue.set(() => {
      throw error
    })
    const third = queue.set((prev) => ({ value: (prev?.value ?? 0) + 1 }))

    await expect(first).resolves.toEqual({ value: 1 })
    await expect(failing).rejects.toThrow(error)
    await expect(third).resolves.toEqual({ value: 2 })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({ value: 2 })
  })
})
