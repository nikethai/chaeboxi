// OpenClaw Gateway WebSocket client implementation

import type {
  AgentInvokeParams,
  AgentMessage,
  AgentStreamEvent,
  ConnectParams,
  ConnectResponse,
  ConnectionState,
  GatewayError,
  GatewayInfo,
  GatewayMessage,
  HealthStatus,
  MessageId,
  PresenceUpdate,
  RequestFrame,
  ResponseFrame,
  SessionInfo,
} from './types'
import {
  createReq,
  isEvent,
  isResponse,
  parseMessage,
  serializeMessage,
} from './protocol'

const DEFAULT_PORT = 18789
const DEFAULT_RECONNECT_DELAY_MS = 1000
const MAX_RECONNECT_DELAY_MS = 30000
const DEFAULT_REQUEST_TIMEOUT_MS = 30000

type EventHandler = (event: string, data: unknown) => void
type HealthHandler = (health: HealthStatus) => void
type PresenceHandler = (presence: PresenceUpdate) => void

/**
 * OpenClaw Gateway WebSocket client for connecting to the OpenClaw gateway
 */
export class OpenClawGatewayClient {
  private ws: WebSocket | null = null
  private url: string
  private auth: { token?: string; password?: string }
  private shouldReconnect: boolean
  private reconnectDelayMs: number
  private requestTimeoutMs: number

  private state: ConnectionState = 'disconnected'
  private gatewayInfo: GatewayInfo | null = null
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

  // Queue for streaming agent events
  private agentEventQueues = new Map<string, AgentStreamEvent[]>()
  private agentEventResolvers = new Map<string, () => void>()

  // Map to track wrapped handlers for removal
  private wrappedHandlers = new Map<EventHandler, (event: string, data: unknown) => void>()

  constructor(url: string, auth: { token?: string; password?: string } = {}) {
    // Convert http://host:port to ws://host:port if needed
    this.url = this.normalizeUrl(url)
    this.auth = auth
    this.shouldReconnect = true
    this.reconnectDelayMs = DEFAULT_RECONNECT_DELAY_MS
    this.requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS
  }

  /**
   * Normalize URL to WebSocket format
   */
  private normalizeUrl(url: string): string {
    // Already ws:// or wss://
    if (url.startsWith('ws://') || url.startsWith('wss://')) {
      return url
    }

    // Convert http:// or https:// to ws:// or wss://
    let normalized = url.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://')

    // Add default port if not specified
    if (!normalized.includes(':')) {
      normalized += `:${DEFAULT_PORT}`
    }

    return normalized
  }

  /**
   * Get the next message ID
   */
  private nextId(): MessageId {
    return this.messageId++
  }

  /**
   * Get current connection state
   */
  get connected(): boolean {
    return this.state === 'connected'
  }

  /**
   * Get authentication state
   */
  get authenticated(): boolean {
    return this.gatewayInfo !== null
  }

  /**
   * Get gateway info if connected
   */
  getGatewayInfo(): GatewayInfo | null {
    return this.gatewayInfo
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state
  }

