/**
 * OpenClaw Gateway WebSocket Client
 *
 * Connects to the OpenClaw Gateway (default: ws://127.0.0.1:18789) and provides
 * RPC-style method calls and event subscriptions for agent interaction.
 */

export interface OpenClawAgent {
  id: string
  name: string
  description?: string
  capabilities?: string[]
}

export interface OpenClawMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface OpenClawInvokeResult {
  text: string
  toolCalls?: Array<{
    toolCallId: string
    toolName: string
    args: Record<string, unknown>
  }>
}

export type OpenClawStreamEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'reasoning-delta'; text: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; args: Record<string, unknown> }
  | { type: 'tool-result'; toolCallId: string; result: unknown }
  | { type: 'tool-error'; toolCallId: string; error: string }
  | { type: 'finish'; reason?: string }
  | { type: 'error'; error: string }

interface GatewayRequest {
  type: 'req'
  id: string
  method: string
  params: Record<string, unknown>
}

interface GatewayResponse {
  type: 'res'
  id: string
  ok: boolean
  payload?: unknown
  error?: { code: string; message: string }
}

interface GatewayEvent {
  type: 'event'
  event: string
  payload: unknown
  seq?: number
  stateVersion?: number
}

interface ChallengePayload {
  nonce: string
  timestamp: number
}

interface HelloOkPayload {
  protocolVersion: string
  policy: unknown
}

/**
 * WebSocket-based client for OpenClaw Gateway communication.
 * Handles connection, authentication, RPC requests, and event subscriptions.
 */
export class OpenClawGatewayClient {
  private ws: WebSocket | null = null
  private url: string
  private authToken: string
  private requestMap = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>()
  private eventHandlers = new Map<string, Set<(payload: unknown) => void>>()
  private isConnected = false
  private connectResolve: (() => void) | null = null
  private connectReject: ((error: Error) => void) | null = null
  private eventSource: ReadableStreamDefaultController<OpenClawStreamEvent> | null = null

  constructor(url: string, authToken: string) {
    // Convert http:// to ws:// or https:// to wss://
    this.url = url.replace(/^http/, 'ws')
    // Remove trailing slashes and /v1 path components
    this.url = this.url.replace(/\/v1\/?$/, '').replace(/\/$/, '')
    this.authToken = authToken
  }

