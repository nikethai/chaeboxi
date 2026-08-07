/**
 * Discover image-generation models from configured providers.
 * Aligns with Imagine studio / ImageModelSelect lists + xAI Grok Imagine.
 */

import { ModelProviderEnum, ModelProviderType, type ProviderInfo } from '@shared/types'
import {
  COMFYUI_IMAGE_MODEL_IDS,
  GEMINI_IMAGE_MODEL_IDS,
  IMAGE_MODEL_FALLBACK_NAMES,
  OPENAI_IMAGE_MODEL_IDS,
} from '@/routes/image-creator/-components/constants'

export type AvailableImageModel = {
  providerId: string
  providerName: string
  modelId: string
  displayName: string
  /** Combobox value: providerId:modelId */
  value: string
}

const XAI_IMAGE_MODEL_IDS = ['grok-imagine-image', 'grok-imagine-image-quality', 'grok-imagine-image-pro']

function modelsForProvider(
  provider: ProviderInfo,
  imageModelIds: string[]
): { modelId: string; displayName: string }[] {
  const providerModels = provider.models || provider.defaultSettings?.models || []
  const defaultModels = provider.defaultSettings?.models || []
  return imageModelIds
    .map((modelId) => {
      const model =
        providerModels.find((m) => m.modelId === modelId) || defaultModels.find((m) => m.modelId === modelId)
      if (!model) return null
      return {
        modelId,
        displayName: model.nickname || IMAGE_MODEL_FALLBACK_NAMES[modelId] || modelId,
      }
    })
    .filter((m): m is { modelId: string; displayName: string } => m !== null)
}

/** Any listed model whose id looks like an image generator. */
function heuristicImageModels(provider: ProviderInfo): { modelId: string; displayName: string }[] {
  const providerModels = provider.models || provider.defaultSettings?.models || []
  const known = new Set([
    ...OPENAI_IMAGE_MODEL_IDS,
    ...GEMINI_IMAGE_MODEL_IDS,
    ...COMFYUI_IMAGE_MODEL_IDS,
    ...XAI_IMAGE_MODEL_IDS,
  ])
  return providerModels
    .filter((m) => {
      if (known.has(m.modelId)) return false
      const id = m.modelId.toLowerCase()
      if (id.includes('gpt-image') || id.includes('dall-e') || id.includes('dalle')) return true
      if ((id.includes('gemini') || id.includes('imagen')) && id.includes('image')) return true
      if (id.includes('flash-image') || id.includes('pro-image')) return true
      // xAI Grok Imagine family (and similar)
      if (id.includes('imagine-image') || id.includes('grok-imagine') || id.includes('aurora')) return true
      if (id.includes('flux') && !id.includes('chat')) return true
      return false
    })
    .map((m) => ({
      modelId: m.modelId,
      displayName: m.nickname || IMAGE_MODEL_FALLBACK_NAMES[m.modelId] || m.modelId,
    }))
}

/**
 * Flattened list of image models available from currently credentialed providers.
 */
export function listAvailableImageModels(providers: ProviderInfo[]): AvailableImageModel[] {
  const out: AvailableImageModel[] = []
  const seen = new Set<string>()

  const push = (provider: ProviderInfo, models: { modelId: string; displayName: string }[]) => {
    for (const m of models) {
      const value = `${provider.id}:${m.modelId}`
      if (seen.has(value)) continue
      seen.add(value)
      out.push({
        providerId: provider.id,
        providerName: provider.name,
        modelId: m.modelId,
        displayName: m.displayName,
        value,
      })
    }
  }

  for (const provider of providers) {
    if (provider.id === ModelProviderEnum.Gemini || (provider.isCustom && provider.type === ModelProviderType.Gemini)) {
      push(provider, [...modelsForProvider(provider, GEMINI_IMAGE_MODEL_IDS), ...heuristicImageModels(provider)])
      continue
    }
    if (
      provider.id === ModelProviderEnum.OpenAI ||
      provider.id === ModelProviderEnum.Azure ||
      provider.id === ModelProviderEnum.OpenAIResponses
    ) {
      push(provider, [...modelsForProvider(provider, OPENAI_IMAGE_MODEL_IDS), ...heuristicImageModels(provider)])
      continue
    }
    if (provider.id === ModelProviderEnum.XAI) {
      push(provider, [...modelsForProvider(provider, XAI_IMAGE_MODEL_IDS), ...heuristicImageModels(provider)])
      continue
    }
    if (provider.id === ModelProviderEnum.ComfyUI) {
      push(provider, modelsForProvider(provider, COMFYUI_IMAGE_MODEL_IDS))
      continue
    }
    // OpenRouter / other customs that list image model ids
    const heuristic = heuristicImageModels(provider)
    if (heuristic.length > 0) {
      push(provider, heuristic)
    }
  }

  return out
}

export function parseImageModelValue(value: string): { providerId: string; modelId: string } | null {
  const idx = value.indexOf(':')
  if (idx <= 0) return null
  return {
    providerId: value.slice(0, idx),
    modelId: value.slice(idx + 1),
  }
}
