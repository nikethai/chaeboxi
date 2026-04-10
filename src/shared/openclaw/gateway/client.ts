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

const DEFAULT_PORT = 18789
const DEFAULT_RECONNECT_DELAY_MS = 1000
const MAX_RECONNECT_DELAY_MS = 30000
const DEFAULT_REQUEST_TIMEOUT_MS = 30000

type EventHandler = (event: string, data: unknown) => void
type HealthHandler = (health: HealthStatus) => void
type PresenceHandler = (presence: PresenceUpdate) => void
type AgentEventWaiter = {
  resolve: () => void
  reject: (error: Error) => void
}

export class OpenClawGatewayClient {
  private ws: WebSocket | null = null
  private url: string
  private auth: { token?: string; password?: string }
  private shouldReconnect: boolean
  private reconnectDelayMs: number
  private requestTimeoutMs: number

  private state: ConnectionState = 'disconnected'
  private info: GatewayInfo | null = null
  private messageId: MessageId = 1

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

  constructor(url: string, auth: { token?: string; password?: string } = {}) {
    this.url = normalizeGatewayUrl(url)
    this.auth = auth
    this.shouldReconnect = true
    this.reconnectDelayMs = DEFAULT_RECONNECT_DELAY_MS
    this.requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS
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

    this.connectPromise = this.doConnect()
    try {
      return await this.connectPromise
    } finally {
      this.connectPromise = null
    }
  }

  private doConnect(): Promise<ConnectResponse> {
    this.state = 'connecting'

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

  request<T>(method: string, params?: Record<string, unknown>, timeoutMs?: number): Promise<T> {
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
    return this.request('agents.list', {})
  }

  listSessions(): Promise<{ sessions: SessionInfo[] }> {
    return this.request('sessions.list', {})
  }

  async *invokeAgent(
    agentId: string,
    message: AgentMessage,
    sessionId?: string,
    signal?: AbortSignal
  ): AsyncGenerator<AgentStreamEvent, void, unknown> {
    if (this.ws === null || this.state !== 'connected') {
      throw new Error('Not connected')
    }

    const invocationId = crypto.randomUUID()
    this.agentEventQueues.set(invocationId, [])

    const params: AgentInvokeParams = {
      agent: agentId,
      message,
      session: sessionId,
    }

    const response = await this.request<{ status: string; invocationId?: string }>('agent', params)

    if (response.status !== 'accepted') {
      this.agentEventQueues.delete(invocationId)
      throw new Error(`Agent invocation not accepted: ${response.status}`)
    }

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
      this.ws.send(serializeMessage(frame))
    }
  }

  private handleMessage(data: string): void {
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
}

/** Convert http(s):// URLs to ws(s):// and ensure port is present */
export function normalizeGatewayUrl(url: string): string {
  if (url.startsWith('ws://') || url.startsWith('wss://')) return url

  let normalized = url.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://')

  if (!normalized.match(/:\d+/)) {
    normalized += `:${DEFAULT_PORT}`
  }

  return normalized
}
