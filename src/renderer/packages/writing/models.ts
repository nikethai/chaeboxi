import { ModelProviderEnum, type ProviderInfo } from '@shared/types'
import type { WritingModel } from '@shared/types/writing'
import { isNonChatComposerModel } from '@/utils/modelDisplayName'

/** Remote agents and search-only backends cannot honor a text-only writing policy. */
export function supportsWritingProvider(provider: string): boolean {
  return ![
    ModelProviderEnum.OpenClaw,
    ModelProviderEnum.ComfyUI,
    ModelProviderEnum.ChatboxAI,
    ModelProviderEnum.Perplexity,
  ].includes(provider as ModelProviderEnum)
}

export function getWritingModelOptions(providers: ProviderInfo[]) {
  return providers
    .filter((provider) => supportsWritingProvider(provider.id))
    .map((provider) => ({
      group: provider.name,
      items: (provider.models || provider.defaultSettings?.models || [])
        .filter((model) => (!model.type || model.type === 'chat') && !isNonChatComposerModel(model))
        .map((model) => ({
          value: JSON.stringify({ provider: provider.id, modelId: model.modelId } satisfies WritingModel),
          label: model.nickname || model.modelId,
        })),
    }))
    .filter((group) => group.items.length > 0)
}
