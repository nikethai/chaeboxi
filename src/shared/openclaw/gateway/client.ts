import type {
  AgentInvokeParams,
  AgentMessage,
  AgentStreamEvent,
  ConnectParams,
  ConnectResponse,
  ConnectionState,
  GatewayInfo,
  GatewayMessage,
  HealthStatus,
  MessageId,
  PresenceUpdate,
  ResponseFrame,
  SessionInfo,
} from './types'
import { createReq, isEvent, isResponse, parseMessage, serializeMessage } from './protocol'
import { buildCloudflareAccessHeaders } from '../../models/utils/openai-headers'

const DEFAULT_PORT = 18789
const DEFAULT_RECONNECT_DELAY_MS = 1000
const MAX_RECONNECT_DELAY_MS = 30000
const DEFAULT_REQUEST_TIMEOUT_MS = 30000
const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
const DEFAULT_MAX_DURATION_MS = 8 * 60 * 60 * 1000 // 8 hours
const LIFECYCLE_CHECK_INTERVAL_MS = 60_000 // 60 seconds

type EventHandler = (event: string, data: unknown) => void
type HealthHandler = (health: HealthStatus) => void
type PresenceHandler = (presence: PresenceUpdate) => void
type AgentEventWaiter = {
  resolve: () => void
  reject: (error: Error) => void
}

type TauriUnlisten = () => void

function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const w = window as Window & {
    __TAURI__?: unknown
    __TAURI_INTERNALS__?: unknown
  }

  return Boolean(w.__TAURI__ || w.__TAURI_INTERNALS__)
}

async function invokeTauri<T>(channel: string, ...args: unknown[]): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke('ipc_invoke', { channel, args }) as Promise<T>
}

async function listenTauriEvent(eventName: string, callback: (payload: unknown) => void): Promise<TauriUnlisten> {
  const { listen } = await import('@tauri-apps/api/event')
  return listen(eventName, (event) => {
    callback(event.payload)
  })
}

export interface GatewayAuth {
  token?: string
  password?: string
  cloudflareClientId?: string
  cloudflareClientSecret?: string
}

export interface GatewayClientOptions {
  idleTimeoutMs?: number
  maxDurationMs?: number
}

export class OpenClawGatewayClient {
  private ws: WebSocket | null = null
  private url: string
  private auth: GatewayAuth
  private shouldReconnect: boolean
  private reconnectDelayMs: number
  private requestTimeoutMs: number
  private idleTimeoutMs: number
  private maxDurationMs: number

  private state: ConnectionState = 'disconnected'
  private info: GatewayInfo | null = null
  private messageId: MessageId = 1
  private lastActivityTs = 0
  private connectedSinceTs = 0
  private lifecycleTimerId: ReturnType<typeof setInterval> | null = null

  private pendingRequests = new Map<
    MessageId,
    {
      resolve: (value: unknown) => void
      reject: (error: Error) => void
      timeoutId: ReturnType<typeof setTimeout>
    }
  >()

  private eventHandlers: EventHandler[] = []
  private healthHandlers: HealthHandler[] = []
  private presenceHandlers: PresenceHandler[] = []

  private reconnectAttempt = 0
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null

  private agentEventQueues = new Map<string, AgentStreamEvent[]>()
  private agentEventResolvers = new Map<string, AgentEventWaiter>()

  // Shared promise for concurrent connect() callers
  private connectPromise: Promise<ConnectResponse> | null = null

  constructor(url: string, auth: GatewayAuth = {}, options: GatewayClientOptions = {}) {
    this.url = normalizeGatewayUrl(url)
    this.auth = auth
    this.shouldReconnect = true
    this.reconnectDelayMs = DEFAULT_RECONNECT_DELAY_MS
    this.requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS
    this.idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS
    this.maxDurationMs = options.maxDurationMs ?? DEFAULT_MAX_DURATION_MS
  }

  private isNativeTauriTransport(): boolean {
    return isTauriRuntime()
  }

