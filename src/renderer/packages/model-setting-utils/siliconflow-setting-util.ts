import { ModelProvider, ProviderSettings, SessionType } from 'src/shared/types'
import { ModelSettingUtil } from './interface'
import BaseConfig from './base-config'
import SiliconFlow, { siliconFlowModels } from '../models/siliconflow'

export default class SiliconFlowSettingUtil extends BaseConfig implements ModelSettingUtil {
  public provider: ModelProvider = ModelProvider.SiliconFlow
  async getCurrentModelDisplayName(
    model: string,
    sessionType: SessionType,
    providerSettings?: ProviderSettings
  ): Promise<string> {
    return `SiliconFlow API (${providerSettings?.models?.find((m) => m.modelId === model)?.nickname || model})`
  }

  public getLocalOptionGroups() {
    return [
      {
        options: siliconFlowModels.map((value) => {
          return {
            label: value,
            value: value,
          }
        }),
      },
    ]
  }

  protected async listProviderModels(settings: ProviderSettings) {
    const siliconFlow = new SiliconFlow({
      siliconCloudKey: settings.apiKey!,
      siliconCloudModel: '',
    })
    return siliconFlow.listModels()
  }

  isCurrentModelSupportImageInput(model: string): boolean {
    return SiliconFlow.helpers.isModelSupportVision(model)
  }

  isCurrentModelSupportToolUse(model: string): boolean {
    return SiliconFlow.helpers.isModelSupportToolUse(model)
  }
}
