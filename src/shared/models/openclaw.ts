import type { ModelMessage } from 'ai'
import type {
  MessageContentParts,
  MessageTextPart,
  MessageToolCallPart,
  ProviderModelInfo,
  StreamTextResult,
  ToolUseScope,
} from '../types'
import type { ModelDependencies } from '../types/adapters'
import type { AgentMessage, AgentStreamEvent } from '../openclaw/gateway/types'
import { OpenClawGatewayClient } from '../openclaw/gateway'
import { ApiError } from './errors'
import type { CallChatCompletionOptions, ModelInterface } from './types'

// Shared client cache — keyed by apiHost:apiKey:cfId:cfSecret
const clientCache = new Map<string, OpenClawGatewayClient>()
const MAX_CACHED_GATEWAY_CLIENTS = 1

export interface SessionBinding {
  sessionId?: string
  sessionKey?: string
}

interface CacheEntry {
  binding: SessionBinding
  resolvedAt: number
}

const DEFAULT_SESSION_KEY = 'main'

class GatewaySessionBindingStore {
  private cache = new Map<string, CacheEntry>()

  constructor(
    private readonly maxEntries: number = 200,
    private readonly ttlMs: number = 30 * 60 * 1000
  ) {}

  get(cacheKey: string): SessionBinding | undefined {
    const entry = this.cache.get(cacheKey)
    if (!entry) return undefined
    if (Date.now() - entry.resolvedAt > this.ttlMs) {
      this.cache.delete(cacheKey)
      return undefined
    }
    return entry.binding
  }

  set(cacheKey: string, binding: SessionBinding): void {
    if (this.cache.size >= this.maxEntries && !this.cache.has(cacheKey)) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) this.cache.delete(oldestKey)
    }
    this.cache.set(cacheKey, { binding, resolvedAt: Date.now() })
  }

  delete(cacheKey: string): void {
    this.cache.delete(cacheKey)
  }

  clear(): void {
    this.cache.clear()
  }
}

const gatewaySessionBindingStore = new GatewaySessionBindingStore()

export interface GatewayClientCreateOptions {
  apiHost: string
  apiKey?: string
  cloudflareClientId?: string
  cloudflareClientSecret?: string
  idleTimeoutMs?: number
  maxDurationMs?: number
}

function getGatewayClientCacheKey(opts: GatewayClientCreateOptions): string {
  return `${opts.apiHost}:${opts.apiKey || ''}:${opts.cloudflareClientId || ''}:${opts.cloudflareClientSecret || ''}`
}

export function getOrCreateGatewayClient(opts: GatewayClientCreateOptions): OpenClawGatewayClient {
  const key = getGatewayClientCacheKey(opts)
  let client = clientCache.get(key)
  if (!client) {
    while (clientCache.size >= MAX_CACHED_GATEWAY_CLIENTS) {
      const oldestKey = clientCache.keys().next().value
      if (!oldestKey) {
        break
      }

      const staleClient = clientCache.get(oldestKey)
      staleClient?.disconnect()
      clientCache.delete(oldestKey)
    }

    client = new OpenClawGatewayClient(
      opts.apiHost,
      {
        token: opts.apiKey,
        cloudflareClientId: opts.cloudflareClientId,
        cloudflareClientSecret: opts.cloudflareClientSecret,
      },
      {
        idleTimeoutMs: opts.idleTimeoutMs,
        maxDurationMs: opts.maxDurationMs,
      }
    )
    clientCache.set(key, client)
  } else {
    clientCache.delete(key)
    clientCache.set(key, client)
  }
  return client
}

export function evictGatewayClient(opts: GatewayClientCreateOptions): void {
  const key = getGatewayClientCacheKey(opts)
  const client = clientCache.get(key)
  if (client) {
    client.disconnect()
    clientCache.delete(key)
  }
}

export function clearAllGatewayClients(): void {
  for (const client of clientCache.values()) {
    client.disconnect()
  }
  clientCache.clear()
  gatewaySessionBindingStore.clear()
}

interface Options {
  apiKey: string
  apiHost: string
  model: ProviderModelInfo
  cloudflareClientId?: string
  cloudflareClientSecret?: string
}

export default class OpenClawModel implements ModelInterface {
  public name = 'OpenClaw'
  public modelId: string
  private gatewayClient: OpenClawGatewayClient

  constructor(
    public options: Options,
    _dependencies: ModelDependencies
  ) {
    this.modelId = options.model.modelId
    this.gatewayClient = getOrCreateGatewayClient({
      apiHost: options.apiHost,
      apiKey: options.apiKey,
      cloudflareClientId: options.cloudflareClientId,
      cloudflareClientSecret: options.cloudflareClientSecret,
    })
  }

  isSupportVision(): boolean {
    return this.options.model.capabilities?.includes('vision') ?? false
  }

  isSupportToolUse(_scope?: ToolUseScope): boolean {
    return true
  }

  isSupportSystemMessage(): boolean {
    return true
  }

