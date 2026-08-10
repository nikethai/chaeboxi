import { describe, expect, it, vi } from 'vitest'
import { raceWithAbortSignal } from './desktop-http-fetch'

describe('raceWithAbortSignal', () => {
  it('resolves when the promise wins', async () => {
    const result = await raceWithAbortSignal(Promise.resolve(42), undefined)
    expect(result).toBe(42)
  })

  it('rejects immediately when signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(raceWithAbortSignal(Promise.resolve(1), controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    })
  })

  it('rejects when signal aborts before the promise settles', async () => {
    const controller = new AbortController()
    const slow = new Promise<number>((resolve) => {
      setTimeout(() => resolve(99), 500)
    })
    const raced = raceWithAbortSignal(slow, controller.signal)
    setTimeout(() => controller.abort(), 10)
    await expect(raced).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('clears abort listener after resolve', async () => {
    const controller = new AbortController()
    const addSpy = vi.spyOn(controller.signal, 'addEventListener')
    const removeSpy = vi.spyOn(controller.signal, 'removeEventListener')
    await raceWithAbortSignal(Promise.resolve('ok'), controller.signal)
    expect(addSpy).toHaveBeenCalled()
    expect(removeSpy).toHaveBeenCalled()
  })
})
