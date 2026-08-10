import { assertSafeHttpUrl } from '../guards'
import { fetchJson, fetchText } from '../http'
import type { NormalizedTranscript, NormalizedVideoRead, ParsedVideoUrl, TranscriptSegment } from '../types'
import { DEFAULT_CAPTION_TIMEOUT_MS } from '../types'
import type { AdapterFetchOptions, PlatformAdapter } from './types'

type CaptionTrack = {
  baseUrl: string
  languageCode?: string
  name?: { simpleText?: string } | string
  kind?: string // "asr" for auto
}

type PlayerPayload = {
  videoDetails?: {
    title?: string
    author?: string
    shortDescription?: string
    lengthSeconds?: string
    thumbnail?: { thumbnails?: Array<{ url?: string }> }
  }
  playabilityStatus?: { status?: string; reason?: string }
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: CaptionTrack[]
      translationLanguages?: Array<{ languageCode?: string }>
    }
  }
}

/** Clients that still return usable timedtext URLs (WEB often returns empty tracks). */
const INNERTUBE_CLIENTS = [
  {
    clientName: 'ANDROID',
    clientVersion: '20.10.38',
    userAgent: 'com.google.android.youtube/20.10.38 (Linux; U; Android 13) gzip',
  },
  {
    clientName: 'IOS',
    clientVersion: '20.10.4',
    userAgent: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 17_5 like Mac OS X)',
  },
] as const

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

function trackName(track: CaptionTrack): string {
  if (typeof track.name === 'string') return track.name
  return track.name?.simpleText || ''
}

function pickCaptionTrack(tracks: CaptionTrack[], language?: string): CaptionTrack[] {
  if (!tracks.length) return []
  const ordered = [...tracks]
  // Prefer requested language, then manual over ASR, keep rest as fallbacks
  ordered.sort((a, b) => {
    const score = (t: CaptionTrack) => {
      let s = 0
      if (language) {
        const lang = language.toLowerCase()
        const code = t.languageCode?.toLowerCase() || ''
        if (code === lang) s += 100
        else if (code.startsWith(lang.split('-')[0])) s += 50
      } else if (t.languageCode?.toLowerCase().startsWith('en')) {
        s += 20
      }
      if (t.kind !== 'asr') s += 10
      return s
    }
    return score(b) - score(a)
  })
  return ordered
}

function parseJson3Transcript(data: {
  events?: Array<{ tStartMs?: number; dDurationMs?: number; segs?: Array<{ utf8?: string }> }>
}): TranscriptSegment[] {
  const segments: TranscriptSegment[] = []
  for (const ev of data.events || []) {
    if (!ev.segs?.length) continue
    const text = ev.segs
      .map((s) => s.utf8 || '')
      .join('')
      .replace(/\n/g, ' ')
      .trim()
    if (!text || text === '\n') continue
    const startSec = (ev.tStartMs || 0) / 1000
    const endSec = ev.dDurationMs != null ? startSec + ev.dDurationMs / 1000 : undefined
    segments.push({ startSec, endSec, text: decodeHtmlEntities(text) })
  }
  return segments
}

function parseSrv3Xml(xml: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = []
  const re = /<text start="([\d.]+)"[^>]*(?:dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g
  let m = re.exec(xml)
  while (m) {
    const startSec = Number(m[1])
    const dur = m[2] != null ? Number(m[2]) : undefined
    const raw = m[3]
      .replace(/<[^>]+>/g, '')
      .replace(/\n/g, ' ')
      .trim()
    if (raw) {
      segments.push({
        startSec,
        endSec: dur != null ? startSec + dur : undefined,
        text: decodeHtmlEntities(raw),
      })
    }
    m = re.exec(xml)
  }
  return segments
}

function parseVtt(vtt: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = []
  const blocks = vtt.replace(/\r/g, '').split(/\n\n+/)
  for (const block of blocks) {
    const lines = block.split('\n').filter(Boolean)
    if (!lines.length || lines[0].startsWith('WEBVTT') || lines[0].startsWith('NOTE') || lines[0].startsWith('Kind:')) {
      continue
    }
    const timeLine = lines.find((l) => l.includes('-->'))
    if (!timeLine) continue
    const [startRaw, endRaw] = timeLine.split('-->').map((s) => s.trim())
    const startSec = parseVttTime(startRaw)
    const endSec = parseVttTime(endRaw.split(/\s+/)[0])
    const textLines = lines.slice(lines.indexOf(timeLine) + 1)
    const text = textLines
      .join(' ')
      .replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, '') // karaoke tags
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!text) continue
    segments.push({ startSec, endSec, text: decodeHtmlEntities(text) })
  }
  return segments
}

