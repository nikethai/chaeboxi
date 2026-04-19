import { ApiError, NetworkError } from '../../../models/errors'
import type {
  ComfyUIHistoryEntry,
  ComfyUIObjectInfo,
  ComfyUIPromptResponse,
  ComfyUIServerInfo,
  ComfyUIWorkflow,
} from './comfyui-types'

const POLL_INTERVAL_MS = 1500
const POLL_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
const COMFYUI_ENDPOINT_PATHS = new Set([
  '/api',
  '/api/prompt',
  '/api/object_info',
  '/api/system_stats',
  '/api/view',
  '/prompt',
  '/object_info',
  '/system_stats',
  '/view',
])

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

  if (body instanceof Blob) {
    return encodeBytesToBase64(new Uint8Array(await body.arrayBuffer()))
  }

  if (body instanceof ArrayBuffer) {
    return encodeBytesToBase64(new Uint8Array(body))
  }

  if (ArrayBuffer.isView(body)) {
    return encodeBytesToBase64(new Uint8Array(body.buffer, body.byteOffset, body.byteLength))
  }

  return encodeBytesToBase64(new TextEncoder().encode(String(body)))
}

function headersToObject(headers?: HeadersInit): Record<string, string> | undefined {
  if (!headers) return undefined

  const normalizedHeaders = new Headers(headers)
  const result: Record<string, string> = {}
  normalizedHeaders.forEach((value, key) => {
    result[key] = value
  })
  return Object.keys(result).length > 0 ? result : undefined
}

