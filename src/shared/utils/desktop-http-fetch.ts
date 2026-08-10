/**
 * CORS-safe HTTP for desktop (Tauri IPC → reqwest) with browser fallback.
 * Used by provider chat/check (Qwen, xAI, OpenAI-compatible) and OAuth.
 * Same transport pattern as ComfyUIClient.
 *
 * Note: response bodies are buffered (reqwest full read). SSE streams still
 * parse correctly after completion; progressive token UX may wait until done.
 */

interface DesktopHttpRequestPayload {
  url: string
  method?: string
  headers?: Record<string, string>
  bodyBase64?: string
}

interface DesktopHttpResponsePayload {
  status: number
  headers?: Record<string, string>
  bodyBase64?: string
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

async function requestViaDesktop(url: string, init?: RequestInit): Promise<Response> {
  const payload: DesktopHttpRequestPayload = {
    url,
    method: init?.method,
    headers: headersToObject(init?.headers),
    bodyBase64: await bodyToBase64(init?.body ?? null),
  }

  const response = (await window.desktopAPI!.invoke('http:request', payload)) as DesktopHttpResponsePayload
  const bodyBytes = response.bodyBase64 ? decodeBase64ToBytes(response.bodyBase64) : new Uint8Array()
  // Copy into a fresh ArrayBuffer-backed view for Response/Blob typing
  const normalizedBody = Uint8Array.from(bodyBytes)

  return new Response(new Blob([normalizedBody]), {
    status: response.status,
    headers: response.headers,
  })
}

/**
 * Fetch that uses Tauri native HTTP when available (no CORS),
 * otherwise global fetch (web / tests).
 *
 * AbortSignal is honored via Promise race (desktop IPC is not cancelable mid-flight).
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
