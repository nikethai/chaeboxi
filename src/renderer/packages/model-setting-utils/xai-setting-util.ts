import { ModelProvider, ProviderSettings, SessionType } from 'src/shared/types'
import { ModelSettingUtil } from './interface'
import BaseConfig from './base-config'
import XAI, { xAIModels } from '../models/xai'

export default class XAISettingUtil extends BaseConfig implements ModelSettingUtil {
  public provider: ModelProvider = ModelProvider.XAI
  async getCurrentModelDisplayName(
    model: string,
    sessionType: SessionType,
    providerSettings?: ProviderSettings
  ): Promise<string> {
    return `xAI API (${providerSettings?.models?.find((m) => m.modelId === model)?.nickname || model})`
  }

  public getLocalOptionGroups() {
    return [
      {
        options: xAIModels.map((value) => {
          return {
            label: value,
            value: value,
          }
        }),
      },
    ]
  }

  protected async listProviderModels(settings: ProviderSettings) {
    const xai = new XAI({ xAIKey: settings.apiKey!, xAIModel: '' })
    return xai.listModels()
  }

  isCurrentModelSupportImageInput(model: string): boolean {
    return XAI.helpers.isModelSupportVision(model)
  }

  isCurrentModelSupportToolUse(model: string): boolean {
    return XAI.helpers.isModelSupportToolUse(model)
  }
}
