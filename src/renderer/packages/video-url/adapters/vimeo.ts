import { assertSafeHttpUrl } from '../guards'
import { fetchJson, fetchText } from '../http'
import type { ParsedVideoUrl } from '../types'
import { DEFAULT_CAPTION_TIMEOUT_MS, type NormalizedVideoRead, type TranscriptSegment } from '../types'
import type { AdapterFetchOptions, PlatformAdapter } from './types'

type VimeoOEmbed = {
  title?: string
  author_name?: string
  description?: string
  duration?: number
  thumbnail_url?: string
  html?: string
}

async function fetchOEmbed(videoId: string, signal?: AbortSignal): Promise<VimeoOEmbed | null> {
  try {
    return await fetchJson<VimeoOEmbed>('https://vimeo.com/api/oembed.json', {
      query: { url: `https://vimeo.com/${videoId}` },
      signal,
      timeout: DEFAULT_CAPTION_TIMEOUT_MS,
    })
  } catch {
    return null
  }
}

/**
 * Best-effort public text tracks. Vimeo often requires auth for full transcript API;
 * we try the public config endpoint when available.
 */
async function tryPublicTextTracks(
  videoId: string,
  language: string | undefined,
  signal?: AbortSignal
): Promise<{ text: string; segments?: TranscriptSegment[]; language?: string } | null> {
  try {
    // player config (public videos sometimes expose text tracks)
    const config = await fetchJson<{
      request?: {
        files?: {
          text_tracks?: Array<{
            lang?: string
            url?: string
            kind?: string
          }>
        }
      }
      video?: { title?: string }
    }>(`https://player.vimeo.com/video/${videoId}/config`, {
      signal,
      timeout: DEFAULT_CAPTION_TIMEOUT_MS,
    })

    const tracks = config.request?.files?.text_tracks || []
    if (!tracks.length) return null

    let track = tracks[0]
    if (language) {
      const match = tracks.find((t) => t.lang?.toLowerCase().startsWith(language.toLowerCase().split('-')[0]))
      if (match) track = match
    }
    if (!track.url) return null

    const trackUrl = track.url.startsWith('http') ? track.url : `https://vimeo.com${track.url}`
    const safeTrack = assertSafeHttpUrl(trackUrl)
    if (!safeTrack.ok) return null
    const body = await fetchText(safeTrack.url, {
      signal,
      timeout: DEFAULT_CAPTION_TIMEOUT_MS,
    })

    // VTT
    if (body.includes('WEBVTT') || trackUrl.includes('.vtt')) {
      const segments = parseVtt(body)
      if (!segments.length) return null
      return {
        text: segments.map((s) => s.text).join(' '),
        segments,
        language: track.lang,
      }
    }

    // plain text fallback
    const text = body.trim()
    if (!text) return null
    return { text, language: track.lang }
  } catch {
    return null
  }
}

function parseVtt(vtt: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = []
  const blocks = vtt.replace(/\r/g, '').split(/\n\n+/)
  for (const block of blocks) {
    const lines = block.split('\n').filter(Boolean)
    if (!lines.length || lines[0].startsWith('WEBVTT') || lines[0].startsWith('NOTE')) continue
    const timeLine = lines.find((l) => l.includes('-->'))
    if (!timeLine) continue
    const [startRaw, endRaw] = timeLine.split('-->').map((s) => s.trim())
    const startSec = parseVttTime(startRaw)
    const endSec = parseVttTime(endRaw.split(/\s+/)[0])
    const textLines = lines.slice(lines.indexOf(timeLine) + 1)
    const text = textLines
      .join(' ')
      .replace(/<[^>]+>/g, '')
      .trim()
    if (!text) continue
    segments.push({ startSec, endSec, text })
  }
  return segments
}

function parseVttTime(raw: string): number {
  // 00:01:02.500 or 01:02.500
  const parts = raw.trim().split(':')
  if (parts.length === 3) {
    const [h, m, s] = parts
    return Number(h) * 3600 + Number(m) * 60 + Number(s)
  }
  if (parts.length === 2) {
    const [m, s] = parts
    return Number(m) * 60 + Number(s)
  }
  return Number(raw) || 0
}

export async function fetchVimeoVideo(
  parsed: ParsedVideoUrl,
  options: AdapterFetchOptions = {}
): Promise<NormalizedVideoRead> {
  const base: NormalizedVideoRead = {
    platform: 'vimeo',
    url: parsed.canonicalUrl,
    videoId: parsed.videoId,
    warnings: [],
    partial: false,
    transcript: null,
  }

  if (!parsed.videoId) {
    return {
      ...base,
      errorCode: 'UNSUPPORTED_URL',
      errorMessage: 'Could not extract Vimeo video id.',
      partial: true,
    }
  }

  const oembed = await fetchOEmbed(parsed.videoId, options.abortSignal)
  if (oembed) {
    base.title = oembed.title
    base.author = oembed.author_name
    base.description = oembed.description
    base.durationSec = oembed.duration
    base.thumbnailUrl = oembed.thumbnail_url
  } else {
    base.warnings.push('Metadata unavailable via oEmbed (private or restricted).')
  }

  // Page OG as fallback for description / thumbnail when oEmbed is thin
  if (!base.description || !base.thumbnailUrl) {
    try {
      const html = await fetchText(parsed.canonicalUrl, {
        signal: options.abortSignal,
        timeout: DEFAULT_CAPTION_TIMEOUT_MS,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
      })
      const ogDesc =
        html.match(/property="og:description"\s+content="([^"]+)"/i)?.[1] ||
        html.match(/content="([^"]+)"\s+property="og:description"/i)?.[1]
      const ogImage =
        html.match(/property="og:image"\s+content="([^"]+)"/i)?.[1] ||
        html.match(/content="([^"]+)"\s+property="og:image"/i)?.[1]
      if (!base.description && ogDesc) {
        base.description = decodeHtml(ogDesc)
      }
      if (!base.thumbnailUrl && ogImage) {
        base.thumbnailUrl = decodeHtml(ogImage)
      }
    } catch {
      // ignore
    }
  }

  if (options.mode === 'metadata') {
    return base
  }

  const tracks = await tryPublicTextTracks(parsed.videoId, options.language, options.abortSignal)
  if (tracks) {
    return {
      ...base,
      transcript: {
        source: 'captions',
        language: tracks.language || options.language,
        text: tracks.text,
        segments: tracks.segments,
      },
    }
  }

  // Many public Vimeo videos have no free text tracks (config 403). Creator description
  // is still useful context so the agent can summarize without a hard failure.
  if (base.description?.trim()) {
    return {
      ...base,
      transcript: {
        source: 'oembed',
        text: base.description.trim(),
      },
      partial: true,
      warnings: [
        ...base.warnings,
        'No public caption track; using creator description as context. Configure a provider/STT for spoken transcript.',
      ],
    }
  }

  return {
    ...base,
    errorCode: 'NO_CAPTIONS',
    errorMessage:
      'No public Vimeo captions or description found. Configure a transcript provider or STT in Settings → Video URL.',
    partial: true,
    warnings: [...base.warnings, 'NO_CAPTIONS'],
  }
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

export const vimeoAdapter: PlatformAdapter = {
  platform: 'vimeo',
  fetch: fetchVimeoVideo,
}
