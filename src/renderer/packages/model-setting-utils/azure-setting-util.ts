import { ModelProvider, ProviderSettings, SessionType } from 'src/shared/types'
import { ModelSettingUtil } from './interface'
import AzureOpenAI from '../models/azure'
import BaseConfig from './base-config'

export default class AzureSettingUtil extends BaseConfig implements ModelSettingUtil {
  public provider: ModelProvider = ModelProvider.Azure
  async getCurrentModelDisplayName(
    model: string,
    sessionType: SessionType,
    providerSettings?: ProviderSettings
  ): Promise<string> {
    if (sessionType === 'picture') {
      return `Azure OpenAI API (${model})`
    } else {
      return `Azure OpenAI API (${providerSettings?.models?.find((m) => m.modelId === model)?.nickname || model})`
    }
  }

  public getLocalOptionGroups() {
    // FIXME:
    return []
  }

  protected async listProviderModels() {
    return []
  }

  public isCurrentModelSupportImageInput(model: string) {
    return AzureOpenAI.helpers.isModelSupportVision(model)
  }

  public isCurrentModelSupportToolUse(model: string) {
    return AzureOpenAI.helpers.isModelSupportToolUse(model)
  }
}
