/**
 * Discover image-generation models from configured providers.
 * Prefers explicit image_generation / image_edit capabilities, with ID heuristics as fallback.
 */

import { ModelProviderEnum, ModelProviderType, type ProviderInfo, type ProviderModelInfo } from '@shared/types'
import {
  hasImageCapability,
  isImageEditModel,
  isImageGenerationModel,
} from '@shared/utils/image-model-capabilities'
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
  supportsEdit: boolean
}

const XAI_IMAGE_MODEL_IDS = ['grok-imagine-image', 'grok-imagine-image-quality', 'grok-imagine-image-pro']

function modelsForProvider(
  provider: ProviderInfo,
  imageModelIds: string[]
): { modelId: string; displayName: string; supportsEdit: boolean }[] {
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
        supportsEdit: isImageEditModel(model),
      }
    })
    .filter((m): m is { modelId: string; displayName: string; supportsEdit: boolean } => m !== null)
}

function capabilityImageModels(provider: ProviderInfo): { modelId: string; displayName: string; supportsEdit: boolean }[] {
  const providerModels = provider.models || provider.defaultSettings?.models || []
  return providerModels
    .filter((m) => isImageGenerationModel(m) || hasImageCapability(m, 'image_edit'))
    .map((m) => ({
      modelId: m.modelId,
      displayName: m.nickname || IMAGE_MODEL_FALLBACK_NAMES[m.modelId] || m.modelId,
      supportsEdit: isImageEditModel(m),
    }))
}

/** Any listed model whose id looks like an image generator. */
function heuristicImageModels(provider: ProviderInfo): { modelId: string; displayName: string; supportsEdit: boolean }[] {
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
      // Prefer explicit capabilities when present
      if (m.capabilities?.includes('image_generation') || m.capabilities?.includes('image_edit')) return true
      return isImageGenerationModel(m as ProviderModelInfo)
    })
    .map((m) => ({
      modelId: m.modelId,
      displayName: m.nickname || IMAGE_MODEL_FALLBACK_NAMES[m.modelId] || m.modelId,
      supportsEdit: isImageEditModel(m),
    }))
}

/**
 * Flattened list of image models available from currently credentialed providers.
 */
export function listAvailableImageModels(providers: ProviderInfo[]): AvailableImageModel[] {
  const out: AvailableImageModel[] = []
  const seen = new Set<string>()

  const push = (
    provider: ProviderInfo,
    models: { modelId: string; displayName: string; supportsEdit: boolean }[]
  ) => {
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
        supportsEdit: m.supportsEdit,
      })
    }
  }

  for (const provider of providers) {
    // Capability-first discovery for every provider
    const byCapability = capabilityImageModels(provider)

    if (provider.id === ModelProviderEnum.Gemini || (provider.isCustom && provider.type === ModelProviderType.Gemini)) {
      push(provider, [
        ...modelsForProvider(provider, GEMINI_IMAGE_MODEL_IDS),
        ...byCapability,
        ...heuristicImageModels(provider),
      ])
      continue
    }
    if (
      provider.id === ModelProviderEnum.OpenAI ||
      provider.id === ModelProviderEnum.Azure ||
      provider.id === ModelProviderEnum.OpenAIResponses
    ) {
      // OpenAIResponses has no paint adapter today — still list only capability-backed models for OpenAI/Azure.
      if (provider.id === ModelProviderEnum.OpenAIResponses) {
        push(provider, byCapability)
        continue
      }
      push(provider, [
        ...modelsForProvider(provider, OPENAI_IMAGE_MODEL_IDS),
        ...byCapability,
        ...heuristicImageModels(provider),
      ])
      continue
    }
    if (provider.id === ModelProviderEnum.XAI) {
      push(provider, [
        ...modelsForProvider(provider, XAI_IMAGE_MODEL_IDS),
        ...byCapability,
        ...heuristicImageModels(provider),
      ])
      continue
    }
    if (provider.id === ModelProviderEnum.ComfyUI) {
      push(provider, [...modelsForProvider(provider, COMFYUI_IMAGE_MODEL_IDS), ...byCapability])
      continue
    }
    // OpenRouter / other customs that list image model ids
    const rest = [...byCapability, ...heuristicImageModels(provider)]
    if (rest.length > 0) {
      push(provider, rest)
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
