import {
  DEFAULT_MAX_TRANSCRIPT_CHARS,
  MAX_TRANSCRIPT_CHARS,
  MIN_TRANSCRIPT_CHARS,
  type NormalizedTranscript,
  type TranscriptSegment,
} from './types'

export function clampMaxChars(maxChars?: number): number {
  const n = maxChars ?? DEFAULT_MAX_TRANSCRIPT_CHARS
  return Math.min(Math.max(Math.floor(n), MIN_TRANSCRIPT_CHARS), MAX_TRANSCRIPT_CHARS)
}

function filterSegmentsByWindow(
  segments: TranscriptSegment[],
  startSec?: number,
  endSec?: number
): TranscriptSegment[] {
  if (startSec == null && endSec == null) return segments
  return segments.filter((s) => {
    const start = s.startSec
    const end = s.endSec ?? s.startSec
    if (endSec != null && start > endSec) return false
    if (startSec != null && end < startSec) return false
    return true
  })
}

function segmentsToText(segments: TranscriptSegment[], includeTimestamps: boolean): string {
  if (!includeTimestamps) {
    return segments
      .map((s) => s.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
  }
  return segments
    .map((s) => {
      const mm = Math.floor(s.startSec / 60)
      const ss = Math.floor(s.startSec % 60)
      const stamp = `[${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}]`
      return `${stamp} ${s.text}`
    })
    .join('\n')
}

export type TruncateResult = {
  transcript: NormalizedTranscript
  truncated: boolean
  originalLength: number
}

/**
 * Apply time window + maxChars to a transcript. Prefers segment-aware truncation.
 */
export function truncateTranscript(
  transcript: NormalizedTranscript,
  options: {
    maxChars?: number
    startSec?: number
    endSec?: number
    includeTimestamps?: boolean
  } = {}
): TruncateResult {
  const maxChars = clampMaxChars(options.maxChars)
  const includeTimestamps = options.includeTimestamps !== false

  let segments = transcript.segments ? [...transcript.segments] : undefined
  if (segments) {
    segments = filterSegmentsByWindow(segments, options.startSec, options.endSec)
  }

  let text: string
  if (segments && segments.length > 0) {
    text = segmentsToText(segments, includeTimestamps)
  } else {
    text = transcript.text || ''
    // crude time window not available without segments
  }

  const originalLength = text.length
  if (text.length <= maxChars) {
    return {
      transcript: {
        ...transcript,
        text,
        segments,
      },
      truncated: false,
      originalLength,
    }
  }

  // Segment-aware: keep whole segments until budget
  if (segments && segments.length > 0) {
    const kept: TranscriptSegment[] = []
    let acc = ''
    for (const seg of segments) {
      const piece = includeTimestamps
        ? (() => {
            const mm = Math.floor(seg.startSec / 60)
            const ss = Math.floor(seg.startSec % 60)
            return `[${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}] ${seg.text}`
          })()
        : seg.text
      const next = acc ? `${acc}\n${piece}` : piece
      if (next.length > maxChars) break
      kept.push(seg)
      acc = next
    }
    if (kept.length === 0) {
      // single segment longer than budget
      const first = segments[0]
      const sliced = first.text.slice(0, maxChars)
      return {
        transcript: {
          ...transcript,
          text: sliced,
          segments: [{ ...first, text: sliced }],
        },
        truncated: true,
        originalLength,
      }
    }
    return {
      transcript: {
        ...transcript,
        text: acc,
        segments: kept,
      },
      truncated: true,
      originalLength,
    }
  }

  return {
    transcript: {
      ...transcript,
      text: text.slice(0, maxChars),
      segments: undefined,
    },
    truncated: true,
    originalLength,
  }
}
