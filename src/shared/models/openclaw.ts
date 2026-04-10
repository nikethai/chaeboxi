// OpenClaw model implementation using the WebSocket gateway client

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

const gatewayClientCache = new Map<string, OpenClawGatewayClient>()

function getGatewayClient(apiHost: string, apiKey?: string): OpenClawGatewayClient {
  const cacheKey = `${apiHost}:${apiKey || ''}`
  if (!gatewayClientCache.has(cacheKey)) {
    gatewayClientCache.set(cacheKey, new OpenClawGatewayClient(apiHost, { token: apiKey }))
  }
  return gatewayClientCache.get(cacheKey)!
}

export function clearGatewayClientCache(): void {
  gatewayClientCache.forEach((client) => {
    client.disconnect()
  })
  gatewayClientCache.clear()
}

interface Options {
  apiKey: string
  apiHost: string
  model: ProviderModelInfo
}

export default class OpenClawModel implements ModelInterface {
  public name = 'OpenClaw'
  public modelId: string
  private gatewayClient: OpenClawGatewayClient

  constructor(public options: Options, _dependencies: ModelDependencies) {
    this.modelId = options.model.modelId
    this.gatewayClient = getGatewayClient(options.apiHost, options.apiKey)
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

  private formatMessageForGateway(msg: ModelMessage): AgentMessage {
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

  private async ensureConnected(): Promise<void> {
    if (!this.gatewayClient.connected) {
      await this.gatewayClient.connect()
    }
  }

  async chat(messages: ModelMessage[], options: CallChatCompletionOptions): Promise<StreamTextResult> {
    try {
      await this.ensureConnected()

      const lastMessage = this.formatMessageForGateway(messages[messages.length - 1])

      if (!lastMessage.content) {
        throw new ApiError('No messages to send')
      }

      const contentParts: MessageContentParts = []
      let currentTextPart: MessageTextPart | undefined
      const toolCallMap = new Map<string, MessageToolCallPart>()

      const stream = this.gatewayClient.invokeAgent(
        this.modelId,
        lastMessage,
        options.sessionId,
        options.signal
      )

      for await (const event of stream) {
        ;({ currentTextPart } = this.processStreamEvent(event, contentParts, toolCallMap, currentTextPart, options))
      }

      return { contentParts }
    } catch (error) {
      if (error instanceof Error && error.message === 'Not connected') {
        throw new ApiError('OpenClaw gateway not connected. Please check your settings.')
      }
      throw error
    }
  }

  private processStreamEvent(
    event: AgentStreamEvent,
    contentParts: MessageContentParts,
    toolCallMap: Map<string, MessageToolCallPart>,
    currentTextPart: MessageTextPart | undefined,
    options: CallChatCompletionOptions
  ): { currentTextPart: MessageTextPart | undefined } {
    switch (event.type) {
      case 'chunk': {
        if (!currentTextPart) {
          currentTextPart = { type: 'text', text: event.delta }
          contentParts.push(currentTextPart)
        } else {
          currentTextPart.text += event.delta
        }
        options.onResultChange?.({ contentParts })
        break
      }

      case 'tool': {
        const toolCallPart: MessageToolCallPart = {
          type: 'tool-call',
          state: 'call',
          toolCallId: event.invocationId + ':' + event.tool,
          toolName: event.tool,
          args: event.input,
        }
        toolCallMap.set(toolCallPart.toolCallId, toolCallPart)
        contentParts.push(toolCallPart)
        options.onResultChange?.({ contentParts })
        break
      }

      case 'tool_result': {
        const toolCallId = event.invocationId + ':' + event.tool
        const existingCall = toolCallMap.get(toolCallId)
        if (existingCall) {
          existingCall.state = event.error ? 'error' : 'result'
          existingCall.result = event.error ? { error: event.error } : event.output
        }
        options.onResultChange?.({ contentParts })
        break
      }

      case 'done': {
        if (event.status === 'error' && event.error) {
          console.error('[OpenClaw] Agent error:', event.error)
        }
        break
      }
    }

    return { currentTextPart }
  }

  async paint(): Promise<string[]> {
    return []
  }
}
