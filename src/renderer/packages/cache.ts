import localforage from 'localforage'

export const store = localforage.createInstance({ name: 'chatboxcache' })

export interface CacheItem<T> {
  value: T
  expireAt: number
}

// Memory cache to store ongoing promises and prevent duplicate calls
const pendingPromises = new Map<string, Promise<unknown>>()

export async function cache<T>(
  key: string,
  getter: () => Promise<T>,
  options: {
    ttl: number // 缓存过期时间，单位为毫秒
    refreshFallbackToCache?: boolean // 如果刷新时获取新值失败，是否从缓存中继续使用过期的旧值
  }
): Promise<T> {
  const cachedStr = await store.getItem<string | null>(key)
  let cache: CacheItem<T> | null = null

  if (cachedStr) {
    try {
      cache = JSON.parse(cachedStr)
    } catch (e) {
      console.error(`Error parsing cache for key ${key}:`, e)
    }
  }

  if (cache && cache.expireAt > Date.now()) {
    return cache.value
  }

  // Check if there's already a pending promise for this key
  const existingPromise = pendingPromises.get(key) as Promise<T> | undefined
  if (existingPromise) {
    return existingPromise
  }

  // Create new promise and store it to prevent duplicate calls
  const promise = (async () => {
    try {
      const newValue = await getter()
      cache = {
        value: newValue,
        expireAt: Date.now() + options.ttl,
      }
      await store.setItem(key, JSON.stringify(cache))
      return newValue
    } catch (e) {
      if (options.refreshFallbackToCache && cache) {
        return cache.value
      }
      throw e
    } finally {
      // Remove the promise from pending map when done
      pendingPromises.delete(key)
    }
  })()

  pendingPromises.set(key, promise)
  return promise
}