  private nextId(): MessageId {
    return this.messageId++
  }

  get connected(): boolean {
    return this.state === 'connected'
  }

  get authenticated(): boolean {
    return this.info !== null
  }

  getGatewayInfo(): GatewayInfo | null {
    return this.info
  }

  getState(): ConnectionState {
    return this.state
  }

  getLastActivityTs(): number {
    return this.lastActivityTs
  }

  getConnectedSinceTs(): number {
    return this.connectedSinceTs
  }

  // Returns existing connect promise if already in-flight (prevents race conditions)
  async connect(): Promise<ConnectResponse> {
    if (this.state === 'connected' && this.info) {
      return {
        status: 'ok',
        stateVersion: this.info.stateVersion,
        uptimeMs: this.info.uptimeMs,
        limits: this.info.limits,
        policy: this.info.policy,
        features: this.info.features,
      }
    }

    if (this.connectPromise) {
      return this.connectPromise
    }

    if (this.isNativeTauriTransport()) {
      this.connectPromise = this.connectViaTauri()
      try {
        return await this.connectPromise
      } finally {
        this.connectPromise = null
      }
    }

    this.connectPromise = this.doConnect()
    try {
      return await this.connectPromise
    } finally {
      this.connectPromise = null
    }
  }

  private async connectViaTauri(): Promise<ConnectResponse> {
    this.state = 'connecting'
    const response = await invokeTauri<ConnectResponse>('openclaw:test-connection', {
      url: this.url,
      auth: this.auth,
    })
    this.info = { url: this.url, ...response }
    this.state = 'connected'
    this.reconnectAttempt = 0
    this.connectedSinceTs = Date.now()
    this.lastActivityTs = Date.now()
    return response
  }

