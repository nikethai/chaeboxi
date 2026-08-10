import uniq from 'lodash/uniq'
import { ofetch } from 'ofetch'
import { CHATBOX_CLOUD_ENABLED } from '../product'
import { cache } from '../utils/cache'

let API_ORIGIN = 'https://api.chatboxai.app'

let POOL = [
  'https://api.chatboxai.app',
  'https://chatboxai.app',
  'https://api.ai-chatbox.com',
  'https://api.chatboxapp.xyz',
]

/** True when Chaeboxi may call Chaeboxi hosted APIs (local dev override or explicit enable). */
export function isChatboxCloudAllowed(): boolean {
  return CHATBOX_CLOUD_ENABLED || Boolean(process.env.USE_LOCAL_API)
}

export function isChatboxAPI(input: RequestInfo | URL) {
  const url = typeof input === 'string' ? input : (input as Request).url ?? input.toString()
  return POOL.some((o) => url.startsWith(o)) || url.startsWith(API_ORIGIN)
}

export function getChatboxAPIOrigin() {
  if (process.env.USE_LOCAL_API) {
    return 'http://localhost:8002'
  }
  // When cloud is disabled, callers must short-circuit before using this origin.
  return API_ORIGIN
}

/**
 * Probe API origins in order; switch traffic to the first healthy origin.
 * During probing, new origins returned by the server are merged and cached locally.
 *
 * Chaeboxi: no-op when Chaeboxi cloud is disabled (stability + no upstream traffic).
 */
export async function testApiOrigins() {
  if (!isChatboxCloudAllowed()) {
    return []
  }

  // Probe API origin availability in order
  const result = await cache(
    'api_origins',
    async () => {
      let i = 0
      let pool = POOL
      while (i < pool.length) {
        try {
          const origin: string = pool[i]
          const controller = new AbortController()
          setTimeout(() => controller.abort(), 2000) // 2s timeout
          const res = await ofetch<{ data: { api_origins: string[] } }>(`${origin}/api/api_origins`, {
            signal: controller.signal,
            retry: 1,
          })
          // If the server returns new API origins, update the cache
          if (res.data.api_origins.length > 0) {
            pool = uniq([...pool, ...res.data.api_origins])
          }
          // If the current origin is healthy, route traffic there
          API_ORIGIN = origin
          pool = uniq([origin, ...pool]) // Move the current origin to the front of the list
          POOL = pool
          return pool
        } catch {
          i++
        }
      }
      return POOL
    },
    { ttl: 1000 * 60 * 60, refreshFallbackToCache: true } // 1h cache; on failure fall back to previous cache
  )

  return result
}
