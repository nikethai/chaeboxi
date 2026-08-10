import { parseVideoUrl } from './parse-url'
import type { ParsedVideoUrl } from './types'

const BLOCKED_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', 'metadata.google.internal', 'metadata'])

function isPrivateIpv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!m) return false
  const parts = m.slice(1).map((p) => Number(p))
  if (parts.some((n) => Number.isNaN(n) || n > 255)) return true
  const [a, b] = parts
  if (a === 10) return true
  if (a === 127) return true
  if (a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  return false
}

export type GuardResult =
  | { ok: true; parsed: ParsedVideoUrl }
  | { ok: false; errorCode: 'UNSUPPORTED_URL' | 'SSRF_BLOCKED'; errorMessage: string }

/**
 * Block localhost / private IP / non-http(s) for secondary fetches (caption tracks, custom endpoints, STT audio).
 * Does not require video platform allowlist.
 */
export function assertSafeHttpUrl(raw: string): { ok: true; url: string } | { ok: false; errorMessage: string } {
  const trimmed = raw?.trim()
  if (!trimmed) return { ok: false, errorMessage: 'Empty URL.' }
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return { ok: false, errorMessage: 'Invalid URL.' }
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, errorMessage: 'Only http(s) URLs are allowed.' }
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (BLOCKED_HOSTS.has(host) || host.endsWith('.local') || host.endsWith('.internal')) {
    return { ok: false, errorMessage: 'Local or internal hosts are blocked.' }
  }
  if (isPrivateIpv4(host)) {
    return { ok: false, errorMessage: 'Private IP addresses are blocked.' }
  }
  if (host.includes(':') && (host.startsWith('fc') || host.startsWith('fd') || host === '::1')) {
    return { ok: false, errorMessage: 'Private IP addresses are blocked.' }
  }
  return { ok: true, url: url.toString() }
}

/**
 * Allow only known video platform hosts over http(s). Block private IPs / localhost.
 */
export function guardVideoUrl(raw: string): GuardResult {
  const trimmed = raw?.trim()
  if (!trimmed) {
    return { ok: false, errorCode: 'UNSUPPORTED_URL', errorMessage: 'URL is required.' }
  }

  let url: URL
  try {
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    url = new URL(withScheme)
  } catch {
    return { ok: false, errorCode: 'UNSUPPORTED_URL', errorMessage: 'Invalid URL.' }
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, errorCode: 'SSRF_BLOCKED', errorMessage: 'Only http(s) URLs are allowed.' }
  }

  // Prefer HTTPS for product; still allow http for rare public mirrors but warn via host checks
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (BLOCKED_HOSTS.has(host) || host.endsWith('.local') || host.endsWith('.internal')) {
    return { ok: false, errorCode: 'SSRF_BLOCKED', errorMessage: 'Local or internal hosts are blocked.' }
  }
  if (isPrivateIpv4(host)) {
    return { ok: false, errorCode: 'SSRF_BLOCKED', errorMessage: 'Private IP addresses are blocked.' }
  }
  // Block bare IPv6 private-ish (simple heuristic)
  if (host.includes(':') && (host.startsWith('fc') || host.startsWith('fd') || host === '::1')) {
    return { ok: false, errorCode: 'SSRF_BLOCKED', errorMessage: 'Private IP addresses are blocked.' }
  }

  const parsed = parseVideoUrl(trimmed)
  if (!parsed) {
    return {
      ok: false,
      errorCode: 'UNSUPPORTED_URL',
      errorMessage: 'Unsupported video URL. Supported: YouTube, Vimeo, TikTok, Facebook (public links only).',
    }
  }

  return { ok: true, parsed }
}
