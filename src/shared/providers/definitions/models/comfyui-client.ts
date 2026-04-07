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
    let url = baseUrl.trim().replace(/\/+$/, '')
    // Auto-prepend http:// if no protocol is specified
    if (url && !/^https?:\/\//i.test(url)) {
      url = `http://${url}`
    }
    this.baseUrl = url
  }

  /**
   * When running in a browser dev server (localhost), route requests
   * through the Vite proxy to avoid CORS. In Tauri/production,
   * fetch directly.
   */
  private isDevBrowser(): boolean {
    try {
      return typeof window !== 'undefined' &&
        window.location?.hostname === 'localhost'
    } catch {
      return false
    }
  }

  private buildUrl(path: string, prefix: string): string {
    if (this.isDevBrowser()) {
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

  // ─── Fetch with automatic prefix fallback ───────────────────

  private async fetchWithFallback(
    path: string,
    init?: RequestInit,
  ): Promise<Response> {
    const prefixes = this.apiPrefix !== null
      ? [this.apiPrefix]
      : ['/api', '']

    let lastError: unknown
    const fetchInit = this.buildInit(init)

    for (const prefix of prefixes) {
      const url = this.buildUrl(path, prefix)
      try {
        const response = await fetch(url, fetchInit)
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

    throw new NetworkError(
      `Cannot connect to ComfyUI server at ${this.baseUrl}. Make sure ComfyUI is running and accessible.`,
      this.baseUrl,
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
    intervalMs: number = POLL_INTERVAL_MS,
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
          signal.addEventListener('abort', () => {
            clearTimeout(timer)
            reject(new DOMException('Generation was cancelled', 'AbortError'))
          }, { once: true })
        }
      })
    }
  }
}
