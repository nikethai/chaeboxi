import type { ModelInterface } from '@shared/models/types'
import type { MessageContentParts, StreamTextResult } from '@shared/types'
import {
  MAX_WRITING_OUTPUT_CHARS,
  WritingError,
  type WritingRequest,
  WritingRequestSchema,
} from '@shared/types/writing'
import { buildWritingMessages } from './prompt'

export type WritingResult = {
  request: WritingRequest
  text: string
  usage?: StreamTextResult['usage']
}

export type WritingCallbacks = {
  signal: AbortSignal
  onText?: (text: string) => void
}

function textFromParts(parts: MessageContentParts): string {
  return parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('')
}

/** Calls the model adapter directly: no general-chat orchestration or persistence. */
export async function rewriteDraft(
  model: Pick<ModelInterface, 'chat'>,
  input: WritingRequest,
  { signal, onText }: WritingCallbacks
): Promise<WritingResult> {
  const parsed = WritingRequestSchema.safeParse(input)
  if (!parsed.success) throw new WritingError('invalid_input')
  const request = parsed.data
  signal.throwIfAborted()

  const result = await model.chat(buildWritingMessages(request), {
    signal,
    purpose: 'writing',
    contentPrivacy: 'ephemeral',
    tools: {},
    maxSteps: 1,
    onResultChange: ({ contentParts }) => {
      if (!signal.aborted && contentParts) {
        // Reasoning/tool payloads are never a rewrite or exposed as its explanation.
        onText?.(textFromParts(contentParts).slice(0, MAX_WRITING_OUTPUT_CHARS))
      }
    },
  })
  signal.throwIfAborted()

  const text = textFromParts(result.contentParts) || result.text || ''
  if (
    !text.trim() ||
    text.length > MAX_WRITING_OUTPUT_CHARS ||
    (result.finishReason && result.finishReason !== 'stop') ||
    result.contentParts.some((part) => part.type === 'tool-call')
  ) {
    throw new WritingError('incomplete')
  }
  return { request, text, usage: result.usage }
}
