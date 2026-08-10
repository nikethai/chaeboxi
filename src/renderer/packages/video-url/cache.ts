import type { NormalizedVideoRead, ReadVideoUrlOptions } from './types'

type CacheEntry = {
  value: NormalizedVideoRead
  expiresAt: number
}

const DEFAULT_TTL_MS = 1000 * 60 * 15 // 15 min
const MAX_ENTRIES = 64

const cache = new Map<string, CacheEntry>()

export function buildCacheKey(
  parsed: { platform: string; videoId?: string; canonicalUrl: string },
  options: Pick<ReadVideoUrlOptions, 'mode' | 'language' | 'maxChars' | 'startSec' | 'endSec' | 'includeTimestamps'>
): string {
  return JSON.stringify({
    p: parsed.platform,
    id: parsed.videoId || parsed.canonicalUrl,
    mode: options.mode || 'auto',
    lang: options.language || '',
    max: options.maxChars,
    start: options.startSec,
    end: options.endSec,
    ts: options.includeTimestamps !== false,
  })
}

export function getCachedVideoRead(key: string): NormalizedVideoRead | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return entry.value
}

export function setCachedVideoRead(key: string, value: NormalizedVideoRead, ttlMs = DEFAULT_TTL_MS): void {
  // Do not cache failures that may recover after config change or transient network issues
  if (
    value.errorCode === 'PROVIDER_REQUIRED' ||
    value.errorCode === 'PROVIDER_FAILED' ||
    value.errorCode === 'STT_FAILED' ||
    value.errorCode === 'RATE_LIMITED' ||
    value.errorCode === 'TIMEOUT' ||
    value.errorCode === 'NETWORK_ERROR' ||
    value.errorCode === 'NO_CAPTIONS'
  ) {
    return
  }
  if (cache.size >= MAX_ENTRIES) {
    const first = cache.keys().next().value
    if (first) cache.delete(first)
  }
  cache.set(key, { value, expiresAt: Date.now() + ttlMs })
}

export function clearVideoUrlCache(): void {
  cache.clear()
}

/** In-flight de-dupe for concurrent identical reads */
const inflight = new Map<string, Promise<NormalizedVideoRead>>()

export function getInflight(key: string): Promise<NormalizedVideoRead> | undefined {
  return inflight.get(key)
}

export function setInflight(key: string, promise: Promise<NormalizedVideoRead>): void {
  inflight.set(key, promise)
  void promise.finally(() => {
    inflight.delete(key)
  })
}
