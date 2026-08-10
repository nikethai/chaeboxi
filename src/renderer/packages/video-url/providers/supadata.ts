import { fetchJson } from '../http'
import {
  DEFAULT_PROVIDER_TIMEOUT_MS,
  type NormalizedVideoRead,
  type TranscriptSegment,
  type VideoUrlSettings,
} from '../types'
import type { ProviderFetchInput, TranscriptProvider } from './types'

/**
 * Supadata-compatible transcript client.
 * GET /v1/transcript?url=... with x-api-key.
 * Response shapes vary; we accept several field names.
 */
type SupadataResponse = {
  content?: string
  transcript?: string
  text?: string
  lang?: string
  language?: string
  availableLangs?: string[]
  title?: string
  // timed chunks
  chunks?: Array<{ text?: string; start?: number; end?: number; offset?: number; duration?: number }>
  error?: string
  message?: string
}

function isConfigured(settings: VideoUrlSettings): boolean {
  return settings.provider === 'supadata' && Boolean(settings.apiKey?.trim())
}

export const supadataProvider: TranscriptProvider = {
  id: 'supadata',
  isConfigured,
  async fetch({ parsed, options, settings }: ProviderFetchInput): Promise<NormalizedVideoRead> {
    try {
      const data = await fetchJson<SupadataResponse>('https://api.supadata.ai/v1/transcript', {
        method: 'GET',
        query: {
          url: parsed.canonicalUrl,
          text: 'true',
          ...(options.language ? { lang: options.language } : {}),
        },
        headers: {
          'x-api-key': settings.apiKey!.trim(),
        },
        signal: options.abortSignal,
        timeout: DEFAULT_PROVIDER_TIMEOUT_MS,
      })

      const text = (data.content || data.transcript || data.text || '').trim()
      let segments: TranscriptSegment[] | undefined
      if (data.chunks?.length) {
        segments = data.chunks
          .filter((c) => c.text)
          .map((c) => ({
            startSec: (c.start ?? c.offset ?? 0) / (c.start != null && c.start > 1000 ? 1000 : 1),
            endSec:
              c.end != null
                ? c.end / (c.end > 1000 ? 1000 : 1)
                : c.duration != null
                  ? ((c.start ?? c.offset ?? 0) + c.duration) / 1000
                  : undefined,
            text: c.text!,
          }))
      }

      if (!text && !segments?.length) {
        return {
          platform: parsed.platform,
          url: parsed.canonicalUrl,
          videoId: parsed.videoId,
          transcript: null,
          warnings: [],
          partial: true,
          errorCode: 'PROVIDER_FAILED',
          errorMessage: data.error || data.message || 'Supadata returned empty transcript.',
        }
      }

      const finalText = text || segments!.map((s) => s.text).join(' ')
      return {
        platform: parsed.platform,
        url: parsed.canonicalUrl,
        videoId: parsed.videoId,
        title: data.title,
        transcript: {
          source: 'provider',
          language: data.lang || data.language || options.language,
          text: finalText,
          segments,
        },
        warnings: [],
        partial: false,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const rateLimited = /429|rate/i.test(message)
      return {
        platform: parsed.platform,
        url: parsed.canonicalUrl,
        videoId: parsed.videoId,
        transcript: null,
        warnings: [],
        partial: true,
        errorCode: rateLimited ? 'RATE_LIMITED' : /timeout|abort/i.test(message) ? 'TIMEOUT' : 'PROVIDER_FAILED',
        errorMessage: message,
      }
    }
  },
}