function parseVttTime(raw: string): number {
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

async function fetchCaptionSegments(
  baseUrl: string,
  signal?: AbortSignal
): Promise<{ segments: TranscriptSegment[]; language?: string }> {
  const safe = assertSafeHttpUrl(baseUrl)
  if (!safe.ok) {
    throw new Error(`Caption URL blocked: ${safe.errorMessage}`)
  }

  // Try formats in order of parse reliability
  for (const fmt of ['json3', 'srv3', 'vtt'] as const) {
    try {
      const url = new URL(safe.url)
      url.searchParams.set('fmt', fmt)
      if (fmt === 'json3') {
        const data = await fetchJson<{
          events?: Array<{ tStartMs?: number; dDurationMs?: number; segs?: Array<{ utf8?: string }> }>
        }>(url.toString(), {
          signal,
          timeout: DEFAULT_CAPTION_TIMEOUT_MS,
          headers: {
            'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 13) gzip',
          },
        })
        const segments = parseJson3Transcript(data)
        if (segments.length) return { segments }
      } else {
        const body = await fetchText(url.toString(), {
          signal,
          timeout: DEFAULT_CAPTION_TIMEOUT_MS,
          headers: {
            'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 13) gzip',
          },
        })
        if (!body.trim()) continue
        const segments = fmt === 'vtt' ? parseVtt(body) : parseSrv3Xml(body)
        if (segments.length) return { segments }
      }
    } catch {
      // try next format
    }
  }

  return { segments: [] }
}

async function fetchInnertubePlayer(
  videoId: string,
  language: string | undefined,
  signal?: AbortSignal
): Promise<PlayerPayload | null> {
  for (const client of INNERTUBE_CLIENTS) {
    try {
      const data = await fetchJson<PlayerPayload>('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST',
        signal,
        timeout: DEFAULT_CAPTION_TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': client.userAgent,
          'X-Youtube-Client-Name': client.clientName === 'ANDROID' ? '3' : '5',
          'X-Youtube-Client-Version': client.clientVersion,
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: client.clientName,
              clientVersion: client.clientVersion,
              hl: language?.split('-')[0] || 'en',
              gl: 'US',
            },
          },
          videoId,
          contentCheckOk: true,
          racyCheckOk: true,
        }),
      })
      const status = data.playabilityStatus?.status
      if (status && status !== 'OK' && status !== 'LIVE_STREAM_OFFLINE') {
        continue
      }
      // Prefer a client that exposes caption tracks when we need transcript
      if (data.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length || data.videoDetails?.title) {
        return data
      }
    } catch {
      // try next client
    }
  }
  return null
}

function applyPlayerMeta(base: NormalizedVideoRead, player: PlayerPayload): void {
  const videoDetails = player.videoDetails
  if (!videoDetails) return
  base.title = videoDetails.title || base.title
  base.author = videoDetails.author || base.author
  base.description = videoDetails.shortDescription || base.description
  if (videoDetails.lengthSeconds) {
    base.durationSec = Number(videoDetails.lengthSeconds)
  }
  const thumbs = videoDetails.thumbnail?.thumbnails
  if (thumbs?.length) {
    base.thumbnailUrl = thumbs[thumbs.length - 1]?.url || base.thumbnailUrl
  }
}

function extractPlayerResponseFromHtml(html: string): PlayerPayload | null {
  const idx = html.indexOf('ytInitialPlayerResponse')
  if (idx === -1) return null
  const brace = html.indexOf('{', idx)
  if (brace === -1) return null
  let depth = 0
  for (let i = brace; i < Math.min(html.length, brace + 2_000_000); i++) {
    const c = html[i]
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(brace, i + 1)) as PlayerPayload
        } catch {
          return null
        }
      }
    }
  }
  return null
}

async function fetchCaptionFromTracks(
  tracks: CaptionTrack[],
  language: string | undefined,
  signal?: AbortSignal
): Promise<{ segments: TranscriptSegment[]; language?: string; trackLabel?: string } | null> {
  const ordered = pickCaptionTrack(tracks, language)
  for (const track of ordered) {
    if (!track.baseUrl) continue
    try {
      const { segments } = await fetchCaptionSegments(track.baseUrl, signal)
      if (segments.length) {
        return {
          segments,
          language: track.languageCode || language,
          trackLabel: trackName(track) || track.languageCode,
        }
      }
    } catch {
      // try next track
    }
  }
  return null
}