export function normalizeComfyUIBaseUrl(baseUrl: string): string {
  let url = baseUrl.trim()

  if (!url) {
    throw new ApiError('ComfyUI server URL is empty. Enter something like http://127.0.0.1:8188')
  }

  const wrappedUrl = url.match(/^(['"`])(.*)\1$/)
  if (wrappedUrl) {
    url = wrappedUrl[2].trim()
  }

  if (!/^https?:\/\//i.test(url)) {
    url = `http://${url}`
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    throw new ApiError(`Invalid ComfyUI server URL "${baseUrl}". Use something like http://127.0.0.1:8188`)
  }

  const normalizedPath = parsedUrl.pathname.replace(/\/+$/, '')
  const cleanedPath = COMFYUI_ENDPOINT_PATHS.has(normalizedPath) ? '' : normalizedPath

  return `${parsedUrl.origin}${cleanedPath}`
}

/**
 * ComfyUI HTTP client.
 *
 * Supports both legacy endpoints (/prompt) and newer /api/-prefixed
 * endpoints (/api/prompt). On the first request, tries `/api/<path>`
 * then falls back to `/<path>`. The working prefix is cached.
 */
export class ComfyUIClient {
  private baseUrl: string
  /** Cached prefix: '/api' or '' — null means "not yet known" */
  private apiPrefix: string | null = null

  constructor(baseUrl: string) {
    this.baseUrl = normalizeComfyUIBaseUrl(baseUrl)
  }

  private hasDesktopTransport(): boolean {
    try {
      return typeof window !== 'undefined' && typeof window.desktopAPI?.invoke === 'function'
    } catch {
      return false
    }
  }

  /**
   * Pure browser localhost dev uses the Vite proxy to avoid CORS.
   * Tauri desktop uses the native IPC bridge instead so dev and build
   * behave the same.
   */
  private shouldUseDevProxy(): boolean {
    try {
      return !this.hasDesktopTransport() && typeof window !== 'undefined' && window.location?.hostname === 'localhost'
    } catch {
      return false
    }
  }

  private buildBrowserUrl(path: string, prefix: string): string {
    if (this.shouldUseDevProxy()) {
      // Encode the real host in the URL path for the Vite proxy:
      // /comfyui-proxy/<encoded-host>/api/prompt
      const encodedHost = encodeURIComponent(this.baseUrl)
      return `/comfyui-proxy/${encodedHost}${prefix}${path}`
    }
    return `${this.baseUrl}${prefix}${path}`
  }

  private buildInit(init?: RequestInit): RequestInit {
    return init ?? {}
  }

  private async requestDesktop(url: string, init?: RequestInit): Promise<Response> {
    const payload: DesktopHttpRequestPayload = {
      url,
      method: init?.method,
      headers: headersToObject(init?.headers),
      bodyBase64: await bodyToBase64(init?.body),
    }
    const response = (await window.desktopAPI.invoke('http:request', payload)) as DesktopHttpResponsePayload
    const bodyBytes = response.bodyBase64 ? decodeBase64ToBytes(response.bodyBase64) : new Uint8Array()
    const normalizedBody = Uint8Array.from(bodyBytes)
    return new Response(new Blob([normalizedBody]), {
      status: response.status,
      headers: response.headers,
    })
  }

  // ─── Fetch with automatic prefix fallback ───────────────────

  private async fetchWithFallback(path: string, init?: RequestInit): Promise<Response> {
    const prefixes = this.apiPrefix !== null ? [this.apiPrefix] : ['/api', '']

    let lastError: unknown
    const fetchInit = this.buildInit(init)

    for (const prefix of prefixes) {
      const url = `${this.baseUrl}${prefix}${path}`
      try {
        const response = this.hasDesktopTransport()
          ? await this.requestDesktop(url, fetchInit)
          : await fetch(this.buildBrowserUrl(path, prefix), fetchInit)
        if (response.status === 404 && this.apiPrefix === null && prefixes.length > 1) {
          lastError = new Error(`404 at ${url}`)
          continue
        }
        this.apiPrefix = prefix
        return response
      } catch (err) {
        lastError = err
        continue
      }
    }

    const detail = lastError instanceof Error && lastError.message ? ` Last error: ${lastError.message}` : ''
    throw new NetworkError(
      `Cannot connect to ComfyUI server at ${this.baseUrl}. Make sure ComfyUI is running and accessible.${detail}`,
      this.baseUrl
    )
  }

  // ─── Public API ─────────────────────────────────────────────

  async queuePrompt(workflow: ComfyUIWorkflow): Promise<ComfyUIPromptResponse> {
    const body = JSON.stringify({ prompt: workflow })

    const response = await this.fetchWithFallback('/prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new ApiError(`ComfyUI returned ${response.status}: ${text}`, text)
    }

    const data = (await response.json()) as ComfyUIPromptResponse
    if (data.node_errors && Object.keys(data.node_errors).length > 0) {
      const errorDetails = JSON.stringify(data.node_errors, null, 2)
      throw new ApiError(`ComfyUI workflow has node errors: ${errorDetails}`, errorDetails)
    }

    return data
  }

  async interrupt(): Promise<void> {
    const response = await this.fetchWithFallback('/interrupt', {
      method: 'POST',
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new ApiError(`Failed to interrupt ComfyUI queue: ${response.status}${text ? ` ${text}` : ''}`)
    }
  }

  async getHistory(promptId: string): Promise<ComfyUIHistoryEntry | null> {
    const response = await this.fetchWithFallback(`/history/${promptId}`)
    if (!response.ok) return null
    const data = (await response.json()) as Record<string, ComfyUIHistoryEntry>
    return data[promptId] ?? null
  }

  async getImage(filename: string, subfolder: string, type: string): Promise<string> {
    const params = new URLSearchParams({ filename, subfolder, type })
    const response = await this.fetchWithFallback(`/view?${params.toString()}`)

    if (!response.ok) {
      throw new ApiError(`Failed to fetch image: ${response.status}`)
    }

    const blob = await response.blob()
    const arrayBuffer = await blob.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    const base64 = btoa(binary)
    const mimeType = blob.type || 'image/png'
    return `data:${mimeType};base64,${base64}`
  }

  async getObjectInfo(): Promise<ComfyUIObjectInfo> {
    const response = await this.fetchWithFallback('/object_info')
    if (!response.ok) {
      throw new ApiError(`Failed to get object info: ${response.status}`)
    }
    return (await response.json()) as ComfyUIObjectInfo
  }

  parseServerInfo(objectInfo: ComfyUIObjectInfo): ComfyUIServerInfo {
    const info: ComfyUIServerInfo = {
      checkpoints: [],
      loras: [],
      samplers: [],
      schedulers: [],
    }

    const ckptNode = objectInfo['CheckpointLoaderSimple']
    if (ckptNode?.input?.required?.ckpt_name) {
      const options = ckptNode.input.required.ckpt_name[0]
      if (Array.isArray(options)) info.checkpoints = options as string[]
    }

    const loraNodeNames = ['LoraLoader', 'LoraLoaderModelOnly', 'Power Lora Loader (rgthree)']
    for (const nodeName of loraNodeNames) {
      if (info.loras.length > 0) break
      const loraNode = objectInfo[nodeName]
      if (loraNode?.input?.required?.lora_name) {
        const options = loraNode.input.required.lora_name[0]
        if (Array.isArray(options)) info.loras = options as string[]
      }
    }

    const samplerNode = objectInfo['KSampler']
    if (samplerNode?.input?.required?.sampler_name) {
      const options = samplerNode.input.required.sampler_name[0]
      if (Array.isArray(options)) info.samplers = options as string[]
    }
    if (samplerNode?.input?.required?.scheduler) {
      const options = samplerNode.input.required.scheduler[0]
      if (Array.isArray(options)) info.schedulers = options as string[]
    }

    return info
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.fetchWithFallback('/system_stats')
      return response.ok
    } catch {
      return false
    }
  }

  async pollForCompletion(
    promptId: string,
    signal?: AbortSignal,
    intervalMs: number = POLL_INTERVAL_MS
  ): Promise<ComfyUIHistoryEntry> {
    const startTime = Date.now()

    while (true) {
      if (signal?.aborted) {
        throw new DOMException('Generation was cancelled', 'AbortError')
      }
      if (Date.now() - startTime > POLL_TIMEOUT_MS) {
        throw new ApiError('ComfyUI generation timed out after 5 minutes')
      }

      const entry = await this.getHistory(promptId)
      if (entry && entry.status?.completed) return entry

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, intervalMs)
        if (signal) {
          signal.addEventListener(
            'abort',
            () => {
              clearTimeout(timer)
              reject(new DOMException('Generation was cancelled', 'AbortError'))
            },
            { once: true }
          )
        }
      })
    }
  }
}
