import { ModelProvider, ProviderSettings, Session, SessionType, Settings } from 'src/shared/types'
import { ModelSettingUtil } from './interface'
import BaseConfig from './base-config'
import DeepSeek from '../models/deepseek'

export default class DeepSeekSettingUtil extends BaseConfig implements ModelSettingUtil {
  public provider: ModelProvider = ModelProvider.DeepSeek
  async getCurrentModelDisplayName(
    model: string,
    sessionType: SessionType,
    providerSettings?: ProviderSettings
  ): Promise<string> {
    return `DeepSeek API (${providerSettings?.models?.find((m) => m.modelId === model)?.nickname || model})`
  }

  protected async listProviderModels(settings: ProviderSettings) {
    const deepSeek = new DeepSeek({
      deepseekAPIKey: settings.apiKey!,
      model: {
        modelId: '',
        capabilities: [],
      },
    })
    return deepSeek.listModels()
  }
}
