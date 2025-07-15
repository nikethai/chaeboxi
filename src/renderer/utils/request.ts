import { CapacitorHttp } from '@capacitor/core'
import platform from '@/platform'
import { ApiError, BaseError, NetworkError } from '../../shared/models/errors'
import { isLocalHost } from '../../shared/utils/network_utils'

async function retryRequest<T>(fn: () => Promise<T>, retry: number, url: string): Promise<T> {
  let requestError: BaseError | null = null

  for (let i = 0; i < retry + 1; i++) {
    try {
      return await fn()
    } catch (e) {
      if (e instanceof BaseError) {
        requestError = e
      } else {
        const err = e as Error
        const origin = new URL(url).origin
        requestError = new NetworkError(err.message, origin)
      }
      if (i < retry) {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }
  }

  if (requestError) {
    throw requestError
  } else {
    throw new Error('Unknown error')
  }
}

async function doRequest(
  url: string,
  options: {
    method: string
    headers?: RequestInit['headers']
    body?: RequestInit['body']
    signal?: AbortSignal
    retry?: number
    useProxy?: boolean
  }
): Promise<Response> {
  const { signal, retry = 3, useProxy = false, body, method } = options
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')

  if (useProxy && !isLocalHost(url)) {
    headers.set('CHATBOX-TARGET-URI', url)
    headers.set('CHATBOX-PLATFORM', platform.type)
    headers.set('CHATBOX-VERSION', (await platform.getVersion()) || 'unknown')
    url = 'https://cors-proxy.chatboxai.app/proxy-api/completions'
  }

  // For mobile platform and local hosts, use CapacitorHttp to bypass CORS
  if (platform.type === 'mobile' && isLocalHost(url)) {
    return retryRequest(
      async () => {
        console.debug('capacitor request', url, method, headers, body)
        const response = await CapacitorHttp.request({
          url,
          method,
          headers: Object.fromEntries(headers.entries()),
          data: body,
        })
        console.debug('capacitor response', response)
        if (response.status >= 400) {
          throw new ApiError(`Status Code ${response.status}, ${response.data}`)
        }
        let useStream = false
        if (body && typeof body === 'string') {
          try {
            const reqData = JSON.parse(body)
            useStream = reqData.stream === true
          } catch {
            // do nothing
          }
        }
        // capacitor do not support stream response, so we need to simulate a stream response
        if (useStream) {
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(response.data))
              controller.close()
            },
          })
          return new Response(stream, {
            status: response.status,
            headers: { ...response.headers, 'Content-Type': 'text/event-stream' },
          })
        } else {
          const data = typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
          // Convert CapacitorHttp response to standard Response object
          return new Response(data, {
            status: response.status,
            headers: response.headers,
          })
        }
      },
      retry,
      url
    )
  }

  // Standard fetch for non-mobile or non-local requests
  return retryRequest(
    async () => {
      console.debug('fetch request', url, method, headers, body)
      const res = await fetch(url, { method, headers, body, signal })
      console.debug('fetch response', res)
      if (!res.ok) {
        const err = await res.text().catch(() => null)
        throw new ApiError(`Status Code ${res.status}, ${err}`)
      }
      return res
    },
    retry,
    url
  )
}

export const apiRequest = {
  async post(
    url: string,
    headers: Record<string, string>,
    body: RequestInit['body'],
    options?: {
      signal?: AbortSignal
      retry?: number
      useProxy?: boolean
    }
  ) {
    return doRequest(url, { ...options, method: 'POST', headers, body })
  },
  async get(
    url: string,
    headers: Record<string, string>,
    options?: {
      signal?: AbortSignal
      retry?: number
      useProxy?: boolean
    }
  ) {
    return doRequest(url, { ...options, method: 'GET', headers })
  },
}

export async function fetchWithProxy(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return doRequest(input.toString(), {
    method: init?.method || 'GET',
    headers: init?.headers,
    body: init?.body,
    signal: init?.signal || undefined,
    useProxy: true,
  })
}
