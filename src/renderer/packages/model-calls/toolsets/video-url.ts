import { tool } from 'ai'
import z from 'zod'
import {
  buildCapabilitySummary,
  loadVideoUrlSettings,
  type NormalizedVideoRead,
  readVideoUrl,
} from '@/packages/video-url'

const SECRET_LIKE = /(api[_-]?key|authorization|bearer\s+[a-z0-9._-]+|sk-[a-z0-9]{10,})/gi

function scrubText(value?: string): string | undefined {
  if (!value) return value
  return value.replace(SECRET_LIKE, '[redacted]')
}

function stripSecrets(result: NormalizedVideoRead): NormalizedVideoRead {
  return {
    ...result,
    errorMessage: scrubText(result.errorMessage),
    warnings: (result.warnings || []).map((w) => scrubText(w) || w),
    description: scrubText(result.description),
    transcript: result.transcript
      ? {
          ...result.transcript,
          text: scrubText(result.transcript.text) || result.transcript.text,
        }
      : result.transcript,
  }
}

export const readVideoUrlTool = tool({
  description:
    'Read public YouTube, Vimeo, TikTok, or Facebook video links: metadata + captions/transcript when available (falls back to description). Prefer over parse_link for video links. Not for local FILE_KEY uploads (use read_video).',
  inputSchema: z.object({
    url: z.string().describe('Public video URL (include https://).'),
    mode: z
      .enum(['auto', 'transcript', 'metadata', 'frames'])
      .optional()
      .describe('What to prioritize. Default auto (metadata + transcript).'),
    language: z.string().optional().describe('Preferred caption/transcript language code, e.g. en, es.'),
    maxChars: z
      .number()
      .int()
      .min(500)
      .max(50_000)
      .optional()
      .describe('Max transcript characters to return (default 12000).'),
    startSec: z.number().min(0).optional().describe('Optional transcript window start (seconds).'),
    endSec: z.number().min(0).optional().describe('Optional transcript window end (seconds).'),
    maxFrames: z
      .number()
      .int()
      .min(0)
      .max(8)
      .optional()
      .describe('Optional max frames (remote frames limited; prefer local read_video for vision).'),
    includeTimestamps: z
      .boolean()
      .optional()
      .describe('Include [mm:ss] timestamps in transcript text when segments exist. Default true.'),
  }),
  execute: async (
    input: {
      url: string
      mode?: 'auto' | 'transcript' | 'metadata' | 'frames'
      language?: string
      maxChars?: number
      startSec?: number
      endSec?: number
      maxFrames?: number
      includeTimestamps?: boolean
    },
    { abortSignal }: { abortSignal?: AbortSignal } = {}
  ): Promise<NormalizedVideoRead> => {
    const settings = loadVideoUrlSettings()
    if (!settings.enabled) {
      return {
        platform: 'unknown',
        url: input.url,
        warnings: [],
        partial: true,
        transcript: null,
        errorCode: 'UNSUPPORTED_URL',
        errorMessage: 'Video URL reading is disabled in Settings → Video URL.',
      }
    }

    // Tool-level deadline: even if an HTTP call ignores abort, this guarantees the agent unblocks.
    // Slightly above orchestrator DEFAULT_READ_TIMEOUT_MS (60s).
    const toolDeadlineMs = 70_000
    const deadline = new AbortController()
    const timer = setTimeout(() => deadline.abort(), toolDeadlineMs)
    const onParentAbort = () => deadline.abort()
    if (abortSignal) {
      if (abortSignal.aborted) deadline.abort()
      else abortSignal.addEventListener('abort', onParentAbort, { once: true })
    }
    try {
      const result = await readVideoUrl({
        ...input,
        abortSignal: deadline.signal,
      })
      return stripSecrets(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const timedOut = deadline.signal.aborted || /abort|timeout/i.test(message)
      return {
        platform: 'unknown',
        url: input.url,
        warnings: [],
        partial: true,
        transcript: null,
        errorCode: timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
        errorMessage: timedOut
          ? 'Video URL read timed out. Try again, or configure a BYOK provider under Settings → Video URL.'
          : message,
      }
    } finally {
      clearTimeout(timer)
      abortSignal?.removeEventListener('abort', onParentAbort)
    }
  },
  toModelOutput: ({ output }: { output: NormalizedVideoRead }) => {
    const lines: string[] = [
      `Video (${output.platform}): ${output.title || output.url}`,
      output.author ? `Author: ${output.author}` : '',
      output.durationSec != null ? `Duration: ${Math.round(output.durationSec)}s` : '',
      output.description ? `Description: ${output.description.slice(0, 1500)}` : '',
      output.transcript
        ? `Transcript source: ${output.transcript.source}${output.transcript.language ? ` (${output.transcript.language})` : ''}`
        : 'Transcript: none',
      output.truncated
        ? `Truncated: yes (original ${output.originalTranscriptLength} chars). Use startSec/endSec or higher maxChars for more.`
        : '',
      output.errorCode ? `Status: ${output.errorCode}${output.errorMessage ? ` — ${output.errorMessage}` : ''}` : '',
      output.warnings?.length ? `Warnings: ${output.warnings.join('; ')}` : '',
      '',
      output.transcript?.text || '',
    ].filter((l, i, arr) => l !== '' || (i > 0 && arr[i - 1] !== ''))

    // Hard fail only when we have neither transcript nor useful metadata
    if (output.errorCode && !output.transcript?.text && !output.title && !output.description) {
      return { type: 'error-text' as const, value: lines.join('\n').trim() || output.errorMessage || output.errorCode }
    }

    return {
      type: 'text' as const,
      value: lines.join('\n').trim(),
    }
  },
})

function getVideoUrlToolSetDescription(): string {
  // Dynamic capability matrix — evaluated at use time (not module load)
  let capability = ''
  try {
    capability = buildCapabilitySummary()
  } catch {
    capability = 'Platform capability: YouTube captions free; TikTok/Facebook need provider/STT.'
  }
  return `Use these tools to read **public** video URLs (YouTube, Vimeo, TikTok, Facebook).

## read_video_url
Fetch metadata and transcript/captions for a public video link.
- ALWAYS prefer this over parse_link or web_search for video platform URLs.
- Not for user-uploaded files — use read_video (FILE_KEY) for local uploads.
- TikTok/Facebook transcripts usually need a configured provider or STT in Settings → Video URL.
- Respect maxChars and optional startSec/endSec windows for long videos.
- Public URLs only; private/login-gated content will fail with a structured error.

${capability}
`
}

export default {
  get description() {
    return getVideoUrlToolSetDescription()
  },
  tools: {
    read_video_url: readVideoUrlTool,
  },
}