export async function fetchYouTubeVideo(
  parsed: ParsedVideoUrl,
  options: AdapterFetchOptions = {}
): Promise<NormalizedVideoRead> {
  const base: NormalizedVideoRead = {
    platform: 'youtube',
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
      errorMessage: 'Could not extract YouTube video id from URL.',
      partial: true,
    }
  }

  try {
    // 1) Innertube (ANDROID/IOS) — caption timedtext URLs actually return content
    let player = await fetchInnertubePlayer(parsed.videoId, options.language, options.abortSignal)

    // 2) HTML watch page fallback for metadata (WEB timedtext often empty)
    if (!player?.videoDetails?.title) {
      try {
        const html = await fetchText(parsed.canonicalUrl, {
          signal: options.abortSignal,
          timeout: DEFAULT_CAPTION_TIMEOUT_MS,
          headers: {
            'Accept-Language': options.language || 'en-US,en;q=0.9',
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          },
        })
        const htmlPlayer = extractPlayerResponseFromHtml(html)
        if (htmlPlayer) {
          if (!player) player = htmlPlayer
          else {
            // merge meta if innertube missing fields
            applyPlayerMeta(base, htmlPlayer)
            if (!player.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length) {
              player.captions = htmlPlayer.captions
            }
          }
        }
      } catch {
        // ignore html fallback errors
      }
    }

    if (!player) {
      return {
        ...base,
        errorCode: 'PRIVATE_OR_UNAVAILABLE',
        errorMessage: 'Could not load YouTube player data (private, age-restricted, or blocked).',
        partial: true,
      }
    }

    applyPlayerMeta(base, player)

    const playability = player.playabilityStatus
    if (playability?.status && playability.status !== 'OK' && playability.status !== 'LIVE_STREAM_OFFLINE') {
      return {
        ...base,
        errorCode: 'PRIVATE_OR_UNAVAILABLE',
        errorMessage: playability.reason || `Video unavailable (${playability.status}).`,
        partial: true,
      }
    }

    if (options.mode === 'metadata') {
      return base
    }

    let tracks = player.captions?.playerCaptionsTracklistRenderer?.captionTracks || []

    // If innertube player had meta but no tracks, try ANDROID again was already done;
    // retry innertube once more is redundant. Attempt HTML tracks if empty.
    if (!tracks.length) {
      try {
        const html = await fetchText(parsed.canonicalUrl, {
          signal: options.abortSignal,
          timeout: DEFAULT_CAPTION_TIMEOUT_MS,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          },
        })
        const htmlPlayer = extractPlayerResponseFromHtml(html)
        tracks = htmlPlayer?.captions?.playerCaptionsTracklistRenderer?.captionTracks || []
      } catch {
        // ignore
      }
    }

    if (!tracks.length) {
      return {
        ...base,
        errorCode: 'NO_CAPTIONS',
        errorMessage:
          'No captions available for this YouTube video. Enable a transcript provider, STT, or desktop extractor in Settings → Video URL.',
        partial: true,
        warnings: [...base.warnings, 'NO_CAPTIONS'],
      }
    }

    const caption = await fetchCaptionFromTracks(tracks, options.language, options.abortSignal)
    if (!caption?.segments.length) {
      return {
        ...base,
        errorCode: 'NO_CAPTIONS',
        errorMessage:
          'Caption tracks were listed but could not be downloaded. Try again, or configure a BYOK provider / desktop extractor.',
        partial: true,
        warnings: [
          ...base.warnings,
          `Found ${tracks.length} caption track(s) but timedtext returned empty (tried ${tracks
            .map((t) => t.languageCode || trackName(t) || 'unknown')
            .join(', ')}).`,
        ],
      }
    }

    const transcript: NormalizedTranscript = {
      source: 'captions',
      language: caption.language || options.language,
      text: caption.segments.map((s) => s.text).join(' '),
      segments: caption.segments,
    }

    return {
      ...base,
      transcript,
      partial: false,
      warnings: caption.trackLabel?.includes('auto')
        ? [...base.warnings, 'Using auto-generated captions (may contain errors).']
        : base.warnings,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const isAbort = options.abortSignal?.aborted || /abort|timeout/i.test(message)
    return {
      ...base,
      errorCode: isAbort ? 'TIMEOUT' : 'NETWORK_ERROR',
      errorMessage: message,
      partial: true,
    }
  }
}

export const youtubeAdapter: PlatformAdapter = {
  platform: 'youtube',
  fetch: fetchYouTubeVideo,
}
