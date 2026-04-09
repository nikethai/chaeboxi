import { createAfetch } from '@shared/request/request'
import type { ApiRequestOptions, ModelDependencies } from '@shared/types/adapters'
import { getOS } from '@/packages/navigator'
import platform from '@/platform'
import storage from '@/storage'
import { StorageKeyGenerator } from '@/storage/StoreStorage'
import * as settingActions from '@/stores/settingActions'
import { apiRequest } from '@/utils/request'
import { RendererSentryAdapter } from './sentry'

// Singleton cache for ModelDependencies — platform info is static during a session,
// and the storage/request adapters are stateless, so we only need to create them once.
let _cachedDeps: ModelDependencies | null = null
let _cachedDepsPromise: Promise<ModelDependencies> | null = null

export async function createModelDependencies(): Promise<ModelDependencies> {
  if (_cachedDeps) return _cachedDeps
  // Deduplicate concurrent first calls
  if (_cachedDepsPromise) return _cachedDepsPromise

  _cachedDepsPromise = (async () => {
    const platformInfo = {
      type: platform.type,
      platform: await platform.getPlatform(),
      os: getOS(),
      version: (await platform.getVersion()) || 'unknown',
    }

    const afetch = createAfetch(platformInfo)

    const deps: ModelDependencies = {
      storage: {
        async saveImage(folder: string, dataUrl: string): Promise<string> {
          const storageKey = StorageKeyGenerator.picture(folder)
          await storage.setBlob(storageKey, dataUrl)
          return storageKey
        },
        async getImage(storageKey: string): Promise<string> {
          const blob = await storage.getBlob(storageKey)
          if (!blob) return ''
          return blob.startsWith('data:') ? blob : `data:image/png;base64,${blob}`
        },
      },
      request: {
        fetchWithOptions: async (
          url: string,
          init?: RequestInit,
          options?: { retry?: number; parseChatboxRemoteError?: boolean }
        ): Promise<Response> => {
          return afetch(url, init, options || {})
        },
        async apiRequest(options: ApiRequestOptions): Promise<Response> {
          if (options.method === 'POST') {
            return apiRequest.post(options.url, options.headers || {}, options.body, {
              signal: options.signal,
              retry: options.retry,
              useProxy: options.useProxy,
            })
          } else {
            return apiRequest.get(options.url, options.headers || {}, {
              signal: options.signal,
              retry: options.retry,
              useProxy: options.useProxy,
            })
          }
        },
      },
      sentry: new RendererSentryAdapter(),
      getRemoteConfig: settingActions.getRemoteConfig,
    }

    _cachedDeps = deps
    _cachedDepsPromise = null
    return deps
  })()

  return _cachedDepsPromise
}

/**
 * Invalidate the cached ModelDependencies singleton.
 * Call this if platform info changes (unlikely during a session).
 */
export function invalidateModelDependencies() {
  _cachedDeps = null
  _cachedDepsPromise = null
}
