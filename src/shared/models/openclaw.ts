/**
 * OpenClaw Model - Uses OpenClaw Gateway WebSocket client for agent interaction.
 */

import type { ModelMessage } from 'ai'
import type { MessageContentParts, MessageReasoningPart, MessageTextPart, MessageToolCallPart } from '../types'
import type { StreamTextResult } from '../types/session'
import { ApiError } from './errors'
import type { CallChatCompletionOptions, ModelInterface } from './types'
import type { ProviderModelInfo } from '../types'
import type { ModelDependencies } from '../types/adapters'
import { getGatewayClient, type OpenClawMessage, type OpenClawStreamEvent } from '../openclaw/gateway'

export interface OpenClawModelOptions {
  apiHost: string
  apiKey: string
  model: ProviderModelInfo
  dependencies: ModelDependencies
}

/**
 * OpenClaw model implementation using the Gateway WebSocket client.
 * Supports agent listing and streaming chat with tool use.
 */
export default class OpenClawModel implements ModelInterface {
  public name = 'OpenClaw'
  public modelId: string

  private gatewayClient: ReturnType<typeof getGatewayClient>

  constructor(public options: OpenClawModelOptions) {
    this.modelId = options.model.modelId
    this.gatewayClient = getGatewayClient(options.apiHost, options.apiKey)
  }

  isSupportVision(): boolean {
    return this.options.model.capabilities?.includes('vision') ?? false
  }

  isSupportToolUse(_scope?: unknown): boolean {
    return true
  }

  isSupportSystemMessage(): boolean {
    return true
  }

  /**
   * Chat with an OpenClaw agent via WebSocket streaming.
   */
  async chat(messages: ModelMessage[], options: CallChatCompletionOptions): Promise<StreamTextResult> {
    const agentId = this.modelId
    const sessionId = options.sessionId

    // Convert AI SDK messages to OpenClaw format
    const openClawMessages: OpenClawMessage[] = messages
      .filter((msg) => msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system')
      .map((msg) => {
        let content = ''
        if (typeof msg.content === 'string') {
          content = msg.content
        } else if (Array.isArray(msg.content)) {
          content = msg.content
            .map((part) => {
              if (part.type === 'text') {
                return part.text
              }
              return ''
            })
            .join('')
        }
        return {
          role: msg.role as 'user' | 'assistant' | 'system',
          content,
        }
      })

    const contentParts: MessageContentParts = []
    let currentTextPart: MessageTextPart | undefined
    let currentReasoningPart: MessageReasoningPart | undefined
    const toolCallMap = new Map<string, number>()

    try {
      const stream = this.gatewayClient.invokeAgentStream(agentId, openClawMessages, sessionId, options.signal)
      const reader = stream.getReader()

      let finishReason: string | undefined

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }

        const event = value as OpenClawStreamEvent

        switch (event.type) {
          case 'text-delta': {
            if (!currentTextPart) {
              currentTextPart = { type: 'text', text: event.text }
              contentParts.push(currentTextPart)
            } else {
              currentTextPart.text += event.text
            }
            break
          }

          case 'reasoning-delta': {
            if (!currentReasoningPart) {
              currentReasoningPart = {
                type: 'reasoning',
                text: event.text,
                startTime: Date.now(),
              }
              contentParts.push(currentReasoningPart)
            } else {
              currentReasoningPart.text += event.text
            }
            break
          }

          case 'tool-call': {
            toolCallMap.set(event.toolCallId, contentParts.length)
            const toolPart: MessageToolCallPart = {
              type: 'tool-call',
              state: 'call',
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              args: event.args,
            }
            contentParts.push(toolPart)
            break
          }

          case 'tool-result': {
            const idx = toolCallMap.get(event.toolCallId)
            if (idx !== undefined) {
              const existingPart = contentParts[idx]
              if (existingPart.type === 'tool-call') {
                existingPart.state = 'result'
                existingPart.result = event.result
              }
            }
            break
          }

          case 'tool-error': {
            const errorIdx = toolCallMap.get(event.toolCallId)
            if (errorIdx !== undefined) {
              const errorPart = contentParts[errorIdx]
              if (errorPart.type === 'tool-call') {
                errorPart.state = 'error'
                errorPart.result = { error: event.error }
              }
            }
            break
          }

          case 'finish':
            finishReason = event.reason
            // Finalize reasoning duration
            if (currentReasoningPart?.startTime && !currentReasoningPart.duration) {
              currentReasoningPart.duration = Date.now() - currentReasoningPart.startTime
            }
            break

          case 'error':
            console.error('[OpenClawModel] Stream error:', event.error)
            throw new ApiError(`OpenClaw stream error: ${event.error}`)
        }

        // Report partial results
        options.onResultChange?.({ contentParts: [...contentParts] })
      }

      return {
        contentParts,
        finishReason,
      }
    } catch (err) {
      console.error('[OpenClawModel] Chat error:', err)
      throw err
    }
  }

  /**
   * Paint is not supported via the OpenClaw gateway.
   * Image generation should use ComfyUI provider instead.
   */
  async paint(): Promise<string[]> {
    throw new ApiError('OpenClaw does not support image generation. Use ComfyUI provider instead.')
  }
}

/**
 * Fetch available models (agents) from the OpenClaw gateway.
 */
export async function fetchOpenClawModels(apiHost: string, apiKey: string): Promise<ProviderModelInfo[]> {
  try {
    const client = getGatewayClient(apiHost, apiKey)
    const agents = await client.listAgents()
    return agents.map((agent) => ({
      modelId: agent.id,
      nickname: agent.name,
      capabilities: (agent.capabilities ||
        []) as Array<'vision' | 'reasoning' | 'tool_use' | 'web_search'>,
    }))
  } catch (err) {
    console.error('[OpenClawModel] Failed to fetch models:', err)
    return []
  }
}
