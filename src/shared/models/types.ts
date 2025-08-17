import type { ModelMessage, ToolSet } from 'ai'
import type { MessageContentParts, ProviderOptions, StreamTextResult, ToolUseScope } from 'src/shared/types'

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
    },
    signal?: AbortSignal,
    callback?: (picBase64: string) => void
  ) => Promise<string[]>
}

export interface CallChatCompletionOptions<Tools extends ToolSet = ToolSet> {
  sessionId?: string
  signal?: AbortSignal
  onResultChange?: onResultChange
  tools?: Tools
  providerOptions?: ProviderOptions
}

export interface ResultChange {
  // webBrowsing?: MessageWebBrowsing
  // reasoningContent?: string
  // toolCalls?: MessageToolCalls
  contentParts?: MessageContentParts
  tokenCount?: number // 当前消息的 token 数量
  tokensUsed?: number // 生成当前消息的 token 使用量
}

export type onResultChangeWithCancel = (data: ResultChange & { cancel?: () => void }) => void
export type onResultChange = (data: ResultChange) => void
export type OnResultChangeWithCancel = onResultChangeWithCancel
export type OnResultChange = onResultChange
