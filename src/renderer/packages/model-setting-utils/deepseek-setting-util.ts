import { ModelProvider, ProviderSettings, Session, SessionType, Settings } from 'src/shared/types'
import { ModelSettingUtil } from './interface'
import BaseConfig from './base-config'
import DeepSeek, { deepSeekModels } from '../models/deepseek'

export default class DeepSeekSettingUtil extends BaseConfig implements ModelSettingUtil {
  public provider: ModelProvider = ModelProvider.DeepSeek
  async getCurrentModelDisplayName(
    model: string,
    sessionType: SessionType,
    providerSettings?: ProviderSettings
  ): Promise<string> {
    return `DeepSeek API (${providerSettings?.models?.find((m) => m.modelId === model)?.nickname || model})`
  }

  public getLocalOptionGroups() {
    return [
      {
        options: deepSeekModels.map((value) => {
          return {
            label: value,
            value: value,
          }
        }),
      },
    ]
  }

  protected async listProviderModels(settings: ProviderSettings) {
    const deepSeek = new DeepSeek({
      deepseekAPIKey: settings.apiKey!,
      deepseekModel: '',
    })
    return deepSeek.listModels()
  }

  public isCurrentModelSupportImageInput(model: string) {
    return DeepSeek.helpers.isModelSupportVision(model)
  }

  public isCurrentModelSupportToolUse(model: string) {
    return DeepSeek.helpers.isModelSupportToolUse(model)
  }
}