  private async doConnect(): Promise<ConnectResponse> {
    this.state = 'connecting'

    // CF Access preflight — best-effort cookie seeding before WS upgrade.
    // May fail due to CORS in Tauri WebView (tauri://localhost origin).
    // When it fails, WS connect still proceeds — it may work if the user
    // has a valid CF Access SSO session cookie in the WebView.
    await this.preflightCfAccess()

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          this.state = 'authenticating'

          const connectParams: ConnectParams = {
            role: 'operator',
            auth: this.auth.token
              ? { token: this.auth.token }
              : this.auth.password
                ? { password: this.auth.password }
                : undefined,
          }

          const id = this.nextId()
          const req = createReq(id, 'connect', connectParams)

          const timeoutId = setTimeout(() => {
            this.pendingRequests.delete(id)
            if (this.state === 'authenticating') {
              this.disconnect()
              reject(new Error('Connection timeout'))
            }
          }, this.requestTimeoutMs)

          // Route through pendingRequests so handleMessage resolves it
          this.pendingRequests.set(id, {
            resolve: (payload) => {
              const response = payload as ConnectResponse
              this.info = { url: this.url, ...response }
              this.state = 'connected'
              this.reconnectAttempt = 0
              this.startLifecycleTimer()
              resolve(response)
            },
            reject: (error) => {
              this.state = 'error'
              reject(error)
            },
            timeoutId,
          })

          this.sendFrame(req)
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data)
        }

        this.ws.onerror = () => {
          if (this.state === 'connecting' || this.state === 'authenticating') {
            reject(new Error('WebSocket connection error'))
          }
        }

        this.ws.onclose = () => {
          this.stopLifecycleTimer()
          this.rejectPendingAgentWaiters(new Error('Connection closed during agent invocation'))
          this.agentEventQueues.clear()

          if (this.state === 'connected' && this.shouldReconnect) {
            this.scheduleReconnect()
          } else if (this.state !== 'disconnected') {
            this.state = 'error'
          }
        }
      } catch (err) {
        this.state = 'error'
        reject(err)
      }
    })
  }

  disconnect(): void {
    this.shouldReconnect = false
    this.stopLifecycleTimer()

    if (this.isNativeTauriTransport()) {
      this.info = null
      this.state = 'disconnected'
      this.connectPromise = null
      this.lastActivityTs = 0
      this.connectedSinceTs = 0
      return
    }

    if (this.reconnectTimeoutId !== null) {
      clearTimeout(this.reconnectTimeoutId)
      this.reconnectTimeoutId = null
    }

    if (this.ws !== null) {
      this.ws.close()
      this.ws = null
    }

    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeoutId)
      pending.reject(new Error('Connection closed'))
    }
    this.pendingRequests.clear()

    this.rejectPendingAgentWaiters(new Error('Connection closed during agent invocation'))

    // Clean up all handler arrays and queues
    this.eventHandlers.length = 0
    this.healthHandlers.length = 0
    this.presenceHandlers.length = 0
    this.agentEventQueues.clear()
    this.agentEventResolvers.clear()

    this.info = null
    this.state = 'disconnected'
    this.connectPromise = null
  }

  async reconnect(): Promise<void> {
    if (this.state === 'connected') {
      return
    }

    this.shouldReconnect = true
    this.state = 'reconnecting'

    await new Promise<void>((resolve) => {
      this.reconnectTimeoutId = setTimeout(() => {
        this.reconnectTimeoutId = null
        resolve()
      }, this.getReconnectDelay())
    })

    if (this.shouldReconnect) {
      try {
        await this.connect()
      } catch {
        // scheduleReconnect handles further attempts
      }
    }
  }

  request<T>(method: string, params?: Record<string, unknown> | object, timeoutMs?: number): Promise<T> {
    if (this.ws === null || this.state !== 'connected') {
      return Promise.reject(new Error('Not connected'))
    }

    const id = this.nextId()
    const req = createReq(id, method, params)
    const timeout = timeoutMs ?? this.requestTimeoutMs

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error(`Request ${method} timed out after ${timeout}ms`))
      }, timeout)

      this.pendingRequests.set(id, {
        resolve: (payload) => resolve(payload as T),
        reject,
        timeoutId,
      })

      this.sendFrame(req)
    })
  }

  listAgents(): Promise<{
    agents: Array<{ id: string; name: string; description?: string; capabilities?: string[] }>
  }> {
    if (this.isNativeTauriTransport()) {
      this.touchActivity()
      return invokeTauri('openclaw:list-agents', {
        url: this.url,
        auth: this.auth,
      })
    }
    return this.request('agents.list', {})
  }

  listSessions(): Promise<{ sessions: SessionInfo[] }> {
    if (this.isNativeTauriTransport()) {
      this.touchActivity()
      return invokeTauri('openclaw:list-sessions', {
        url: this.url,
        auth: this.auth,
      })
    }
    return this.request('sessions.list', {})
  }

  async *invokeAgent(
    agentId: string,
    message: AgentMessage,
    sessionId?: string,
    signal?: AbortSignal
  ): AsyncGenerator<AgentStreamEvent, void, unknown> {
    if (this.isNativeTauriTransport()) {
      yield* this.invokeAgentViaTauri(agentId, message, sessionId, signal)
      return
    }

    if (this.ws === null || this.state !== 'connected') {
      throw new Error('Not connected')
    }

    const params: AgentInvokeParams = {
      agent: agentId,
      message,
      session: sessionId,
    }

    const response = await this.request<{ status: string; invocationId?: string }>('agent', params)

    if (response.status !== 'accepted' || !response.invocationId) {
      throw new Error(`Agent invocation not accepted: ${response.status}`)
    }

    const invocationId = response.invocationId
    this.agentEventQueues.set(invocationId, this.agentEventQueues.get(invocationId) ?? [])

    const agentEventHandler = (event: string, data: unknown) => {
      if (event !== 'agent' || !data) return
      const agentData = data as AgentStreamEvent
      if (!('invocationId' in agentData)) return

      const queue = this.agentEventQueues.get(agentData.invocationId)
      if (!queue) return

      queue.push(agentData)
      const waiter = this.agentEventResolvers.get(agentData.invocationId)
      if (waiter) {
        waiter.resolve()
        this.agentEventResolvers.delete(agentData.invocationId)
      }
    }

    this.onEvent(agentEventHandler)

    const abortHandler = signal
      ? () => this.sendFrame(createReq(this.nextId(), 'agent.cancel', { invocationId }))
      : undefined

    if (signal && abortHandler) {
      signal.addEventListener('abort', abortHandler)
    }

    try {
      while (true) {
        const queue = this.agentEventQueues.get(invocationId)
        if (!queue) {
          if (this.state !== 'connected' || this.ws === null) {
            throw new Error('Connection closed during agent invocation')
          }
          break
        }

        if (queue.length === 0) {
          if (this.state !== 'connected' || this.ws === null) {
            throw new Error('Connection closed during agent invocation')
          }

          await new Promise<void>((resolve, reject) => {
            this.agentEventResolvers.set(invocationId, { resolve, reject })
          })
          continue
        }

        const event = queue.shift()!
        yield event

        if (event.type === 'done' || signal?.aborted) {
          break
        }
      }
    } finally {
      this.offEvent(agentEventHandler)
      this.agentEventQueues.delete(invocationId)
      this.agentEventResolvers.delete(invocationId)

      if (signal && abortHandler) {
        signal.removeEventListener('abort', abortHandler)
      }
    }
  }

  private async *invokeAgentViaTauri(
    agentId: string,
    message: AgentMessage,
    sessionId?: string,
    signal?: AbortSignal
  ): AsyncGenerator<AgentStreamEvent, void, unknown> {
    const streamId = crypto.randomUUID()
    const eventName = `openclaw:stream:${streamId}`
    const queue: AgentStreamEvent[] = []
    let wake: (() => void) | null = null

    const unlisten = await listenTauriEvent(eventName, (payload) => {
      queue.push(payload as AgentStreamEvent)
      this.touchActivity()
      wake?.()
      wake = null
    })

    const abortHandler = signal
      ? () => {
          void invokeTauri('openclaw:cancel-invoke', streamId).catch((error) => {
            console.error('[OpenClaw] Failed to cancel native invocation:', error)
          })
          wake?.()
          wake = null
        }
      : undefined

    if (signal && abortHandler) {
      signal.addEventListener('abort', abortHandler)
    }

    try {
      await invokeTauri<{ invocationId: string }>('openclaw:invoke-agent', {
        streamId,
        url: this.url,
        auth: this.auth,
        agentId,
        message,
        sessionId,
      })

      while (true) {
        if (queue.length === 0) {
          if (signal?.aborted) {
            break
          }

          await new Promise<void>((resolve) => {
            wake = resolve
          })
          continue
        }

        const event = queue.shift()!
        yield event

        if (event.type === 'done' || signal?.aborted) {
          break
        }
      }
    } finally {
      unlisten()
      if (signal && abortHandler) {
        signal.removeEventListener('abort', abortHandler)
      }
      void invokeTauri('openclaw:close-stream', streamId).catch(() => {})
    }
  }

  onEvent(handler: EventHandler): void {
    this.eventHandlers.push(handler)
  }

  offEvent(handler: EventHandler): void {
    const index = this.eventHandlers.indexOf(handler)
    if (index !== -1) this.eventHandlers.splice(index, 1)
  }

  onHealth(handler: HealthHandler): void {
    this.healthHandlers.push(handler)
  }

  offHealth(handler: HealthHandler): void {
    const index = this.healthHandlers.indexOf(handler)
    if (index !== -1) this.healthHandlers.splice(index, 1)
  }

  onPresence(handler: PresenceHandler): void {
    this.presenceHandlers.push(handler)
  }

  offPresence(handler: PresenceHandler): void {
    const index = this.presenceHandlers.indexOf(handler)
    if (index !== -1) this.presenceHandlers.splice(index, 1)
  }

  private sendFrame(frame: GatewayMessage): void {
    if (this.ws !== null && this.ws.readyState === WebSocket.OPEN) {
      this.touchActivity()
      this.ws.send(serializeMessage(frame))
    }
  }

  private handleMessage(data: string): void {
    this.touchActivity()
    let parsed: GatewayMessage | null
    try {
      parsed = parseMessage(JSON.parse(data))
    } catch {
      return
    }

    if (parsed === null) return

    if (isResponse(parsed)) {
      this.resolveResponse(parsed)
      return
    }

    if (isEvent(parsed)) {
      this.handleEvent(parsed)
    }
  }

  private resolveResponse(res: ResponseFrame): void {
    const pending = this.pendingRequests.get(res.id)
    if (!pending) return

    clearTimeout(pending.timeoutId)
    this.pendingRequests.delete(res.id)

    if (res.ok) {
      pending.resolve(res.payload)
    } else {
      pending.reject(new Error(res.error?.message ?? 'Request failed'))
    }
  }

  private handleEvent(event: { type: 'event'; event: string; data?: unknown }): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event.event, event.data)
      } catch (err) {
        console.error('[OpenClaw] Event handler error:', err)
      }
    }

    switch (event.event) {
      case 'health':
        for (const handler of this.healthHandlers) {
          try {
            handler(event.data as HealthStatus)
          } catch (err) {
            console.error('[OpenClaw] Health handler error:', err)
          }
        }
        break
      case 'presence':
        for (const handler of this.presenceHandlers) {
          try {
            handler(event.data as PresenceUpdate)
          } catch (err) {
            console.error('[OpenClaw] Presence handler error:', err)
          }
        }
        break
      case 'shutdown':
        this.disconnect()
        break
      case 'heartbeat':
        this.touchActivity()
        break
    }
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return

    this.state = 'reconnecting'
    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null
      if (this.shouldReconnect) {
        this.reconnect().catch(() => {})
      }
    }, this.getReconnectDelay())
  }

  private getReconnectDelay(): number {
    const delay = Math.min(this.reconnectDelayMs * 2 ** this.reconnectAttempt, MAX_RECONNECT_DELAY_MS)
    this.reconnectAttempt++
    return delay
  }

  private rejectPendingAgentWaiters(error: Error): void {
    for (const [, waiter] of this.agentEventResolvers) {
      waiter.reject(error)
    }
    this.agentEventResolvers.clear()
  }

  private touchActivity(): void {
    this.lastActivityTs = Date.now()
  }

  /**
   * Best-effort CF Access cookie seeding for remote gateways.
   *
   * Sends an HTTP request with CF-Access-Client-Id / CF-Access-Client-Secret
   * headers to /health. If CF Access accepts the token, it returns a
   * Set-Cookie: CF_Authorization=... which the WebView may auto-attach to
   * the subsequent WebSocket upgrade request.
   *
   * This is best-effort because Tauri WebView's origin (tauri://localhost)
   * triggers CORS restrictions that may block the fetch. When it fails,
   * the WS connect still proceeds — it will work if the user has a valid
   * CF Access SSO session cookie in the WebView.
   *
   * TODO: Implement Rust-side preflight via Tauri IPC to bypass WebView
   * CORS restrictions. This would make Service Token auth reliable for WS.
   */
  private async preflightCfAccess(): Promise<void> {
    const { cloudflareClientId, cloudflareClientSecret } = this.auth
    if (!cloudflareClientId || !cloudflareClientSecret) return

    const httpUrl = wsToHttpUrl(this.url)
    if (isLocalhostUrl(httpUrl)) return

    const headers = buildCloudflareAccessHeaders({
      cloudflareClientId,
      cloudflareClientSecret,
    })

    const preflightUrl = httpUrl.replace(/\/+$/, '') + '/health'
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // Short timeout — best effort

    try {
      const response = await fetch(preflightUrl, {
        method: 'GET',
        headers,
        credentials: 'include',
        signal: controller.signal,
      })

      if (response.status === 403) {
        console.warn(
          '[OpenClaw] CF Access preflight returned 403 — Service Token may be invalid.',
          'WebSocket connect will still be attempted.'
        )
      }
    } catch {
      // Expected to fail in Tauri WebView due to CORS.
      // WS connect proceeds — may succeed via existing SSO session cookie.
      console.warn(
        '[OpenClaw] CF Access preflight failed (likely CORS in Tauri WebView).',
        'WebSocket connect will still be attempted.',
        'For reliable CF Access Service Token auth, a Rust-side preflight is needed.'
      )
    } finally {
      clearTimeout(timeoutId)
    }
  }

  private startLifecycleTimer(): void {
    this.connectedSinceTs = Date.now()
    this.lastActivityTs = Date.now()

    this.lifecycleTimerId = setInterval(() => {
      const now = Date.now()

      // Max connection duration — force reconnect to refresh CF Access session
      if (now - this.connectedSinceTs > this.maxDurationMs) {
        this.forceReconnect()
        return
      }

      // Idle timeout — disconnect to release resources
      if (now - this.lastActivityTs > this.idleTimeoutMs) {
        this.disconnect()
      }
    }, LIFECYCLE_CHECK_INTERVAL_MS)
  }

  private stopLifecycleTimer(): void {
    if (this.lifecycleTimerId !== null) {
      clearInterval(this.lifecycleTimerId)
      this.lifecycleTimerId = null
    }
  }

  private forceReconnect(): void {
    this.stopLifecycleTimer()
    if (this.ws !== null) {
      this.shouldReconnect = true
      this.ws.close()
      this.ws = null
    }
  }
}

