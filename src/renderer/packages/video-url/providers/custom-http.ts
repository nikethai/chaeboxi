import { assertSafeHttpUrl } from '../guards'
import { fetchJson } from '../http'
import {
  DEFAULT_PROVIDER_TIMEOUT_MS,
  type NormalizedVideoRead,
  type TranscriptSegment,
  type VideoUrlSettings,
} from '../types'
import type { ProviderFetchInput, TranscriptProvider } from './types'

type LooseProviderResponse = {
  title?: string
  author?: string
  durationSec?: number
  duration?: number
  description?: string
  thumbnailUrl?: string
  thumbnail_url?: string
  language?: string
  transcript?: string | { text?: string; segments?: TranscriptSegment[] }
  text?: string
  content?: string
  segments?: TranscriptSegment[]
  error?: string
  message?: string
}

function isConfigured(settings: VideoUrlSettings): boolean {
  return settings.provider === 'custom' && Boolean(settings.customEndpoint?.trim())
}

function mapResponse(parsed: ProviderFetchInput['parsed'], data: LooseProviderResponse): NormalizedVideoRead {
  let text = ''
  let segments: TranscriptSegment[] | undefined

  if (typeof data.transcript === 'string') {
    text = data.transcript
  } else if (data.transcript && typeof data.transcript === 'object') {
    text = data.transcript.text || ''
    segments = data.transcript.segments
  }
  if (!text) text = data.text || data.content || ''
  if (!segments && data.segments) segments = data.segments
  if (!text && segments?.length) {
    text = segments.map((s) => s.text).join(' ')
  }

  if (!text) {
    return {
      platform: parsed.platform,
      url: parsed.canonicalUrl,
      videoId: parsed.videoId,
      title: data.title,
      author: data.author,
      durationSec: data.durationSec ?? data.duration,
      description: data.description,
      thumbnailUrl: data.thumbnailUrl || data.thumbnail_url,
      transcript: null,
      warnings: ['Custom provider returned no transcript text.'],
      partial: true,
      errorCode: 'PROVIDER_FAILED',
      errorMessage: data.error || data.message || 'Empty transcript from custom provider.',
    }
  }

  return {
    platform: parsed.platform,
    url: parsed.canonicalUrl,
    videoId: parsed.videoId,
    title: data.title,
    author: data.author,
    durationSec: data.durationSec ?? data.duration,
    description: data.description,
    thumbnailUrl: data.thumbnailUrl || data.thumbnail_url,
    transcript: {
      source: 'provider',
      language: data.language,
      text,
      segments,
    },
    warnings: [],
    partial: false,
  }
}

export const customHttpProvider: TranscriptProvider = {
  id: 'custom',
  isConfigured,
  async fetch({ parsed, options, settings }: ProviderFetchInput): Promise<NormalizedVideoRead> {
    const endpointRaw = settings.customEndpoint!.trim()
    const safeEndpoint = assertSafeHttpUrl(endpointRaw)
    if (!safeEndpoint.ok) {
      return {
        platform: parsed.platform,
        url: parsed.canonicalUrl,
        videoId: parsed.videoId,
        transcript: null,
        warnings: [],
        partial: true,
        errorCode: 'SSRF_BLOCKED',
        errorMessage: `Custom endpoint blocked: ${safeEndpoint.errorMessage}`,
      }
    }
    const endpoint = safeEndpoint.url
    try {
      const data = await fetchJson<LooseProviderResponse>(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(settings.apiKey?.trim() ? { Authorization: `Bearer ${settings.apiKey.trim()}` } : {}),
        },
        body: JSON.stringify({
          url: parsed.canonicalUrl,
          language: options.language,
          mode: options.mode || 'transcript',
        }),
        signal: options.abortSignal,
        timeout: DEFAULT_PROVIDER_TIMEOUT_MS,
      })
      return mapResponse(parsed, data)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        platform: parsed.platform,
        url: parsed.canonicalUrl,
        videoId: parsed.videoId,
        transcript: null,
        warnings: [],
        partial: true,
        errorCode: /timeout|abort/i.test(message) ? 'TIMEOUT' : 'PROVIDER_FAILED',
        errorMessage: message,
      }
    }
  },
}
