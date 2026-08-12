import type { Message, MessageContentParts } from '@shared/types'
import { isTaskTrackingTool } from '@/packages/tools/task-tools'

type MessageContentPart = MessageContentParts[number]

/** Host chrome is model-context only — never surface as assistant "work". */
export function isHostChromeTool(part: MessageContentPart): boolean {
  return part.type === 'tool-call' && part.toolName === 'memory_lookup'
}

/**
 * Reasoning/tools that belong in the Worked strip (not task chrome).
 * Keep empty reasoning parts while generating — dropping them unmounts the strip
 * and remounts AssistantPending (Thinking… flicker).
 */
export function isWorkPart(part: MessageContentPart, opts?: { keepEmptyReasoning?: boolean }): boolean {
  if (part.type === 'reasoning') {
    if (opts?.keepEmptyReasoning) return true
    return Boolean(part.text?.trim())
  }
  return part.type === 'tool-call' && !isTaskTrackingTool(part.toolName) && !isHostChromeTool(part)
}

export function hasReadableText(text: string | undefined | null): boolean {
  return Boolean(text?.trim())
}

/**
 * Final-answer content only (never tools — tools are work).
 * Mid-turn prose between tools is monologue, not the answer.
 */
export function isReadableAnswerPart(part: MessageContentPart): boolean {
  if (part.type === 'text') return hasReadableText(part.text)
  if (part.type === 'image') return true
  if (part.type === 'plan') return true
  if (part.type === 'info') return hasReadableText(part.text)
  return false
}

export function hasRunningTool(contentParts: MessageContentParts): boolean {
  return contentParts.some(
    (p) => p.type === 'tool-call' && p.state === 'call' && !isHostChromeTool(p) && !isTaskTrackingTool(p.toolName)
  )
}

export function findLastWorkIndex(
  contentParts: MessageContentParts,
  opts?: { keepEmptyReasoning?: boolean }
): number {
  let lastWorkIdx = -1
  for (let i = 0; i < contentParts.length; i++) {
    if (isWorkPart(contentParts[i], opts)) lastWorkIdx = i
  }
  return lastWorkIdx
}

/** Readable answer after the last work part (ignores empty/whitespace text). */
export function hasReadableTrailingAnswer(contentParts: MessageContentParts, lastWorkIdx: number): boolean {
  for (let i = lastWorkIdx + 1; i < contentParts.length; i++) {
    if (isReadableAnswerPart(contentParts[i])) return true
  }
  return false
}

/**
 * Work stays active while generating until a real trailing answer exists.
 * Multi-step tools: completed tool + pause before next tool/answer must stay active
 * ("Thinking…" / "Using tools…"), never "Worked" with a blank bubble.
 */
export function isWorkActive(params: {
  generating: boolean | undefined
  contentParts: MessageContentParts
  lastWorkIdx?: number
}): boolean {
  if (!params.generating) return false
  // While generating, keep live chrome until readable answer exists — even with zero work parts.
  // (Prevents Thinking… hide when strip temporarily has no work parts.)
  const lastWorkIdx =
    params.lastWorkIdx ?? findLastWorkIndex(params.contentParts, { keepEmptyReasoning: true })
  if (hasRunningTool(params.contentParts)) return true
  if (hasReadableTrailingAnswer(params.contentParts, lastWorkIdx)) return false
  // No answer yet → still live (placeholder strip or pending).
  return true
}

/**
 * Signature so in-place stream mutations recompute grouping (length alone is insufficient).
 */
export function contentPartsRevision(contentParts: MessageContentParts): string {
  if (!contentParts.length) return '0'
  return contentParts
    .map((part) => {
      switch (part.type) {
        case 'text':
        case 'reasoning':
        case 'info':
          return `${part.type}:${part.text?.length ?? 0}:${part.text?.slice(-24) ?? ''}`
        case 'image':
          return `image:${part.storageKey}`
        case 'plan':
          return `plan:${part.status}:${part.planText?.length ?? 0}`
        case 'tool-call':
          return `tool:${part.toolCallId}:${part.toolName}:${part.state}`
        default:
          return 'unknown'
      }
    })
    .join('|')
}

export type AssistantGroupItem =
  | {
      type: 'thinking-group'
      parts: MessageContentParts
      monologueTexts: string[]
      startIndex: number
      workActive: boolean
    }
  | { type: 'single'; part: MessageContentPart; index: number }

