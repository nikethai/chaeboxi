import type { ProviderInfo } from '@shared/types'

export type SelectedModel = {
  provider: string
  modelId: string
}

export function getModelDisplayName(providers: ProviderInfo[], model?: SelectedModel): string {
  if (!model?.modelId) {
    return ''
  }

  const provider = providers.find((item) => item.id === model.provider)
  const models = [...(provider?.models || []), ...(provider?.defaultSettings?.models || [])]
  const normalizeModelId = (modelId: string) =>
    modelId
      .trim()
      .replace(/^google\//i, '')
      .replace(/^models\//i, '')
      .replace(/^antigravity-/i, '')
      .replace(/^gemini-3(?:\.\d+)?-flash$/i, 'gemini-3-flash')
      .replace(/^gemini-3(?:\.\d+)?-pro-(low|high)$/i, 'gemini-3-pro-$1')

  const exactModels = models.filter((item) => item.modelId === model.modelId)
  const exactModel = exactModels.find((item) => Boolean(item.nickname)) || exactModels[0]
  if (exactModel) {
    return exactModel.nickname || model.modelId
  }

  const normalizedTarget = normalizeModelId(model.modelId)
  const aliasModels = models.filter((item) => normalizeModelId(item.modelId) === normalizedTarget)
  const aliasModel = aliasModels.find((item) => Boolean(item.nickname)) || aliasModels[0]

  return aliasModel?.nickname || model.modelId
}
