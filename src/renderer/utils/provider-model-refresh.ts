/**
 * Shared provider catalog refresh used by OAuth login completion and the
 * Settings → Models "Fetch" button.
 */

import type { ModelProvider, ProviderModelInfo, ProviderSettings } from '@shared/types'
import { withInferredImageCapabilitiesList } from '@shared/utils/image-model-capabilities'
import { getModelSettingUtil } from '@/packages/model-setting-utils'

export type ProviderModelRefreshResult =
  | {
      ok: true
      models: ProviderModelInfo[]
      source: 'provider'
    }
  | {
      ok: false
      models: ProviderModelInfo[]
      error: string
      source: 'fallback' | 'empty'
    }

/**
 * Fetch remote provider models and merge with local settings.
 * Always infers image_generation / image_edit capabilities for known image models.
 */
export async function refreshProviderModels(params: {
  providerId: ModelProvider | string
  providerSettings: ProviderSettings
  isCustom?: boolean
  customProviderType?: ProviderSettings extends never ? never : import('@shared/types').ModelProviderType
}): Promise<ProviderModelRefreshResult> {
  try {
    const util = getModelSettingUtil(params.providerId as ModelProvider, params.customProviderType)
    const models = await util.getMergeOptionGroups(params.providerSettings)
    const enriched = withInferredImageCapabilitiesList(models || [])
    if (!enriched.length) {
      return {
        ok: false,
        models: withInferredImageCapabilitiesList(params.providerSettings.models || []),
        error: 'Provider returned an empty model list',
        source: 'empty',
      }
    }
    return {
      ok: true,
      models: enriched,
      source: 'provider',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      models: withInferredImageCapabilitiesList(params.providerSettings.models || []),
      error: message,
      source: 'fallback',
    }
  }
}

/**
 * Convenience: refresh using OAuth bearer already stored in provider settings.
 * Returns models suitable for setProviderSettings({ models }).
 */
export async function refreshProviderModelsAfterLogin(params: {
  providerId: ModelProvider | string
  providerSettings: ProviderSettings
  replaceAll?: boolean
  remoteModels?: ProviderModelInfo[]
}): Promise<ProviderModelInfo[]> {
  if (params.remoteModels?.length) {
    const remote = withInferredImageCapabilitiesList(params.remoteModels)
    if (params.replaceAll || !params.providerSettings.models?.length) {
      return remote
    }
    // Keep local nicknames when ids overlap
    const localMap = new Map((params.providerSettings.models || []).map((m) => [m.modelId, m]))
    return remote.map((r) => {
      const prev = localMap.get(r.modelId)
      if (!prev) return r
      return {
        ...r,
        nickname: prev.nickname || r.nickname,
        capabilities: prev.capabilities?.length ? prev.capabilities : r.capabilities,
      }
    })
  }

  const result = await refreshProviderModels({
    providerId: params.providerId,
    providerSettings: params.providerSettings,
  })
  return result.models
}
