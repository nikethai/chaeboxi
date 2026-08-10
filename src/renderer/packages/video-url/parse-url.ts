import type { ParsedVideoUrl, VideoPlatform } from './types'

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, '')
}

function tryParseUrl(raw: string): URL | null {
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    return new URL(withScheme)
  } catch {
    return null
  }
}

function youtubeIdFromPath(pathname: string, searchParams: URLSearchParams): string | undefined {
  // /watch?v=
  const v = searchParams.get('v')
  if (v && /^[\w-]{6,}$/.test(v)) return v

  // /shorts/ID, /embed/ID, /live/ID, /v/ID
  const m = pathname.match(/\/(?:shorts|embed|live|v)\/([\w-]{6,})/)
  if (m) return m[1]

  // youtu.be/ID
  const bare = pathname.match(/^\/([\w-]{6,})\/?$/)
  if (bare) return bare[1]

  return undefined
}

function vimeoIdFromPath(pathname: string): string | undefined {
  // /123456789 or /channels/x/123 or /groups/x/videos/123 or /video/123
  const m = pathname.match(/(?:\/(?:channels|groups)\/[^/]+)?\/(?:videos?\/)?(\d{6,})/)
  return m?.[1]
}

function tiktokIdFromPath(pathname: string): string | undefined {
  // /@user/video/1234567890
  const m = pathname.match(/\/video\/(\d{8,})/)
  if (m) return m[1]
  // vm.tiktok.com short links leave id empty until redirect; keep path
  return undefined
}

function facebookIdFromUrl(url: URL): string | undefined {
  const v = url.searchParams.get('v')
  if (v && /^\d+$/.test(v)) return v
  // /reel/ID, /videos/ID, /share/v/ID, /share/r/ID, /watch/?v=
  const m = url.pathname.match(/\/(?:videos|reel|reels|share\/v|share\/r)\/(\d+)/) || url.pathname.match(/\/watch\/?$/)
  if (m?.[1]) return m[1]
  return v || undefined
}

export function detectPlatform(host: string): VideoPlatform {
  const h = normalizeHost(host)
  if (h === 'youtu.be' || h === 'youtube.com' || h === 'm.youtube.com' || h === 'music.youtube.com') {
    return 'youtube'
  }
  if (h === 'vimeo.com' || h === 'player.vimeo.com') return 'vimeo'
  if (h === 'tiktok.com' || h === 'm.tiktok.com' || h === 'vm.tiktok.com' || h.endsWith('.tiktok.com')) {
    return 'tiktok'
  }
  if (
    h === 'facebook.com' ||
    h === 'm.facebook.com' ||
    h === 'fb.watch' ||
    h === 'fb.com' ||
    h === 'web.facebook.com' ||
    h.endsWith('.facebook.com')
  ) {
    return 'facebook'
  }
  return 'unknown'
}

export function parseVideoUrl(raw: string): ParsedVideoUrl | null {
  const url = tryParseUrl(raw.trim())
  if (!url) return null

  const host = normalizeHost(url.hostname)
  const platform = detectPlatform(host)
  if (platform === 'unknown') return null

  let videoId: string | undefined
  let canonicalUrl = url.toString()

  switch (platform) {
    case 'youtube': {
      videoId = youtubeIdFromPath(url.pathname, url.searchParams)
      if (videoId) {
        canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`
      }
      break
    }
    case 'vimeo': {
      videoId = vimeoIdFromPath(url.pathname)
      if (videoId) {
        canonicalUrl = `https://vimeo.com/${videoId}`
      }
      break
    }
    case 'tiktok': {
      videoId = tiktokIdFromPath(url.pathname)
      canonicalUrl = url.toString()
      break
    }
    case 'facebook': {
      videoId = facebookIdFromUrl(url)
      canonicalUrl = url.toString()
      break
    }
  }

  return {
    platform,
    url: raw.trim(),
    canonicalUrl,
    videoId,
    host,
  }
}

export function isSupportedVideoUrl(raw: string): boolean {
  return parseVideoUrl(raw) != null
}
