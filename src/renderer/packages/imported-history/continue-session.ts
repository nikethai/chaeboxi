import type { ContinuationLineage, ImportedConversation, ImportedMessage } from '@shared/imported-history'
import { createMessage, type Message, type Session } from '@shared/types'
import { buildUntrustedImportedContextBlock, type ImportedExcerpt } from '@/packages/imported-context'
import { estimateTokensFromMessages } from '@/packages/token'

export type ContinueImportedInput = {
  sourceId: string
  conversation: ImportedConversation
  selectedMessages: ImportedMessage[]
  recentTurnCount?: number
  targetProvider?: string
  targetModelId?: string
}

export type HandoffPreview = {
  provider?: string
  modelId?: string
  selectedCount: number
  omittedCount: number
  omittedReasons: string[]
  estimatedTokens: number
  willLeaveDevice: true
  disclosure: string
}

function withRecentTurns(all: ImportedMessage[], selected: ImportedMessage[], recentTurnCount = 2): ImportedMessage[] {
  const selectedIds = new Set(selected.map((m) => m.id))
  const recent = all.slice(-Math.max(0, recentTurnCount)).filter((m) => !selectedIds.has(m.id))
  const merged = [...selected]
  for (const message of recent) {
    merged.push(message)
  }
  return merged
}

export function toExcerpts(conversationTitle: string, messages: ImportedMessage[]): ImportedExcerpt[] {
  return messages.map((message) => ({
    conversationTitle,
    messageId: message.id,
    role: message.role,
    text: message.text,
    createdAt: message.createdAt,
  }))
}

export function buildHandoffPreview(input: ContinueImportedInput): HandoffPreview {
  const selected = withRecentTurns(input.conversation.messages, input.selectedMessages, input.recentTurnCount)
  const block = buildUntrustedImportedContextBlock({
    sourceProvider: 'chatgpt',
    sourceLabel: input.conversation.title,
    excerpts: toExcerpts(input.conversation.title, selected),
  })
  const estimatedTokens = estimateTokensFromMessages([createMessage('user', block.text)], 'input')
  return {
    provider: input.targetProvider,
    modelId: input.targetModelId,
    selectedCount: block.includedCount,
    omittedCount: block.omittedCount,
    omittedReasons: block.omittedReasons,
    estimatedTokens,
    willLeaveDevice: true,
    disclosure: 'Selected imported text will leave this device for the destination model API.',
  }
}

export function buildContinuationSessionDraft(input: ContinueImportedInput): Omit<Session, 'id'> {
  const selected = withRecentTurns(input.conversation.messages, input.selectedMessages, input.recentTurnCount)
  const block = buildUntrustedImportedContextBlock({
    sourceProvider: 'chatgpt',
    sourceLabel: input.conversation.title,
    excerpts: toExcerpts(input.conversation.title, selected),
  })
  const lineage: ContinuationLineage = {
    importedSourceId: input.sourceId,
    importedConversationId: input.conversation.id,
    selectedMessageIds: selected.map((m) => m.id),
    targetProvider: input.targetProvider,
    targetModelId: input.targetModelId,
    createdAt: Date.now(),
    omittedCount: block.omittedCount,
    omittedReasons: block.omittedReasons,
    sourceMissing: false,
    firstHandoffPending: true,
    pendingExcerpts: toExcerpts(input.conversation.title, selected),
  }
  return {
    name: `Continue: ${input.conversation.title}`,
    type: 'chat',
    messages: [],
    agentMode: false,
    browserArmed: false,
    computerArmed: false,
    autoSkills: false,
    settings: {
      provider: input.targetProvider,
      modelId: input.targetModelId,
      memoryAutoSave: false,
    },
    continuationLineage: lineage,
  }
}

export async function continueImportedConversation(input: ContinueImportedInput): Promise<Session> {
  const draft = buildContinuationSessionDraft(input)
  const chatStore = await import('@/stores/chatStore')
  return await chatStore.createSession(draft)
}

export function prependUntrustedBlockToPrompt(messages: Message[], blockText: string): Message[] {
  const blockMsg = createMessage('user', blockText)
  if (messages.length === 0) {
    return [blockMsg]
  }
  const last = messages[messages.length - 1]
  if (last.role === 'user') {
    return [...messages.slice(0, -1), blockMsg, last]
  }
  return [...messages, blockMsg]
}
