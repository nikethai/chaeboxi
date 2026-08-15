/**
 * CORS-safe HTTP for desktop (Tauri IPC → reqwest) with browser fallback.
 * Used by provider chat/check (Qwen, xAI, OpenAI-compatible) and OAuth.
 * Same transport pattern as ComfyUIClient.
 *
 * Bodies stream over a Tauri IPC channel (`http:request_stream`), so SSE
 * chat completions render progressively instead of waiting for the full body.
 */

import { Channel, invoke } from '@tauri-apps/api/core'

interface DesktopHttpRequestPayload {
  url: string
  method?: string
  headers?: Record<string, string>
  bodyBase64?: string
}
interface DesktopHttpStreamHead {
  status: number
  headers?: Record<string, string>
}

function encodeBytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function decodeBase64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function bodyToBase64(body: BodyInit | null | undefined): Promise<string | undefined> {
  if (!body) return undefined

  if (typeof body === 'string') {
    return encodeBytesToBase64(new TextEncoder().encode(body))
  }

  if (body instanceof URLSearchParams) {
    return encodeBytesToBase64(new TextEncoder().encode(body.toString()))
  }

  // Blob, ArrayBuffer, TypedArray, ReadableStream (AI SDK streaming request bodies)
  try {
    const bytes = new Uint8Array(await new Response(body).arrayBuffer())
    return encodeBytesToBase64(bytes)
  } catch {
    return encodeBytesToBase64(new TextEncoder().encode(String(body)))
  }
}

function headersToObject(headers?: HeadersInit): Record<string, string> | undefined {
  if (!headers) return undefined
  const normalized = new Headers(headers)
  const result: Record<string, string> = {}
  normalized.forEach((value, key) => {
    result[key] = value
  })
  return Object.keys(result).length > 0 ? result : undefined
}

export function hasDesktopHttpTransport(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.desktopAPI?.invoke === 'function'
  } catch {
    return false
  }
}

function createAbortError(message = 'The operation was aborted.'): Error {
  const err = new Error(message)
  err.name = 'AbortError'
  return err
}

/**
 * Race a promise against AbortSignal. Desktop IPC cannot cancel in-flight reqwest,
 * but we must still reject so callers (timeouts, tool cancel) can finish.
 */
export function raceWithAbortSignal<T>(promise: Promise<T>, signal?: AbortSignal | null): Promise<T> {
  if (!signal) return promise
  if (signal.aborted) return Promise.reject(createAbortError())

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(createAbortError())
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (err) => {
        signal.removeEventListener('abort', onAbort)
        reject(err)
      }
    )
  })
}

const END_BODY_SENTINEL = ''
const ERROR_BODY_SENTINEL = '\u0001'
/** Defensive cap: error the stream if the producer wildly outruns the consumer. */
const MAX_BUFFERED_BODY_BYTES = 128 * 1024 * 1024

/**
 * Sends the request through the dedicated Tauri streaming command and returns
 * a Response whose body streams as chunks arrive over the IPC channel — no
 * whole-body buffering, so SSE chat completions stream live on desktop.
 *
 * The Rust side returns the response head (status + headers) immediately and
 * then streams base64 body chunks; an empty string chunk marks the end and a
 * U+0001 chunk marks a read failure. Dropping/unregistering the channel
 * (abort, window close, body cancel) aborts the in-flight request.
 */
