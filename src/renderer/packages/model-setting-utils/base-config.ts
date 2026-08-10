import * as Sentry from '@sentry/react'
import type {
  ModelProvider,
  ProviderBaseInfo,
  ProviderModelInfo,
  ProviderSettings,
  SessionType,
} from '../../../shared/types'
import * as remote from '../../packages/remote'
import type { ModelSettingUtil } from './interface'

export default abstract class BaseConfig implements ModelSettingUtil {
  public abstract provider: ModelProvider
  public abstract getCurrentModelDisplayName(
    model: string,
    sessionType: SessionType,
    providerSettings?: ProviderSettings,
    providerBaseInfo?: ProviderBaseInfo
  ): Promise<string>

  protected abstract listProviderModels(settings: ProviderSettings): Promise<ProviderModelInfo[]>

  private async listRemoteProviderModels(): Promise<ProviderModelInfo[]> {
    return await remote
      .getModelManifest({
        aiProvider: this.provider,
      })
      .then((res) => {
        return Array.isArray(res.models) ? res.models : []
      })
      .catch(() => {
        return []
      })
  }

  // (legacy comment removed)
  public async getMergeOptionGroups(providerSettings: ProviderSettings): Promise<ProviderModelInfo[]> {
    const localOptionGroups = providerSettings.models || []
    const [remoteModels, models] = await Promise.all([
      this.listRemoteProviderModels().catch((e) => {
        Sentry.captureException(e)
        return []
      }),
      this.listProviderModels(providerSettings).catch((e) => {
        Sentry.captureException(e)
        return []
      }),
    ])
    // (legacy comment removed)
    const safeRemoteModels = Array.isArray(remoteModels) ? remoteModels : []
    const safeProviderModels = Array.isArray(models) ? models : []
    const remoteOptionGroups = [...safeRemoteModels, ...safeProviderModels]
    const mergedModels = this.mergeOptionGroups(localOptionGroups, remoteOptionGroups)

    // (legacy comment removed)
    const enrichedModels = await this.enrichModelsWithInfo(mergedModels)
    return enrichedModels
  }

  /**
   * (legacy comment removed)
   * (legacy comment removed)
   * @param localOptionGroups
   * @param remoteOptionGroups
   * @returns
   */
  protected mergeOptionGroups(localOptionGroups: ProviderModelInfo[], remoteOptionGroups: ProviderModelInfo[]) {
    // (legacy comment removed)
    const localModelMap = new Map<string, ProviderModelInfo>()
    for (const model of localOptionGroups) {
      localModelMap.set(model.modelId, model)
    }

    const mergedModels: ProviderModelInfo[] = []
    const processedModelIds = new Set<string>()

    // (legacy comment removed)
    for (const model of localOptionGroups) {
      mergedModels.push(model)
      processedModelIds.add(model.modelId)
    }

    // (legacy comment removed)
    for (const remoteModel of remoteOptionGroups) {
      if (!processedModelIds.has(remoteModel.modelId)) {
        // (legacy comment removed)
        mergedModels.push(remoteModel)
        processedModelIds.add(remoteModel.modelId)
      }
    }

    return mergedModels
  }

  private async enrichModelsWithInfo(models: ProviderModelInfo[]): Promise<ProviderModelInfo[]> {
    if (models.length === 0) {
      return models
    }

    try {
      // (legacy comment removed)
      const incompleteModels = models.filter(
        (model) => !model.type || !model.capabilities || !model.contextWindow || !model.maxOutput
      )

      if (incompleteModels.length === 0) {
        // (legacy comment)
        return models
      }

      // (legacy comment removed)
      const modelIds = incompleteModels.map((model) => model.modelId).slice(0, 100)

      // (legacy comment)
      const modelsInfoData = await remote.getProviderModelsInfo({ modelIds })

      // (legacy comment removed)
      return models.map((model) => {
        const modelInfo = modelsInfoData[model.modelId]
        if (modelInfo) {
          return {
            ...model,
            type: model.type || modelInfo.type,
            capabilities: model.capabilities || modelInfo.capabilities,
            contextWindow: model.contextWindow || modelInfo.contextWindow,
            maxOutput: model.maxOutput || modelInfo.maxOutput,
            nickname: model.nickname || modelInfo.nickname,
            labels: model.labels || modelInfo.labels,
          }
        }
        return model
      })
    } catch (error) {
      // (legacy comment removed)
      Sentry.captureException(error)
      return models
    }
  }
}