/** Convert http(s):// URLs to ws(s):// and ensure port is present */
export function normalizeGatewayUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) {
    return `ws://127.0.0.1:${DEFAULT_PORT}`
  }

  const normalized =
    trimmed.startsWith('ws://') || trimmed.startsWith('wss://')
      ? trimmed
      : trimmed.startsWith('https://')
        ? trimmed.replace(/^https:\/\//, 'wss://')
        : trimmed.startsWith('http://')
          ? trimmed.replace(/^http:\/\//, 'ws://')
          : `ws://${trimmed}`

  try {
    const parsed = new URL(normalized)
    if (!parsed.port && isLocalhostHostname(parsed.hostname)) {
      parsed.port = String(DEFAULT_PORT)
    }
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return normalized
  }
}

/** Convert ws(s):// URL to http(s):// for preflight requests */
export function wsToHttpUrl(wsUrl: string): string {
  return wsUrl.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://')
}

/** Check if URL points to a loopback address */
export function isLocalhostUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return isLocalhostHostname(parsed.hostname)
  } catch {
    return false
  }
}

function isLocalhostHostname(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1'
}

export type GatewaySecurityLevel = 'safe' | 'warning' | 'danger'

export interface GatewayUrlAnalysis {
  isLocalhost: boolean
  isSecure: boolean
  securityLevel: GatewaySecurityLevel
  warning?: string
}

/**
 * Analyze a gateway URL for security posture.
 * - localhost + any protocol → safe
 * - remote + wss:// → warning (internet traversal)
 * - remote + ws:// → danger (plaintext WebSocket)
 */
export function analyzeGatewayUrl(rawUrl: string): GatewayUrlAnalysis {
  const normalized = normalizeGatewayUrl(rawUrl)
  const isLocal = isLocalhostUrl(wsToHttpUrl(normalized))
  const isWss = normalized.startsWith('wss://')

  if (isLocal) {
    return { isLocalhost: true, isSecure: true, securityLevel: 'safe' }
  }

  if (isWss) {
    return {
      isLocalhost: false,
      isSecure: true,
      securityLevel: 'warning',
      warning: 'Remote connection over WSS. Ensure the endpoint is trusted.',
    }
  }

  return {
    isLocalhost: false,
    isSecure: false,
    securityLevel: 'danger',
    warning:
      'Plaintext WebSocket (ws://) to a remote host. Credentials and messages are sent unencrypted. Use wss:// or a Cloudflare Tunnel.',
  }
}
