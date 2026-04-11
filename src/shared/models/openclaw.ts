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

      const lastMessage = formatMessageForGateway(messages[messages.length - 1])
      if (!lastMessage.content) {
        throw new ApiError('No messages to send')
      }

      const acc = new StreamAccumulator(options)

      const stream = this.gatewayClient.invokeAgent(this.modelId, lastMessage, options.sessionId, options.signal)

      for await (const event of stream) {
        acc.process(event)
      }

      return { contentParts: acc.contentParts }
    } catch (error) {
      if (error instanceof Error && error.message === 'Not connected') {
        throw new ApiError('OpenClaw gateway not connected. Please check your settings.')
      }
      throw error
    }
  }

  async paint(): Promise<string[]> {
    return []
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