  /**
   * Connect to the OpenClaw Gateway with challenge-response authentication.
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return
    }

    return new Promise((resolve, reject) => {
      this.connectResolve = resolve
      this.connectReject = reject

      try {
        this.ws = new WebSocket(this.url)
      } catch (err) {
        this.connectReject?.(new Error(`Failed to create WebSocket: ${err}`))
        this.connectReject = null
        return
      }

      this.ws.onopen = () => {
        // Wait for challenge before responding
      }

      this.ws.onmessage = async (event) => {
        try {
          const frame = JSON.parse(event.data) as GatewayResponse | GatewayEvent

          if (frame.type === 'res') {
            const pending = this.requestMap.get(frame.id)
            if (pending) {
              if (frame.ok) {
                pending.resolve(frame.payload)
              } else {
                pending.reject(new Error(frame.error?.message || 'Unknown error'))
              }
              this.requestMap.delete(frame.id)
            }
          } else if (frame.type === 'event') {
            this.handleEvent(frame)
          }
        } catch (err) {
          console.error('[OpenClawGateway] Failed to parse message:', err)
        }
      }

      this.ws.onerror = (error) => {
        console.error('[OpenClawGateway] WebSocket error:', error)
        this.connectReject?.(new Error('WebSocket connection error'))
        this.connectReject = null
      }

      this.ws.onclose = () => {
        this.isConnected = false
        this.cleanup()
      }
    })
  }

  /**
   * Wait for and handle the challenge, then complete authentication.
   */
  private async handleChallenge(challenge: ChallengePayload): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected')
    }

    // Sign the nonce with the auth token
    // The exact signing mechanism may vary - using HMAC-SHA256 as a reasonable default
    const nonceToSign = `${challenge.nonce}:${challenge.timestamp}`
    const encoder = new TextEncoder()
    const keyData = encoder.encode(this.authToken)
    const nonceData = encoder.encode(nonceToSign)

    // Use Web Crypto API for HMAC
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, nonceData)
    const signatureHex = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    // Send connect response
    await this.sendRequest('connect', {
      auth: this.authToken,
      deviceId: 'chaeboxi-desktop',
      signedNonce: signatureHex,
    })
  }

  private handleEvent(frame: GatewayEvent): void {
    // Handle internal events
    if (frame.event === 'connect.challenge') {
      this.handleChallenge(frame.payload as ChallengePayload).catch((err) => {
        this.connectReject?.(err)
        this.connectReject = null
      })
      return
    }

    if (frame.event === 'hello-ok') {
      const payload = frame.payload as HelloOkPayload
      console.debug('[OpenClawGateway] Connected:', payload.protocolVersion)
      this.isConnected = true
      this.connectResolve?.()
      this.connectResolve = null
      this.connectReject = null
      return
    }

    // Forward to registered handlers
    const handlers = this.eventHandlers.get(frame.event)
    if (handlers) {
      handlers.forEach((handler) => handler(frame.payload))
    }
  }

  private async sendRequest(method: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected')
    }

    const id = crypto.randomUUID()
    const request: GatewayRequest = { type: 'req', id, method, params }

    return new Promise((resolve, reject) => {
      this.requestMap.set(id, { resolve, reject })
      this.ws?.send(JSON.stringify(request))

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.requestMap.has(id)) {
          this.requestMap.delete(id)
          reject(new Error(`Request ${method} timed out`))
        }
      }, 30000)
    })
  }

  /**
   * Subscribe to gateway events.
   */
  on(event: string, handler: (payload: unknown) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event)!.add(handler)
  }

  /**
   * Unsubscribe from gateway events.
   */
  off(event: string, handler: (payload: unknown) => void): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.delete(handler)
      if (handlers.size === 0) {
        this.eventHandlers.delete(event)
      }
    }
  }

  /**
   * List available agents from the gateway.
   */
  async listAgents(): Promise<OpenClawAgent[]> {
    await this.connect()

    try {
      const response = await this.sendRequest('agents.list', {})
      const agents = response as Array<{
        id: string
        name: string
        description?: string
        capabilities?: string[]
      }>
      return agents.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        capabilities: a.capabilities,
      }))
    } catch (err) {
      // Fallback: try catalog.list for older gateways
      try {
        const response = await this.sendRequest('catalog.list', {})
        const catalog = response as { agents?: unknown[] }
        if (catalog.agents) {
          return catalog.agents as OpenClawAgent[]
        }
      } catch {
        // Ignore
      }
      throw err
    }
  }

  /**
   * Invoke an agent with messages and handle streaming response.
   * Returns an async generator that yields stream events.
   */
  async *invokeAgent(
    agentId: string,
    messages: OpenClawMessage[],
    sessionId?: string,
    signal?: AbortSignal
  ): AsyncGenerator<OpenClawStreamEvent> {
    await this.connect()

    const requestId = crypto.randomUUID()
    const eventHandler = (payload: unknown) => {
      this.eventSource?.enqueue(payload as OpenClawStreamEvent)
    }

    // Subscribe to agent events
    this.on(`agent.${agentId}.chunk`, eventHandler)
    this.on(`agent.${agentId}.finish`, eventHandler)
    this.on(`agent.${agentId}.error`, eventHandler)

    // Handle abort
    const abortHandler = () => {
      this.sendRequest('agent.cancel', { id: requestId }).catch(() => {})
      this.cleanup()
    }
    signal?.addEventListener('abort', abortHandler)

    try {
      // Send invoke request
      await this.sendRequest('agent.invoke', {
        id: requestId,
        agentId,
        messages,
        sessionId,
      })

      // For non-streaming, wait for result
      const result = await this.sendRequest('agent.result', { id: requestId })
      yield { type: 'finish', reason: 'complete' }
      return result
    } catch (err) {
      yield { type: 'error', error: String(err) }
    } finally {
      this.off(`agent.${agentId}.chunk`, eventHandler)
      this.off(`agent.${agentId}.finish`, eventHandler)
      this.off(`agent.${agentId}.error`, eventHandler)
      signal?.removeEventListener('abort', abortHandler)
    }
  }

  /**
   * Invoke an agent with streaming, returning a readable stream.
   */
  invokeAgentStream(
    agentId: string,
    messages: OpenClawMessage[],
    sessionId?: string,
    signal?: AbortSignal
  ): ReadableStream<OpenClawStreamEvent> {
    const client = this

    return new ReadableStream<OpenClawStreamEvent>({
      async start(controller) {
        client.eventSource = controller
        try {
          for await (const event of client.invokeAgent(agentId, messages, sessionId, signal)) {
            controller.enqueue(event)
            if (event.type === 'finish' || event.type === 'error') {
              break
            }
          }
        } catch (err) {
          controller.error(err)
        } finally {
          client.eventSource = null
        }
      },
      cancel() {
        client.eventSource = null
        client.cleanup()
      },
    })
  }

  /**
   * Disconnect from the gateway.
   */
  disconnect(): void {
    this.cleanup()
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  private cleanup(): void {
    // Reject any pending requests
    this.requestMap.forEach((pending) => {
      pending.reject(new Error('Connection closed'))
    })
    this.requestMap.clear()
    this.eventHandlers.clear()
  }

  /**
   * Check if connected to the gateway.
   */
  isReady(): boolean {
    return this.isConnected
  }
}

// Singleton cache for gateway clients per provider settings
const clientCache = new Map<string, OpenClawGatewayClient>()

/**
 * Get or create a gateway client for the given apiHost and apiKey.
 * Clients are cached per unique apiHost+apiKey combination.
 */
export function getGatewayClient(apiHost: string, apiKey: string): OpenClawGatewayClient {
  const cacheKey = `${apiHost}:${apiKey}`
  let client = clientCache.get(cacheKey)
  if (!client) {
    client = new OpenClawGatewayClient(apiHost, apiKey)
    clientCache.set(cacheKey, client)
  }
  return client
}

/**
 * Clear the gateway client cache.
 */
export function clearGatewayClientCache(): void {
  clientCache.forEach((client) => client.disconnect())
  clientCache.clear()
}
