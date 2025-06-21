import uniq from 'lodash/uniq'
import { ofetch } from 'ofetch'

let API_ORIGIN = 'https://api.chatboxai.app'

let POOL = [
  'https://api.chatboxai.app',
  'https://chatboxai.app',
  'https://api.ai-chatbox.com',
  'https://api.chatboxapp.xyz',
]

export function isChatboxAPI(input: RequestInfo | URL) {
  const url = typeof input === 'string' ? input : (input as Request).url ?? input.toString()
  return POOL.some((o) => url.startsWith(o)) || url.startsWith(API_ORIGIN)
}

export function getChatboxAPIOrigin() {
  if (process.env.USE_LOCAL_API) {
    return 'http://localhost:8002'
  }
  return API_ORIGIN
}

// memory cache
interface CacheItem<T> {
  value: T
  timestamp: number
  ttl: number
}

// Cross-platform storage
class CrossPlatformStorage {
  private memoryCache = new Map<string, CacheItem<any>>()

  set(key: string, value: any): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      // Browser environment
      try {
        localStorage.setItem(key, JSON.stringify(value))
      } catch (error) {
        // Fallback to memory if localStorage fails
        this.memoryCache.set(key, value)
      }
    } else {
      // Node.js environment
      this.memoryCache.set(key, value)
    }
  }

  get(key: string): any {
    if (typeof window !== 'undefined' && window.localStorage) {
      // Browser environment
      try {
        const item = localStorage.getItem(key)
        return item ? JSON.parse(item) : null
      } catch (error) {
        // Fallback to memory if localStorage fails
        return this.memoryCache.get(key) || null
      }
    } else {
      // Node.js environment
      return this.memoryCache.get(key) || null
    }
  }

  delete(key: string): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      // Browser environment
      try {
        localStorage.removeItem(key)
      } catch (error) {
        // Fallback to memory if localStorage fails
        this.memoryCache.delete(key)
      }
    } else {
      // Node.js environment
      this.memoryCache.delete(key)
    }
  }
}

const storage = new CrossPlatformStorage()

async function cache<T>(key: string, getter: () => Promise<T>, options: { ttl: number }): Promise<T> {
  const now = Date.now()
  const cachedItem = storage.get(key) as CacheItem<T> | null

  // Check if cache is valid
  if (cachedItem && now - cachedItem.timestamp < cachedItem.ttl) {
    return cachedItem.value
  }

  // Cache is expired or doesn't exist, get fresh data
  try {
    const value = await getter()
    const cacheItem: CacheItem<T> = {
      value,
      timestamp: now,
      ttl: options.ttl,
    }
    storage.set(key, cacheItem)
    return value
  } catch (error) {
    // If getter fails and we have expired cache, return expired cache
    if (cachedItem) {
      return cachedItem.value
    }
    throw error
  }
}

/**
 * 按顺序测试 API 的可用性，只要有一个 API 域名可用，就终止测试并切换所有流量到该域名。
 * 在测试过程中，会根据服务器返回添加新的 API 域名，并缓存到本地
 */
export async function testApiOrigins() {
  // 按顺序测试 API 的可用性
  const result = await cache(
    'api_origins',
    async () => {
      let i = 0
      let pool = POOL
      while (i < pool.length) {
        try {
          const origin: string = pool[i]
          const controller = new AbortController()
          setTimeout(() => controller.abort(), 2000) // 2秒超时
          const res = await ofetch<{ data: { api_origins: string[] } }>(`${origin}/api/api_origins`, {
            signal: controller.signal,
            retry: 1,
          })
          // 如果服务器返回了新的 API 域名，则更新缓存
          if (res.data.api_origins.length > 0) {
            pool = uniq([...pool, ...res.data.api_origins])
          }
          // 如果当前 API 可用，则切换所有流量到该域名
          API_ORIGIN = origin
          pool = uniq([origin, ...pool]) // 将当前 API 域名添加到列表顶部
          POOL = pool
          return pool
        } catch (e) {
          i++
        }
      }
      return POOL
    },
    { ttl: 1000 * 60 * 60 } // 1小时缓存
  )

  return result
}
