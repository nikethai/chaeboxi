import type { ModelMessage, ToolSet } from 'ai'
import type { ComfyUIGenerationParams } from '../providers/definitions/models/comfyui-types'
import {
  type MessageContentParts,
  type GroundingMetadata,
  type SearchCitation,
  type MessageStatus,
  type ProviderOptions,
  ProviderOptionsSchema,
  type StreamTextResult,
  type ToolUseScope,
} from 'src/shared/types'
import { z } from 'zod'

export interface ModelInterface {
  name: string
  modelId: string
  isSupportVision(): boolean
  isSupportToolUse(scope?: ToolUseScope): boolean
  isSupportSystemMessage(): boolean
  chat: (messages: ModelMessage[], options: CallChatCompletionOptions) => Promise<StreamTextResult>
  paint: (
    params: {
      prompt: string
      images?: { imageUrl: string }[]
      num: number
      aspectRatio?: string
      comfyuiParams?: ComfyUIGenerationParams
    },
    signal?: AbortSignal,
    callback?: (picBase64: string) => void,
    onProviderJobUpdate?: (data: { providerJobId?: string; queueNumber?: number }) => void
  ) => Promise<string[]>
}

export const CallChatCompletionOptionsSchema = z.object({
  sessionId: z.string().optional(),
  signal: z.instanceof(AbortSignal).optional(),
  onResultChange: z.custom<OnResultChange>().optional(),
  tools: z.custom<ToolSet>().optional(),
  providerOptions: ProviderOptionsSchema.optional(),
})

export interface CallChatCompletionOptions<Tools extends ToolSet = ToolSet> {
  sessionId?: string
  signal?: AbortSignal
  onResultChange?: OnResultChange
  onStatusChange?: OnStatusChange
  tools?: Tools
  providerOptions?: ProviderOptions
  maxSteps?: number
  /**
   * AI SDK prepareStep hook — per-step toolChoice / message overrides.
   * Used by Computer Use harness to force screenshot after open and prune old images.
   */
  prepareStep?: (options: {
    steps: unknown[]
    stepNumber: number
    model: unknown
    messages: unknown[]
    experimental_context: unknown
  }) =>
    | PromiseLike<
        | {
            toolChoice?: unknown
            messages?: unknown[]
            activeTools?: string[]
            system?: unknown
          }
        | undefined
        | void
      >
    | {
        toolChoice?: unknown
        messages?: unknown[]
        activeTools?: string[]
        system?: unknown
      }
    | undefined
    | void
}

export interface ResultChange {
  // webBrowsing?: MessageWebBrowsing
  // reasoningContent?: string
  // toolCalls?: MessageToolCalls
  contentParts?: MessageContentParts
  citations?: SearchCitation[]
  searchQuery?: string
  searchProvider?: string
  groundingMetadata?: GroundingMetadata
  tokenCount?: number // token
  tokensUsed?: number // token
  tokenSpeed?: number // tokens per second (live during streaming, final when done)
}

export type OnResultChangeWithCancel = (data: ResultChange & { cancel?: () => void }) => void
export type OnResultChange = (data: ResultChange) => void
export type OnStatusChange = (status: MessageStatus | null) => void
