import { describe, expect, it, vi } from 'vitest'
import { createDesktopAwareFetch, raceWithAbortSignal } from './desktop-http-fetch'

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

describe('requestViaDesktop streaming', () => {
  type ChunkArgs = { request: { url: string; method?: string }; onChunk: { id: number } }

  function mockTauriInternals() {
    let nextCallbackId = 1
    const callbacks: Record<number, (raw: unknown) => void> = {}
    const invoke = vi.fn()
    const unregisterCallback = vi.fn()
    const internals = {
      invoke,
      transformCallback: (cb: (raw: unknown) => void) => {
        const id = nextCallbackId++
        callbacks[id] = cb
        return id
      },
      invokeCallback: (id: number, raw: unknown) => {
        callbacks[id]?.(raw)
      },
      unregisterCallback: (id: number) => {
        delete callbacks[id]
        unregisterCallback(id)
      },
    }
    return { internals, invoke, unregisterCallback }
  }

  function stubWindow(internals: Record<string, unknown>) {
    vi.stubGlobal('window', {
      __TAURI_INTERNALS__: internals,
      desktopAPI: { invoke: vi.fn() },
    })
  }

  function resolveHead(head: Partial<{ status: number; headers: Record<string, string> }> = {}) {
    return Promise.resolve({
      status: head.status ?? 200,
      headers: head.headers ?? { 'content-type': 'text/event-stream' },
    })
  }

  it('returns the response head immediately and streams body chunks via the Tauri channel', async () => {
    const { internals, invoke } = mockTauriInternals()
    stubWindow(internals)

    let channelId = 0
    invoke.mockImplementation((_cmd: string, args: ChunkArgs) => {
      channelId = args.onChunk.id
      return resolveHead()
    })

    const desktopFetch = createDesktopAwareFetch()
    const res = await desktopFetch('https://example.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })

    expect(invoke).toHaveBeenCalledWith(
      'http_request_stream',
      expect.objectContaining({
        request: expect.objectContaining({
          url: 'https://example.com/v1/chat/completions',
          method: 'POST',
        }),
        onChunk: expect.anything(),
      }),
      undefined
    )
    // Response head (status/headers) is available before any body data arrives.
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/event-stream')

    const reader = res.body!.getReader()

    // Simulate the Rust side streaming chunks through the IPC callback.
    internals.invokeCallback(channelId, { index: 0, message: 'SGVsbG8=' })
    const first = await reader.read()
    expect(first.done).toBe(false)
    expect(Buffer.from(first.value!).toString('utf8')).toBe('Hello')

    internals.invokeCallback(channelId, { index: 1, message: 'IHdvcmxk' })
    const second = await reader.read()
    expect(second.done).toBe(false)
    expect(Buffer.from(second.value!).toString('utf8')).toBe(' world')

    internals.invokeCallback(channelId, { index: 2, message: '' })
    const last = await reader.read()
    expect(last.done).toBe(true)
  })

  it('returns a null-body response for body-forbidden status codes', async () => {
    const { internals, invoke, unregisterCallback } = mockTauriInternals()
    stubWindow(internals)
    invoke.mockImplementation(() => resolveHead({ status: 204 }))

    const desktopFetch = createDesktopAwareFetch()
    const res = await desktopFetch('https://example.com/v1/models', { method: 'GET' })

    expect(res.status).toBe(204)
    expect(res.body).toBeNull()
    expect(unregisterCallback).toHaveBeenCalledTimes(1)
  })

  it('rejects body reads with AbortError when the signal aborts after the head', async () => {
    const { internals, invoke } = mockTauriInternals()
    stubWindow(internals)
    invoke.mockImplementation(() => resolveHead())

    const controller = new AbortController()
    const desktopFetch = createDesktopAwareFetch()
    const res = await desktopFetch('https://example.com/v1/chat/completions', {
      method: 'POST',
      body: '{}',
      signal: controller.signal,
    })

    const reader = res.body!.getReader()
    const pending = reader.read()
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('unregisters the IPC channel callback when the body stream is cancelled', async () => {
    const { internals, invoke, unregisterCallback } = mockTauriInternals()
    stubWindow(internals)
    invoke.mockImplementation(() => resolveHead())

    const desktopFetch = createDesktopAwareFetch()
    const res = await desktopFetch('https://example.com/v1/chat/completions', { method: 'POST' })

    const reader = res.body!.getReader()
    await reader.cancel()
    expect(unregisterCallback).toHaveBeenCalledTimes(1)
  })

  it('errors the stream when the Rust side reports a read failure', async () => {
    const { internals, invoke } = mockTauriInternals()
    stubWindow(internals)

    let channelId = 0
    invoke.mockImplementation((_cmd: string, args: ChunkArgs) => {
      channelId = args.onChunk.id
      return resolveHead()
    })

    const desktopFetch = createDesktopAwareFetch()
    const res = await desktopFetch('https://example.com/v1/chat/completions', { method: 'POST' })

    const reader = res.body!.getReader()
    internals.invokeCallback(channelId, { index: 0, message: '\u0001' })
    await expect(reader.read()).rejects.toThrow('stream read failed')
  })
})
