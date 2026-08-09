import type { ProviderInfo } from '@shared/types'

export type SelectedModel = { provider: string; modelId: string }

export type ModelReadiness =
  | { status: 'setup-required' }
  | { status: 'provider-unavailable'; providerId: string }
  | { status: 'model-unavailable'; providerId: string; modelId: string }
  | { status: 'capability-required'; providerId: string; modelId: string; capability: 'vision' }
  | { status: 'ready'; providerId: string; modelId: string }

export function getModelReadiness(
  selectedModel: SelectedModel | undefined,
  providers: ProviderInfo[],
  options: { requiresVision?: boolean } = {}
): ModelReadiness {
  if (!selectedModel) return { status: 'setup-required' }

  const provider = providers.find((candidate) => candidate.id === selectedModel.provider)
  if (!provider) return { status: 'provider-unavailable', providerId: selectedModel.provider }

  const model = (provider.models || provider.defaultSettings?.models)?.find(
    (candidate) => candidate.modelId === selectedModel.modelId
  )
  if (!model) {
    return {
      status: 'model-unavailable',
      providerId: selectedModel.provider,
      modelId: selectedModel.modelId,
    }
  }

  if (options.requiresVision && model.capabilities && !model.capabilities.includes('vision')) {
    return {
      status: 'capability-required',
      providerId: selectedModel.provider,
      modelId: selectedModel.modelId,
      capability: 'vision',
    }
  }

  return { status: 'ready', providerId: selectedModel.provider, modelId: selectedModel.modelId }
}