async function requestViaDesktop(url: string, init?: RequestInit): Promise<Response> {
  const signal = init?.signal
  if (signal?.aborted) {
    throw createAbortError()
  }

  const payload: DesktopHttpRequestPayload = {
    url,
    method: init?.method,
    headers: headersToObject(init?.headers),
    bodyBase64: await bodyToBase64(init?.body ?? null),
  }

  const queue: Uint8Array[] = []
  let queuedBytes = 0
  let ended = false
  let failed = false
  let failureReason: string | null = null
  let notifyReader: (() => void) | null = null
  let streamController: ReadableStreamDefaultController<Uint8Array> | null = null

  let onChunk: Channel<string> | null = new Channel<string>()
  const unregisterChannelCallback = (channelId: number) => {
    // Tauri-injected internals are not part of the DOM types; narrow defensively.
    const w = window as unknown as Record<string, unknown>
    const internals = w['__TAURI_INTERNALS__']
    if (!internals || typeof internals !== 'object') return
    const unregister = (internals as Record<string, unknown>)['unregisterCallback']
    if (typeof unregister === 'function') {
      unregister(channelId)
    }
  }
  const releaseChannel = () => {
    const channel = onChunk
    onChunk = null
    if (!channel) return
    channel.onmessage = () => {}
    signal?.removeEventListener('abort', onAbort)
    // Unregister the IPC callback so Tauri drops the Rust-side receiver and the
    // in-flight reqwest request aborts. cleanupCallback is private in the type
    // declarations; unregistering via the internals is the only deterministic
    // teardown until the Channel object can be garbage collected.
    unregisterChannelCallback(channel.id)
  }

  const wakeReader = () => {
    notifyReader?.()
    notifyReader = null
  }

  const failStream = (reason: string) => {
    failed = true
    failureReason = reason
    wakeReader()
  }

  const onAbort = () => {
    streamController?.error(createAbortError())
    releaseChannel()
  }

  onChunk.onmessage = (chunk) => {
    if (chunk === END_BODY_SENTINEL) {
      ended = true
    } else if (chunk === ERROR_BODY_SENTINEL) {
      failStream('Desktop HTTP stream read failed')
    } else {
      const bytes = decodeBase64ToBytes(chunk)
      queuedBytes += bytes.length
      if (queuedBytes > MAX_BUFFERED_BODY_BYTES) {
        failStream('Desktop HTTP stream buffered too much data')
      } else {
        queue.push(bytes)
      }
    }
    wakeReader()
  }
  signal?.addEventListener('abort', onAbort, { once: true })

  const head = (await invoke<DesktopHttpStreamHead>('http_request_stream', {
    request: payload,
    onChunk,
  })) as DesktopHttpStreamHead

  if (signal?.aborted) {
    releaseChannel()
    throw createAbortError()
  }

  // Fetch forbids a body for these statuses — return a null-body Response.
  if (head.status === 204 || head.status === 205 || head.status === 304) {
    releaseChannel()
    return new Response(null, { status: head.status, headers: head.headers })
  }

  let offset = 0
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller
    },
    pull(controller) {
      if (offset < queue.length) {
        controller.enqueue(queue[offset])
        offset += 1
        return undefined
      }
      if (failed) {
        controller.error(new Error(failureReason ?? 'Desktop HTTP stream failed'))
        releaseChannel()
        return undefined
      }
      if (ended) {
        controller.close()
        releaseChannel()
        return undefined
      }
      return new Promise<void>((resolve) => {
        notifyReader = resolve
      })
    },
    cancel() {
      releaseChannel()
    },
  })

  return new Response(stream, {
    status: head.status,
    headers: head.headers,
  })
}

/**
 * Fetch that uses Tauri native HTTP when available (no CORS),
 * otherwise global fetch (web / tests).
 *
 * AbortSignal is honored for both the response-head phase (Promise race) and
 * the body phase (stream error + channel release).
 */
export function createDesktopAwareFetch(): typeof fetch {
  const desktopFetch: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

    if (hasDesktopHttpTransport()) {
      try {
        return await raceWithAbortSignal(requestViaDesktop(url, init), init?.signal)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') throw err
        const msg = err instanceof Error ? err.message : String(err)
        throw new TypeError(`Desktop HTTP request failed: ${msg}`)
      }
    }

    return fetch(input, init)
  }

  return desktopFetch
}

/** Shared default for OAuth / model catalog (lazy; re-evaluated each call is fine). */
export function defaultOAuthFetch(): typeof fetch {
  return createDesktopAwareFetch()
}

/** Alias for general provider HTTP (chat, check connection, list models). */
export function defaultDesktopAwareFetch(): typeof fetch {
  return createDesktopAwareFetch()
}
