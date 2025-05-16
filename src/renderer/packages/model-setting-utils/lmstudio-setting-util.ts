import { ModelProvider, ProviderSettings, Session, SessionType, Settings } from 'src/shared/types'
import { ModelSettingUtil } from './interface'
import BaseConfig from './base-config'
import LMStudio from '../models/lmstudio'

export default class LMStudioSettingUtil extends BaseConfig implements ModelSettingUtil {
  public provider: ModelProvider = ModelProvider.LMStudio
  async getCurrentModelDisplayName(
    model: string,
    sessionType: SessionType,
    providerSettings?: ProviderSettings
  ): Promise<string> {
    return `LM Studio (${providerSettings?.models?.find((m) => m.modelId === model)?.nickname || model})`
  }

  public getLocalOptionGroups() {
    return []
  }

  protected async listProviderModels(settings: ProviderSettings) {
    const lmStudio = new LMStudio({
      lmStudioHost: settings.apiHost!,
      lmStudioModel: '',
    })
    return lmStudio.listModels()
  }

  isCurrentModelSupportImageInput(model: string): boolean {
    return LMStudio.helpers.isModelSupportVision(model)
  }

  isCurrentModelSupportToolUse(model: string): boolean {
    return LMStudio.helpers.isModelSupportToolUse(model)
  }
}