  /**
   * Connect to the gateway and authenticate
   */
  async connect(): Promise<ConnectResponse> {
    if (this.state === 'connected' || this.state === 'authenticating') {
      throw new Error('Already connected or connecting')
    }

    this.state = 'connecting'

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          this.state = 'authenticating'

          // Send connect request
          const connectParams: ConnectParams = {
            role: 'operator',
            auth: this.auth.token
              ? { token: this.auth.token }
              : this.auth.password
                ? { password: this.auth.password }
                : undefined,
          }

          const req = createReq(this.nextId(), 'connect', connectParams)
          this.sendFrame(req)

          // Set up one-time handler for connect response
          const responseHandler = (msg: GatewayMessage) => {
            if (!isResponse(msg) || msg.id !== req.id) {
              return
            }

            this.removeMessageHandler(responseHandler)

            if (msg.ok) {
              this.gatewayInfo = {
                url: this.url,
                ...(msg.payload as ConnectResponse),
              }
              this.state = 'connected'
              this.reconnectAttempt = 0
              resolve(msg.payload as ConnectResponse)
            } else {
              const error = msg.error as GatewayError
              this.state = 'error'
              reject(new Error(`Connection failed: ${error?.message ?? 'Unknown error'}`))
            }
          }

          this.addMessageHandler(responseHandler)

          // Set up timeout for connect
          setTimeout(() => {
            this.removeMessageHandler(responseHandler)
            if (this.state === 'authenticating') {
              this.disconnect()
              reject(new Error('Connection timeout'))
            }
          }, this.requestTimeoutMs)
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data)
        }

        this.ws.onerror = () => {
          if (this.state === 'authenticating') {
            reject(new Error('WebSocket connection error'))
          }
        }

        this.ws.onclose = () => {
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

  /**
   * Disconnect from the gateway
   */
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

    // Reject all pending requests
    for (const [_id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeoutId)
      pending.reject(new Error('Connection closed'))
    }
    this.pendingRequests.clear()

    this.gatewayInfo = null
    this.state = 'disconnected'
  }

  /**
   * Reconnect to the gateway with exponential backoff
   */
  async reconnect(): Promise<void> {
    if (this.state === 'connected') {
      return
    }

    this.shouldReconnect = true
    this.state = 'reconnecting'

    const delay = Math.min(
      this.reconnectDelayMs * Math.pow(2, this.reconnectAttempt),
      MAX_RECONNECT_DELAY_MS
    )

    this.reconnectAttempt++

    await new Promise<void>((resolve) => {
      this.reconnectTimeoutId = setTimeout(() => {
        this.reconnectTimeoutId = null
        resolve()
      }, delay)
    })

    if (this.shouldReconnect) {
      try {
        await this.connect()
      } catch {
        // Will schedule another reconnect if still should reconnect
      }
    }
  }

  /**
   * Send a request and wait for response
   */
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

      this.pendingRequests.set(id, { resolve, reject, timeoutId })
      this.sendFrame(req)

      // Handler to process response
      const responseHandler = (msg: GatewayMessage) => {
        if (!isResponse(msg) || msg.id !== id) {
          return
        }

        clearTimeout(timeoutId)
        this.pendingRequests.delete(id)
        this.removeMessageHandler(responseHandler)

        if (msg.ok) {
          resolve(msg.payload as T)
        } else {
          const error = msg.error as GatewayError
          reject(new Error(error?.message ?? `Request ${method} failed`))
        }
      }

      this.addMessageHandler(responseHandler)
    })
  }

  /**
   * List available agents
   */
  listAgents(): Promise<{ agents: Array<{ id: string; name: string; description?: string; capabilities?: string[] }> }> {
    return this.request('agents.list', {})
  }

  /**
   * List sessions
   */
  listSessions(): Promise<{ sessions: SessionInfo[] }> {
    return this.request('sessions.list', {})
  }

  /**
   * Invoke an agent and get streaming response as an async generator
   */
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

    // Initialize queue for this invocation
    this.agentEventQueues.set(invocationId, [])

    const params: AgentInvokeParams = {
      agent: agentId,
      message,
      session: sessionId,
    }

    // Send agent invoke request
    const response = await this.request<{ status: string; invocationId?: string }>(
      'agent',
      params
    )

    if (response.status !== 'accepted') {
      this.agentEventQueues.delete(invocationId)
      throw new Error(`Agent invocation not accepted: ${response.status}`)
    }

    // Listen for agent events - route to the appropriate queue
    const agentEventHandler = (event: string, data: unknown) => {
      if (event === 'agent' && data) {
        const agentData = data as AgentStreamEvent
        if ('invocationId' in agentData) {
          const queue = this.agentEventQueues.get(agentData.invocationId)
          if (queue) {
            queue.push(agentData)
            // Resolve any pending waiters
            const resolver = this.agentEventResolvers.get(agentData.invocationId)
            if (resolver) {
              resolver()
              this.agentEventResolvers.delete(agentData.invocationId)
            }
          }
        }
      }
    }

    this.onEvent(agentEventHandler)

    try {
      // Set up abort signal handling
      const abortHandler = () => {
        this.sendFrame(
          createReq(this.nextId(), 'agent.cancel', { invocationId })
        )
      }

      if (signal) {
        signal.addEventListener('abort', abortHandler)
      }

      // Yield events from the queue as they arrive
      while (true) {
        const queue = this.agentEventQueues.get(invocationId)
        if (!queue || queue.length === 0) {
          // Check for done status
          const doneEvent = this.agentEventQueues.get(invocationId)?.find(
            (e) => e.type === 'done'
          )
          if (doneEvent) {
            break
          }

          // Wait for more events
          await new Promise<void>((resolve) => {
            this.agentEventResolvers.set(invocationId, resolve)
            // Short timeout to check again
            setTimeout(resolve, 100)
          }).catch(() => {})
        }

        const event = this.agentEventQueues.get(invocationId)?.shift()
        if (event) {
          yield event
          if (event.type === 'done') {
            break
          }
        }

        // Check if signal is aborted
        if (signal?.aborted) {
          break
        }
      }
    } finally {
      this.offEvent(agentEventHandler)
      this.agentEventQueues.delete(invocationId)
      this.agentEventResolvers.delete(invocationId)

      if (signal) {
        signal.removeEventListener('abort', abortHandler)
      }
    }
  }

  /**
   * Register an event handler for all gateway events
   */
  onEvent(handler: EventHandler): void {
    this.eventHandlers.push(handler)
  }

  /**
   * Remove an event handler
   */
  offEvent(handler: EventHandler): void {
    const index = this.eventHandlers.indexOf(handler)
    if (index !== -1) {
      this.eventHandlers.splice(index, 1)
    }
  }

  /**
   * Register a handler for health events
   */
  onHealth(handler: HealthHandler): void {
    this.healthHandlers.push(handler)
  }

  /**
   * Remove a health handler
   */
  offHealth(handler: HealthHandler): void {
    const index = this.healthHandlers.indexOf(handler)
    if (index !== -1) {
      this.healthHandlers.splice(index, 1)
    }
  }

  /**
   * Register a handler for presence updates
   */
  onPresence(handler: PresenceHandler): void {
    this.presenceHandlers.push(handler)
  }

  /**
   * Remove a presence handler
   */
  offPresence(handler: PresenceHandler): void {
    const index = this.presenceHandlers.indexOf(handler)
    if (index !== -1) {
      this.presenceHandlers.splice(index, 1)
    }
  }

  /**
   * Send a frame over the WebSocket
   */
  private sendFrame(frame: GatewayMessage): void {
    if (this.ws !== null && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(serializeMessage(frame))
    }
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: string): void {
    let parsed: GatewayMessage | null
    try {
      parsed = parseMessage(JSON.parse(data))
    } catch {
      console.warn('Failed to parse gateway message:', data)
      return
    }

    if (parsed === null) {
      console.warn('Invalid gateway message:', data)
      return
    }

    // Check if it's a response to a pending request
    if (isResponse(parsed)) {
      const pending = this.pendingRequests.get(parsed.id)
      if (pending !== undefined) {
        clearTimeout(pending.timeoutId)
        this.pendingRequests.delete(parsed.id)

        if (parsed.ok) {
          pending.resolve(parsed.payload)
        } else {
          const error = parsed.error as GatewayError
          pending.reject(new Error(error?.message ?? 'Request failed'))
        }
        return
      }
    }

    // Handle event messages
    if (isEvent(parsed)) {
      this.handleEvent(parsed)
    }
  }

  /**
   * Handle incoming event
   */
  private handleEvent(event: { type: 'event'; event: string; data?: unknown }): void {
    // Notify all event handlers
    for (const handler of this.eventHandlers) {
      try {
        handler(event.event, event.data)
      } catch (err) {
        console.error('Event handler error:', err)
      }
    }

    // Handle specific event types
    switch (event.event) {
      case 'health':
        for (const handler of this.healthHandlers) {
          try {
            handler(event.data as HealthStatus)
          } catch (err) {
            console.error('Health handler error:', err)
          }
        }
        break

      case 'presence':
        for (const handler of this.presenceHandlers) {
          try {
            handler(event.data as PresenceUpdate)
          } catch (err) {
            console.error('Presence handler error:', err)
          }
        }
        break

      case 'shutdown':
        this.handleShutdown()
        break
    }
  }

  /**
   * Handle shutdown event
   */
  private handleShutdown(): void {
    this.disconnect()
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (!this.shouldReconnect) {
      return
    }

    this.state = 'reconnecting'

    const delay = Math.min(
      this.reconnectDelayMs * Math.pow(2, this.reconnectAttempt),
      MAX_RECONNECT_DELAY_MS
    )

    this.reconnectAttempt++

    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null
      if (this.shouldReconnect) {
        this.reconnect().catch(() => {
          // Will schedule another reconnect if needed
        })
      }
    }, delay)
  }

  /**
   * Add a temporary message handler for request/response matching
   */
  private addMessageHandler(handler: (msg: GatewayMessage) => void): void {
    const wrappedHandler = (event: string, data: unknown) => {
      if (event === 'internal') {
        handler(data as GatewayMessage)
      }
    }
    this.wrappedHandlers.set(handler, wrappedHandler)
    this.eventHandlers.push(wrappedHandler)
  }

  /**
   * Remove a message handler
   */
  private removeMessageHandler(handler: (msg: GatewayMessage) => void): void {
    const wrappedHandler = this.wrappedHandlers.get(handler)
    if (wrappedHandler) {
      const index = this.eventHandlers.indexOf(wrappedHandler)
      if (index !== -1) {
        this.eventHandlers.splice(index, 1)
      }
      this.wrappedHandlers.delete(handler)
    }
  }
}