  async chat(messages: ModelMessage[], options: CallChatCompletionOptions): Promise<StreamTextResult> {
    try {
      // connect() is safe to call concurrently — returns existing promise if already in-flight
      await this.gatewayClient.connect()

      const lastNonSystemMessage = [...messages].reverse().find((message) => message.role !== 'system')
      const lastMessage = lastNonSystemMessage ? formatMessageForGateway(lastNonSystemMessage) : undefined
      const extraSystemPrompt = messages
        .filter((message) => message.role === 'system')
        .map(getMessageText)
        .filter(Boolean)
        .join('\n\n')
        .trim()

      if (!lastMessage?.content) {
        throw new ApiError('No messages to send')
      }

      const acc = new StreamAccumulator(options)
      const sessionBinding = options.sessionId ? await this.resolveGatewaySessionBinding(options.sessionId) : undefined

      const stream = this.gatewayClient.invokeAgent(
        this.modelId,
        lastMessage,
        {
          sessionId: sessionBinding?.sessionId,
          sessionKey: sessionBinding?.sessionKey,
          extraSystemPrompt: extraSystemPrompt || undefined,
        },
        options.signal
      )

      for await (const event of stream) {
        acc.process(event)
      }

      return { contentParts: acc.contentParts }
    } catch (error) {
      if (options.signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
        throw error
      }
      if (error instanceof Error && error.message === 'Not connected') {
        throw new ApiError('OpenClaw gateway not connected. Please check your settings.')
      }
      if (error instanceof Error && !(error instanceof ApiError)) {
        throw new ApiError(error.message)
      }
      throw error
    }
  }

  async paint(): Promise<string[]> {
    return []
  }

  private async resolveGatewaySessionBinding(localSessionId: string): Promise<SessionBinding> {
    const cacheKey = `${this.options.apiHost}:${this.modelId}:${localSessionId}`
    const cached = gatewaySessionBindingStore.get(cacheKey)
    if (cached) {
      return cached
    }

    let binding: SessionBinding = { sessionKey: DEFAULT_SESSION_KEY }
    try {
      const response = await this.gatewayClient.listSessions()
      const sessions = response.sessions.filter((s) => !s.agentId || s.agentId === this.modelId)
      if (sessions.length > 0) {
        binding = { sessionId: sessions.reduce((latest, s) => {
          const sTs = s.updatedAt || s.createdAt || 0
          const lTs = latest.updatedAt || latest.createdAt || 0
          return sTs > lTs ? s : latest
        }).id }
      }
    } catch (error) {
      console.warn('[OpenClaw] Failed to resolve latest session, falling back to main session key:', error)
    }
    gatewaySessionBindingStore.set(cacheKey, binding)
    return binding
  }
}

function formatMessageForGateway(msg: ModelMessage): AgentMessage {
  let content: string
  if (typeof msg.content === 'string') {
    content = msg.content
  } else if (Array.isArray(msg.content)) {
    content = msg.content
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
      .map((part) => part.text)
      .join('\n')
  } else {
    content = ''
  }

  const role: 'user' | 'assistant' | 'system' =
    msg.role === 'assistant' ? 'assistant' : msg.role === 'system' ? 'system' : 'user'

  return { role, content }
}

function getMessageText(msg: ModelMessage): string {
  if (typeof msg.content === 'string') {
    return msg.content.trim()
  }
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
      .map((part) => part.text)
      .join('\n')
      .trim()
  }
  return ''
}

class StreamAccumulator {
  contentParts: MessageContentParts = []
  private currentTextPart: MessageTextPart | undefined
  private toolCallMap = new Map<string, MessageToolCallPart>()
  private options: CallChatCompletionOptions

  constructor(options: CallChatCompletionOptions) {
    this.options = options
  }

  process(event: AgentStreamEvent): void {
    switch (event.type) {
      case 'chunk': {
        if (!this.currentTextPart) {
          this.currentTextPart = { type: 'text', text: event.delta }
          this.contentParts.push(this.currentTextPart)
        } else {
          this.currentTextPart.text += event.delta
        }
        this.notify()
        break
      }
      case 'tool': {
        const toolCallPart: MessageToolCallPart = {
          type: 'tool-call',
          state: 'call',
          toolCallId: `${event.invocationId}:${event.tool}`,
          toolName: event.tool,
          args: event.input,
        }
        this.toolCallMap.set(toolCallPart.toolCallId, toolCallPart)
        this.contentParts.push(toolCallPart)
        this.notify()
        break
      }
      case 'tool_result': {
        const toolCallId = `${event.invocationId}:${event.tool}`
        const existing = this.toolCallMap.get(toolCallId)
        if (existing) {
          existing.state = event.error ? 'error' : 'result'
          existing.result = event.error ? { error: event.error } : event.output
        } else {
          const toolCallPart: MessageToolCallPart = {
            type: 'tool-call',
            state: event.error ? 'error' : 'result',
            toolCallId,
            toolName: event.tool,
            args: {},
            result: event.error ? { error: event.error } : event.output,
          }
          this.toolCallMap.set(toolCallId, toolCallPart)
          this.contentParts.push(toolCallPart)
        }
        this.notify()
        break
      }
      case 'done': {
        if (event.status === 'error' && event.error) {
          console.error('[OpenClaw] Agent error:', event.error)
        }
        break
      }
    }
  }

  private notify(): void {
    this.options.onResultChange?.({ contentParts: this.contentParts })
  }
}
