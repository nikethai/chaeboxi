import { ModelProvider, ProviderSettings, SessionType } from 'src/shared/types'
import { ModelSettingUtil } from './interface'
import OpenAI, { openaiModelConfigs } from '../models/openai'
import { uniq } from 'lodash'
import BaseConfig from './base-config'

export default class OpenAISettingUtil extends BaseConfig implements ModelSettingUtil {
  public provider: ModelProvider = ModelProvider.OpenAI
  async getCurrentModelDisplayName(
    model: string,
    sessionType: SessionType,
    providerSettings?: ProviderSettings
  ): Promise<string> {
    if (sessionType === 'picture') {
      return `OpenAI API (DALL-E-3)`
    } else {
      return `OpenAI API (${providerSettings?.models?.find((m) => m.modelId === model)?.nickname || model})`
    }
  }

  public getLocalOptionGroups() {
    let models = Array.from(Object.keys(openaiModelConfigs)).sort()
    models = uniq(models)
    return [
      {
        options: models.map((value) => ({
          label: value,
          value: value,
        })),
      },
    ]
  }

  protected async listProviderModels() {
    return []
  }

  isCurrentModelSupportImageInput(model: string): boolean {
    return OpenAI.helpers.isModelSupportVision(model)
  }

  isCurrentModelSupportToolUse(model: string): boolean {
    return OpenAI.helpers.isModelSupportToolUse(model)
  }
}
