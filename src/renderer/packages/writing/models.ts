import { ModelProviderEnum, ModelProviderType, type ProviderInfo } from '@shared/types'
import type { WritingModel } from '@shared/types/writing'
import { isNonChatComposerModel } from '@/utils/modelDisplayName'

/** One eligibility rule for the picker and runtime, including custom API formats. */
export function getWritingModels(provider: ProviderInfo) {
  if (
    provider.id === ModelProviderEnum.OpenClaw ||
    provider.id === ModelProviderEnum.ChatboxAI ||
    provider.id === ModelProviderEnum.ComfyUI ||
    provider.type === ModelProviderType.ChatboxAI ||
    provider.type === ModelProviderType.ComfyUI
  ) {
    // A gateway agent can retain context and execute tools even when the caller supplies none.
    return []
  }
  return (provider.models ?? provider.defaultSettings?.models ?? []).filter(
    (model) =>
      (!model.type || model.type === 'chat') &&
      !model.capabilities?.some((capability) => capability === 'image_generation' || capability === 'image_edit') &&
      !isNonChatComposerModel(model)
  )
}

export function isWritingModelAvailable(provider: ProviderInfo, model: WritingModel): boolean {
  return provider.id === model.provider && getWritingModels(provider).some((entry) => entry.modelId === model.modelId)
}

export function getWritingModelOptions(providers: ProviderInfo[]) {
  return providers
    .map((provider) => ({
      group: provider.name,
      items: getWritingModels(provider).map((model) => ({
        value: JSON.stringify({ provider: provider.id, modelId: model.modelId } satisfies WritingModel),
        label: model.nickname || model.modelId,
      })),
    }))
    .filter((group) => group.items.length > 0)
}
