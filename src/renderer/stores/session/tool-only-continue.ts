import type { MessageContentParts, MessageToolCallPart } from '@shared/types'
import { isHostChromeTool } from '@/utils/message-stream-ui'

const RESULT_CLIP = 1500

/** Nudge used when the first stream ended on tool-calls with no answer text to promote. */
export function buildVisibleAnswerContinuePrompt(contentParts: MessageContentParts): string {
  const tools = contentParts.filter(
    (part): part is MessageToolCallPart => part.type === 'tool-call' && !isHostChromeTool(part)
  )
  const lines = tools.map((part) => {
    const payload = part.result !== undefined ? JSON.stringify(part.result) : part.state
    const clipped = payload.length > RESULT_CLIP ? `${payload.slice(0, RESULT_CLIP)}…` : payload
    return `- ${part.toolName}: ${clipped}`
  })
  return [
    'You used tools but did not write a user-visible reply.',
    'Write the reply now from these tool results. Do not call tools unless strictly required.',
    '',
    ...lines,
  ].join('\n')
}

export function mergeContinuedContentParts(
  firstParts: MessageContentParts,
  continueParts: MessageContentParts
): MessageContentParts {
  const extra = continueParts.filter((part) => !isHostChromeTool(part))
  return [...firstParts, ...extra]
}
