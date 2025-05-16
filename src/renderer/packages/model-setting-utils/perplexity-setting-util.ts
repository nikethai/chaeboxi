import { ModelProvider, ProviderSettings, Session, SessionType, Settings } from 'src/shared/types'
import Perplexity, { perplexityModels } from '../models/perplexity'
import BaseConfig from './base-config'
import { ModelSettingUtil } from './interface'

export default class PerplexitySettingUtil extends BaseConfig implements ModelSettingUtil {
  public provider: ModelProvider = ModelProvider.Perplexity
  async getCurrentModelDisplayName(
    model: string,
    sessionType: SessionType,
    providerSettings?: ProviderSettings
  ): Promise<string> {
    return `Perplexity API (${providerSettings?.models?.find((m) => m.modelId === model)?.nickname || model})`
  }

  public getLocalOptionGroups() {
    return [{ options: perplexityModels.map((model) => ({ label: model, value: model })) }]
  }

  protected async listProviderModels(settings: ProviderSettings) {
    return []
  }

  isCurrentModelSupportImageInput(model: string): boolean {
    return Perplexity.helpers.isModelSupportVision(model)
  }

  isCurrentModelSupportToolUse(model: string): boolean {
    return Perplexity.helpers.isModelSupportToolUse(model)
  }
}
