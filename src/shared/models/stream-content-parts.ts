import type { MessageContentParts, MessageReasoningPart, MessageTextPart } from '../types'

export type StreamContentCursor = {
  contentParts: MessageContentParts
  currentTextPart: MessageTextPart | undefined
  currentReasoningPart: MessageReasoningPart | undefined
  /** Leading answer whitespace held until readable text arrives (or stream ends). */
  pendingTextWhitespace: string
}

export function finalizeReasoningDuration(part: MessageReasoningPart | undefined, now = Date.now()): void {
  if (part?.startTime && !part.duration) {
    part.duration = now - part.startTime
  }
}

function appendTextPart(
  contentParts: MessageContentParts,
  currentTextPart: MessageTextPart | undefined,
  textDelta: string
): MessageTextPart {
  if (!currentTextPart) {
    currentTextPart = { type: 'text', text: '' }
    contentParts.push(currentTextPart)
  }
  currentTextPart.text += textDelta
  return currentTextPart
}

function appendReasoningPart(
  contentParts: MessageContentParts,
  currentReasoningPart: MessageReasoningPart | undefined,
  textDelta: string,
  now = Date.now()
): MessageReasoningPart {
  if (!currentReasoningPart) {
    currentReasoningPart = {
      type: 'reasoning',
      text: '',
      startTime: now,
    }
    contentParts.push(currentReasoningPart)
  }
  currentReasoningPart.text += textDelta
  return currentReasoningPart
}

/**
 * Apply a text-delta without ending reasoning on whitespace-only keepalives.
 * Leading whitespace is buffered until the first readable answer character.
 */
export function applyTextDelta(cursor: StreamContentCursor, textDelta: string, now = Date.now()): StreamContentCursor {
  const { contentParts, currentTextPart, currentReasoningPart, pendingTextWhitespace } = cursor

  // Answer already open — append everything, including whitespace.
  if (currentTextPart) {
    return {
      contentParts,
      currentTextPart: appendTextPart(contentParts, currentTextPart, textDelta),
      currentReasoningPart: undefined,
      pendingTextWhitespace: '',
    }
  }

  // No answer part yet: hold pure whitespace so reasoning stays active.
  if (!textDelta.trim()) {
    return {
      contentParts,
      currentTextPart: undefined,
      currentReasoningPart,
      pendingTextWhitespace: pendingTextWhitespace + textDelta,
    }
  }

  finalizeReasoningDuration(currentReasoningPart, now)
  const merged = pendingTextWhitespace + textDelta
  return {
    contentParts,
    currentTextPart: appendTextPart(contentParts, undefined, merged),
    currentReasoningPart: undefined,
    pendingTextWhitespace: '',
  }
}

/**
 * Apply a reasoning-delta. Empty strings are ignored; whitespace-only is kept.
 */
export function applyReasoningDelta(
  cursor: StreamContentCursor,
  textDelta: string,
  now = Date.now()
): StreamContentCursor {
  if (textDelta.length === 0) return cursor
  return {
    contentParts: cursor.contentParts,
    currentTextPart: undefined,
    currentReasoningPart: appendReasoningPart(cursor.contentParts, cursor.currentReasoningPart, textDelta, now),
    pendingTextWhitespace: cursor.pendingTextWhitespace,
  }
}

/**
 * Flush buffered leading whitespace at stream end / abort so content is not lost.
 * Finalizes open reasoning duration.
 */
/** Prefer streamed text parts; fall back to the provider's aggregated text (dropped SSE). */
export function resolveStreamResultText(contentParts: MessageContentParts, aggregatedText?: string): string {
  const streamed = contentParts
    .filter((part): part is MessageTextPart => part.type === 'text')
    .map((part) => part.text)
    .join('')
  if (streamed.trim()) return streamed
  return aggregatedText?.trim() ? aggregatedText : streamed
}

export function flushPendingStreamText(cursor: StreamContentCursor, now = Date.now()): StreamContentCursor {
  finalizeReasoningDuration(cursor.currentReasoningPart, now)
  if (!cursor.pendingTextWhitespace) {
    return {
      contentParts: cursor.contentParts,
      currentTextPart: cursor.currentTextPart,
      currentReasoningPart: undefined,
      pendingTextWhitespace: '',
    }
  }

  // Prefer attaching to an existing text part; otherwise create one.
  const textPart = appendTextPart(cursor.contentParts, cursor.currentTextPart, cursor.pendingTextWhitespace)
  return {
    contentParts: cursor.contentParts,
    currentTextPart: textPart,
    currentReasoningPart: undefined,
    pendingTextWhitespace: '',
  }
}
