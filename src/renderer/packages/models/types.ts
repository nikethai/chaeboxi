import { Message, MessageContentParts, MessageToolCalls, MessageWebBrowsing } from 'src/shared/types'
import { StreamTextResult } from 'src/shared/types'

export interface ModelHelpers {
  isModelSupportVision(model: string): boolean
  isModelSupportToolUse(model: string): boolean
}

export interface ModelInterface {
  name: string
  isSupportToolUse(): boolean
  isSupportSystemMessage(): boolean
  chat: (messages: Message[], options: CallChatCompletionOptions) => Promise<StreamTextResult>
  paint: (prompt: string, num: number, callback?: (picBase64: string) => any, signal?: AbortSignal) => Promise<string[]>
}

export interface CallChatCompletionOptions {
  signal?: AbortSignal
  onResultChange?: onResultChange
  webBrowsing?: boolean
}

export interface ResultChange {
  webBrowsing?: MessageWebBrowsing
  reasoningContent?: string
  toolCalls?: MessageToolCalls
  contentParts?: MessageContentParts
  tokenCount?: number // 当前消息的 token 数量
  tokensUsed?: number // 生成当前消息的 token 使用量
}

export type onResultChangeWithCancel = (data: ResultChange & { cancel?: () => void }) => void
export type onResultChange = (data: ResultChange) => void
export type OnResultChangeWithCancel = onResultChangeWithCancel
export type OnResultChange = onResultChange
