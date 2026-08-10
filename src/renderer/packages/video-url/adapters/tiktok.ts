import { fetchJson } from '../http'
import type { ParsedVideoUrl } from '../types'
import { DEFAULT_CAPTION_TIMEOUT_MS, type NormalizedVideoRead } from '../types'
import type { AdapterFetchOptions, PlatformAdapter } from './types'

type OEmbed = {
  title?: string
  author_name?: string
  author_url?: string
  thumbnail_url?: string
  html?: string
}

async function fetchOEmbed(url: string, signal?: AbortSignal): Promise<OEmbed | null> {
  try {
    return await fetchJson<OEmbed>('https://www.tiktok.com/oembed', {
      query: { url },
      signal,
      timeout: DEFAULT_CAPTION_TIMEOUT_MS,
    })
  } catch {
    return null
  }
}

/**
 * TikTok free path: metadata only. Transcript requires provider or STT.
 */
export async function fetchTikTokVideo(
  parsed: ParsedVideoUrl,
  options: AdapterFetchOptions = {}
): Promise<NormalizedVideoRead> {
  const base: NormalizedVideoRead = {
    platform: 'tiktok',
    url: parsed.canonicalUrl,
    videoId: parsed.videoId,
    warnings: [],
    partial: true,
    transcript: null,
  }

  const oembed = await fetchOEmbed(parsed.canonicalUrl, options.abortSignal)
  if (oembed) {
    base.title = oembed.title
    base.author = oembed.author_name
    base.thumbnailUrl = oembed.thumbnail_url
    // TikTok oEmbed title often is the caption text
    if (oembed.title && options.mode === 'metadata') {
      base.description = oembed.title
    } else if (oembed.title) {
      base.description = oembed.title
    }
  } else {
    base.warnings.push('TikTok metadata unavailable (region block or private).')
  }

  if (options.mode === 'metadata') {
    base.partial = false
    return base
  }

  // oEmbed title is often the caption text — useful soft context without a provider.
  const soft = (base.description || base.title || '').trim()
  if (soft) {
    return {
      ...base,
      transcript: {
        source: 'oembed',
        text: soft,
      },
      partial: true,
      warnings: [
        ...base.warnings,
        'No native transcript track; using public caption/title text. Configure a provider/STT for spoken audio.',
      ],
    }
  }

  return {
    ...base,
    errorCode: 'PROVIDER_REQUIRED',
    errorMessage: 'TikTok transcripts require a BYOK multi-platform provider or STT. Configure Settings → Video URL.',
    warnings: [...base.warnings, 'Native TikTok captions are not available without a provider.'],
  }
}

export const tiktokAdapter: PlatformAdapter = {
  platform: 'tiktok',
  fetch: fetchTikTokVideo,
}
