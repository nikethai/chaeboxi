import type { ProviderModelInfo } from '../types'

export type ImageModelCapability = 'image_generation' | 'image_edit'

const IMAGE_CAPABILITIES: ImageModelCapability[] = ['image_generation', 'image_edit']

/**
 * Infer image generation/edit capabilities from model id patterns.
 * Used when ProviderModelInfo.capabilities lacks explicit image flags.
 */
export function inferImageCapabilities(modelId: string): ImageModelCapability[] {
  const id = (modelId || '').toLowerCase()
  if (!id) return []

  if (id.includes('gpt-image') || id.includes('dall-e') || id.includes('dalle')) {
    return [...IMAGE_CAPABILITIES]
  }
  if ((id.includes('gemini') || id.includes('imagen')) && id.includes('image')) {
    return [...IMAGE_CAPABILITIES]
  }
  if (id.includes('flash-image') || id.includes('pro-image')) {
    return [...IMAGE_CAPABILITIES]
  }
  if (id.includes('imagine-image') || id.includes('grok-imagine') || id.includes('grok-2-image')) {
    return [...IMAGE_CAPABILITIES]
  }
  if (id.includes('comfyui')) {
    return [...IMAGE_CAPABILITIES]
  }
  if (id.includes('flux') && !id.includes('chat')) {
    return [...IMAGE_CAPABILITIES]
  }
  if (id.includes('aurora') && id.includes('image')) {
    return [...IMAGE_CAPABILITIES]
  }
  return []
}

export function hasImageCapability(
  model: Pick<ProviderModelInfo, 'modelId' | 'capabilities'> | undefined,
  capability: ImageModelCapability
): boolean {
  if (!model) return false
  if (model.capabilities?.includes(capability)) return true
  return inferImageCapabilities(model.modelId).includes(capability)
}

export function isImageGenerationModel(
  model: Pick<ProviderModelInfo, 'modelId' | 'capabilities'> | undefined
): boolean {
  return hasImageCapability(model, 'image_generation')
}

export function isImageEditModel(model: Pick<ProviderModelInfo, 'modelId' | 'capabilities'> | undefined): boolean {
  return hasImageCapability(model, 'image_edit')
}

/**
 * Ensure known image models expose image_generation / image_edit capabilities.
 * Preserves existing capabilities and nicknames.
 */
export function withInferredImageCapabilities(model: ProviderModelInfo): ProviderModelInfo {
  const inferred = inferImageCapabilities(model.modelId)
  if (inferred.length === 0) return model

  const existing = new Set(model.capabilities || [])
  let changed = false
  for (const cap of inferred) {
    if (!existing.has(cap)) {
      existing.add(cap)
      changed = true
    }
  }
  if (!changed) return model
  return {
    ...model,
    capabilities: Array.from(existing) as NonNullable<ProviderModelInfo['capabilities']>,
  }
}

export function withInferredImageCapabilitiesList(models: ProviderModelInfo[]): ProviderModelInfo[] {
  return models.map(withInferredImageCapabilities)
}
