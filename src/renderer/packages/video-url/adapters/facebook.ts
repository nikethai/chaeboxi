import { fetchTextSoft } from '../http'
import type { ParsedVideoUrl } from '../types'
import { DEFAULT_CAPTION_TIMEOUT_MS, type NormalizedVideoRead } from '../types'
import type { AdapterFetchOptions, PlatformAdapter } from './types'

/** Bot UA often gets public OG where browser UA gets login/error HTML. */
const FB_USER_AGENTS = [
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
]

function decode(s?: string): string | undefined {
  if (!s) return undefined
  return s
    .replace(/\\u0026/g, '&')
    .replace(/\\n/g, '\n')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\\"/g, '"')
}

function extractMeta(html: string): { title?: string; description?: string; thumbnailUrl?: string } {
  const pick = (...patterns: RegExp[]): string | undefined => {
    for (const re of patterns) {
      const m = html.match(re)
      if (m?.[1]) return decode(m[1])
    }
    return undefined
  }

  const title = pick(
    /property=["']og:title["']\s+content=["']([^"']+)["']/i,
    /content=["']([^"']+)["']\s+property=["']og:title["']/i,
    /<meta[^>]+name=["']title["'][^>]+content=["']([^"']+)["']/i,
    /"name"\s*:\s*"((?:\\.|[^"\\]){8,120})"/
  )

  const description = pick(
    /property=["']og:description["']\s+content=["']([^"']+)["']/i,
    /content=["']([^"']+)["']\s+property=["']og:description["']/i,
    /"message"\s*:\s*\{\s*"text"\s*:\s*"((?:\\.|[^"\\]){10,2000})"/,
    /"creation_story"[\s\S]{0,400}?"message"\s*:\s*\{\s*"text"\s*:\s*"((?:\\.|[^"\\]){10,2000})"/,
    /"description"\s*:\s*"((?:\\.|[^"\\]){20,1000})"/
  )

  const thumbnailUrl = pick(
    /property=["']og:image["']\s+content=["']([^"']+)["']/i,
    /content=["']([^"']+)["']\s+property=["']og:image["']/i,
    /"preferred_thumbnail"[^}]*"uri"\s*:\s*"((?:\\.|[^"\\])+)"/,
    /"image"\s*:\s*\{\s*"uri"\s*:\s*"((?:\\.|[^"\\])+)"/
  )

  // Reject generic login-wall titles
  const cleanTitle = title && !/log in or sign up/i.test(title) && !/^facebook$/i.test(title.trim()) ? title : undefined
  const cleanDesc =
    description && !/log in or sign up/i.test(description) && !/see posts, photos/i.test(description)
      ? description
      : undefined

  return { title: cleanTitle, description: cleanDesc, thumbnailUrl }
}

function candidateUrls(parsed: ParsedVideoUrl): string[] {
  const urls = new Set<string>()
  urls.add(parsed.canonicalUrl)
  urls.add(parsed.url)
  const id = parsed.videoId
  if (id) {
    urls.add(`https://www.facebook.com/reel/${id}`)
    urls.add(`https://www.facebook.com/watch/?v=${id}`)
    urls.add(`https://www.facebook.com/share/v/${id}/`)
    urls.add(`https://www.facebook.com/share/r/${id}/`)
    urls.add(`https://m.facebook.com/reel/${id}`)
  }
  return [...urls]
}

/**
 * Facebook free path: best-effort public metadata (OG / embed HTML).
 * Full spoken transcripts require BYOK provider / STT. No login bypass.
 */
export async function fetchFacebookVideo(
  parsed: ParsedVideoUrl,
  options: AdapterFetchOptions = {}
): Promise<NormalizedVideoRead> {
  const base: NormalizedVideoRead = {
    platform: 'facebook',
    url: parsed.canonicalUrl,
    videoId: parsed.videoId,
    warnings: [],
    partial: true,
    transcript: null,
  }

  let lastStatus = 0
  const tried: string[] = []

  for (const pageUrl of candidateUrls(parsed)) {
    for (const ua of FB_USER_AGENTS) {
      tried.push(`${pageUrl} (${ua.slice(0, 24)}…)`)
      const res = await fetchTextSoft(pageUrl, {
        signal: options.abortSignal,
        timeout: DEFAULT_CAPTION_TIMEOUT_MS,
        headers: {
          'User-Agent': ua,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': options.language || 'en-US,en;q=0.9',
        },
      })
      lastStatus = res.status
      if (!res.text || res.text.length < 200) continue

      const meta = extractMeta(res.text)
      if (meta.title) base.title = meta.title
      if (meta.description) base.description = meta.description
      if (meta.thumbnailUrl) base.thumbnailUrl = meta.thumbnailUrl

      if (base.title || base.description || base.thumbnailUrl) {
        // Enough public surface to stop
        break
      }
    }
    if (base.title || base.description || base.thumbnailUrl) break
  }

  if (!base.title && !base.description) {
    base.warnings.push(
      lastStatus
        ? `Facebook blocked public metadata scrape (HTTP ${lastStatus}). Reels often require login or a BYOK provider.`
        : 'Facebook metadata unavailable (network error).'
    )
  }

  if (options.mode === 'metadata') {
    base.partial = !base.title && !base.description
    return base
  }

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
        'No spoken transcript available without a provider/STT; using public page text when present.',
      ],
    }
  }

  return {
    ...base,
    errorCode: 'PROVIDER_REQUIRED',
    errorMessage:
      'Facebook did not expose public captions or description for this link (common for Reels). Configure a multi-platform provider or STT under Settings → Video URL, or paste the caption text.',
    warnings: [
      ...base.warnings,
      'Native Facebook captions for arbitrary public URLs are not available without a provider.',
    ],
  }
}

export const facebookAdapter: PlatformAdapter = {
  platform: 'facebook',
  fetch: fetchFacebookVideo,
}