/**
 * Product layout for assistant turns:
 * - One work strip (tools + reasoning + mid-turn monologue)
 * - Final answer = content after the last tool/reasoning
 */
export function groupAssistantContentParts(
  contentParts: MessageContentParts,
  generating: boolean | undefined
): AssistantGroupItem[] {
  // While generating with no content yet, still emit a stable thinking-group so the UI
  // never swaps AssistantPending ↔ strip (the main Thinking… flicker).
  if (contentParts.length === 0) {
    if (generating) {
      return [
        {
          type: 'thinking-group',
          parts: [],
          monologueTexts: [],
          startIndex: 0,
          workActive: true,
        },
      ]
    }
    return []
  }

  const workOpts = { keepEmptyReasoning: Boolean(generating) }
  const lastWorkIdx = findLastWorkIndex(contentParts, workOpts)
  const workActive = isWorkActive({ generating, contentParts, lastWorkIdx })

  if (lastWorkIdx === -1) {
    const singles = contentParts
      .map((part, index) => ({ type: 'single' as const, part, index }))
      .filter((item) => !isHostChromeTool(item.part))
    // Live turn with only answer-bound parts still needs a continuous strip above answer
    // only when there is no readable answer yet.
    if (generating && workActive) {
      return [
        {
          type: 'thinking-group',
          parts: [],
          monologueTexts: [],
          startIndex: 0,
          workActive: true,
        },
        ...singles,
      ]
    }
    return singles
  }

  const workParts: MessageContentParts = []
  const monologueTexts: string[] = []
  const earlySingles: AssistantGroupItem[] = []

  for (let i = 0; i <= lastWorkIdx; i++) {
    const part = contentParts[i]
    if (isHostChromeTool(part)) continue
    if (isWorkPart(part, workOpts)) {
      workParts.push(part)
      continue
    }
    if (part.type === 'text') {
      const trimmed = part.text?.trim()
      if (trimmed) monologueTexts.push(trimmed)
      continue
    }
    earlySingles.push({ type: 'single', part, index: i })
  }

  const afterWork: AssistantGroupItem[] = []
  for (let i = lastWorkIdx + 1; i < contentParts.length; i++) {
    afterWork.push({ type: 'single', part: contentParts[i], index: i })
  }

  const trailingAnswer = hasReadableTrailingAnswer(contentParts, lastWorkIdx)
  let thinkingMonologue = monologueTexts
  // Only promote mid-turn monologue into the answer column when generation finished
  // and there is still no trailing answer. Doing this while generating caused multi-step
  // tool turns to flip to "Worked" with a blank bubble between tool rounds.
  if (monologueTexts.length > 0 && !trailingAnswer && !generating) {
    for (let m = 0; m < monologueTexts.length; m++) {
      afterWork.push({
        type: 'single',
        part: { type: 'text', text: monologueTexts[m] },
        index: lastWorkIdx + 1 + m,
      })
    }
    thinkingMonologue = []
  }

  const groups: AssistantGroupItem[] = [...earlySingles]
  // Always keep the strip while generating (even if workParts emptied) — stable identity.
  if (workParts.length > 0 || (generating && workActive)) {
    groups.push({
      type: 'thinking-group',
      parts: workParts,
      monologueTexts: thinkingMonologue,
      startIndex: 0,
      workActive: generating ? workActive : false,
    })
  }
  groups.push(...afterWork)
  return groups
}

/**
 * One live indicator: active work strip OR pending chrome OR readable answer.
 * Never blank while generating.
 */
export function shouldShowAssistantPending(params: {
  message: Pick<Message, 'generating' | 'status' | 'role'>
  contentParts: MessageContentParts
  /** False on Android / agent-disabled builds where ThinkingGroupUI is not mounted. */
  workStripAvailable: boolean
}): boolean {
  const { message, contentParts, workStripAvailable } = params
  if (message.role !== 'assistant' || !message.generating || message.status?.length) return false

  const lastWorkIdx = findLastWorkIndex(contentParts, { keepEmptyReasoning: true })
  if (hasReadableTrailingAnswer(contentParts, lastWorkIdx)) return false
  if (lastWorkIdx < 0 && contentParts.some(isReadableAnswerPart)) return false

  // Desktop agent builds always render a stable thinking-group while generating
  // (see groupAssistantContentParts). Never also mount AssistantPending — dual chrome
  // was the Thinking… show/hide flicker.
  if (workStripAvailable) return false

  // Android / strip unavailable: pending is the only live chrome.
  return true
}
