import { ModelProviderEnum } from '@shared/types'
import { ofetch } from 'ofetch'
import { settingsStore } from '@/stores/settingsStore'
import { assertSafeHttpUrl } from '../guards'
import { fetchArrayBuffer } from '../http'
import { DEFAULT_STT_TIMEOUT_MS, type NormalizedVideoRead, type ParsedVideoUrl, type VideoUrlSettings } from '../types'

/**
 * STT fallback via OpenAI-compatible audio transcription.
 * Requires a public audio URL (from provider/desktop extractor) — URL-only STT
 * is not universal; this module is ready for media URLs when available.
 *
 * For product path when only a video page URL exists, we return STT_FAILED /
 * PROVIDER_REQUIRED rather than pretending Whisper can ingest a watch page.
 */
export function resolveSttApiKey(settings: VideoUrlSettings): string | null {
  if (settings.sttProvider === 'none') return null
  if (settings.sttApiKey?.trim()) return settings.sttApiKey.trim()

  // Reuse OpenAI provider key when present
  try {
    const providers = settingsStore.getState().providers
    const openai = providers?.[ModelProviderEnum.OpenAI]
    const key = openai?.apiKey?.trim()
    if (key) return key
  } catch {
    // settings unavailable (tests)
  }
  return null
}

export function isSttConfigured(settings: VideoUrlSettings): boolean {
  return settings.sttProvider === 'openai' && Boolean(resolveSttApiKey(settings))
}

export async function transcribeAudioUrl(input: {
  audioUrl: string
  language?: string
  settings: VideoUrlSettings
  parsed: ParsedVideoUrl
  abortSignal?: AbortSignal
}): Promise<NormalizedVideoRead> {
  const apiKey = resolveSttApiKey(input.settings)
  if (!apiKey) {
    return {
      platform: input.parsed.platform,
      url: input.parsed.canonicalUrl,
      videoId: input.parsed.videoId,
      transcript: null,
      warnings: [],
      partial: true,
      errorCode: 'PROVIDER_REQUIRED',
      errorMessage: 'STT is not configured. Set an OpenAI-compatible STT key in Settings → Video URL.',
    }
  }

  const safeAudio = assertSafeHttpUrl(input.audioUrl)
  if (!safeAudio.ok) {
    return {
      platform: input.parsed.platform,
      url: input.parsed.canonicalUrl,
      videoId: input.parsed.videoId,
      transcript: null,
      warnings: [],
      partial: true,
      errorCode: 'SSRF_BLOCKED',
      errorMessage: `STT audio URL blocked: ${safeAudio.errorMessage}`,
    }
  }

  try {
    // Download audio blob then send to Whisper-compatible endpoint
    const audio = await fetchArrayBuffer(safeAudio.url, {
      signal: input.abortSignal,
      timeout: DEFAULT_STT_TIMEOUT_MS,
    })

    const form = new FormData()
    form.append('file', new Blob([audio], { type: 'audio/mpeg' }), 'audio.mp3')
    form.append('model', 'whisper-1')
    if (input.language) form.append('language', input.language.split('-')[0])

    const result = await ofetch<{ text?: string }>('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
      signal: input.abortSignal,
      timeout: DEFAULT_STT_TIMEOUT_MS,
    })

    const text = result.text?.trim()
    if (!text) {
      return {
        platform: input.parsed.platform,
        url: input.parsed.canonicalUrl,
        videoId: input.parsed.videoId,
        transcript: null,
        warnings: [],
        partial: true,
        errorCode: 'STT_FAILED',
        errorMessage: 'STT returned empty transcript.',
      }
    }

    return {
      platform: input.parsed.platform,
      url: input.parsed.canonicalUrl,
      videoId: input.parsed.videoId,
      transcript: {
        source: 'stt',
        language: input.language,
        text,
      },
      warnings: ['Transcript produced via speech-to-text (may contain errors).'],
      partial: false,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      platform: input.parsed.platform,
      url: input.parsed.canonicalUrl,
      videoId: input.parsed.videoId,
      transcript: null,
      warnings: [],
      partial: true,
      errorCode: /timeout|abort/i.test(message) ? 'TIMEOUT' : 'STT_FAILED',
      errorMessage: message,
    }
  }
}

/**
 * When we only have a page URL (no audio), STT cannot run. Surface actionable error.
 */
export function sttRequiresMedia(parsed: ParsedVideoUrl): NormalizedVideoRead {
  return {
    platform: parsed.platform,
    url: parsed.canonicalUrl,
    videoId: parsed.videoId,
    transcript: null,
    warnings: [
      'STT needs an audio/media URL. Enable desktop extractor or a provider that returns audio, or paste captions via provider.',
    ],
    partial: true,
    errorCode: 'STT_FAILED',
    errorMessage:
      'Cannot run STT on a watch-page URL alone. Configure a multi-platform transcript provider, or enable desktop extractor.',
  }
}
