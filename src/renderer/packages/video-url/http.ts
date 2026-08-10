import { createDesktopAwareFetch } from '@shared/utils/desktop-http-fetch'

/**
 * CORS-safe HTTP for video URL adapters.
 * Desktop (Tauri) uses native reqwest via IPC — YouTube/Vimeo HTML works.
 * Web falls back to browser fetch (may fail CORS for platform scrapes; use BYOK).
 */

function withTimeout(signal: AbortSignal | undefined, timeoutMs?: number): AbortSignal | undefined {
  if (!timeoutMs || timeoutMs <= 0) return signal
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timer)
      controller.abort()
    } else {
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer)
          controller.abort()
        },
        { once: true }
      )
    }
  }
  // Clear timer when aborted via timeout so we don't leak in long sessions
  controller.signal.addEventListener('abort', () => clearTimeout(timer), { once: true })
  return controller.signal
}

function buildUrl(url: string, query?: Record<string, string>): string {
  if (!query || Object.keys(query).length === 0) return url
  const u = new URL(url)
  for (const [k, v] of Object.entries(query)) {
    u.searchParams.set(k, v)
  }
  return u.toString()
}

async function desktopAwareRequest(
  url: string,
  options: {
    method?: string
    signal?: AbortSignal
    timeout?: number
    headers?: Record<string, string>
    query?: Record<string, string>
    body?: BodyInit
  } = {}
): Promise<Response> {
  const fetchFn = createDesktopAwareFetch()
  const finalUrl = buildUrl(url, options.query)
  const signal = withTimeout(options.signal, options.timeout)
  const res = await fetchFn(finalUrl, {
    method: options.method || 'GET',
    headers: options.headers,
    body: options.body,
    signal,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`)
  }
  return res
}

export async function fetchText(
  url: string,
  options: {
    signal?: AbortSignal
    timeout?: number
    headers?: Record<string, string>
    query?: Record<string, string>
  } = {}
): Promise<string> {
  const res = await desktopAwareRequest(url, options)
  return res.text()
}

/**
 * Soft GET that returns status + body even on 4xx/5xx (no throw).
 * Used for hostile scrapes (Facebook) where empty/error pages are expected.
 */
export async function fetchTextSoft(
  url: string,
  options: {
    signal?: AbortSignal
    timeout?: number
    headers?: Record<string, string>
    query?: Record<string, string>
  } = {}
): Promise<{ ok: boolean; status: number; text: string }> {
  try {
    const fetchFn = createDesktopAwareFetch()
    const finalUrl = buildUrl(url, options.query)
    const signal = withTimeout(options.signal, options.timeout)
    const res = await fetchFn(finalUrl, {
      method: 'GET',
      headers: options.headers,
      signal,
    })
    const text = await res.text().catch(() => '')
    return { ok: res.ok, status: res.status, text }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, status: 0, text: message }
  }
}

export async function fetchJson<T = unknown>(
  url: string,
  options: {
    method?: string
    signal?: AbortSignal
    timeout?: number
    headers?: Record<string, string>
    query?: Record<string, string>
    body?: BodyInit
  } = {}
): Promise<T> {
  const res = await desktopAwareRequest(url, options)
  return (await res.json()) as T
}

export async function fetchArrayBuffer(
  url: string,
  options: {
    signal?: AbortSignal
    timeout?: number
    headers?: Record<string, string>
  } = {}
): Promise<ArrayBuffer> {
  const res = await desktopAwareRequest(url, options)
  return res.arrayBuffer()
}
