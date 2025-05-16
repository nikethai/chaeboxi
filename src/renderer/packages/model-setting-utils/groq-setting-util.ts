import { ModelProvider, ProviderSettings, Session, SessionType, Settings } from 'src/shared/types'
import Groq from '../models/groq'
import BaseConfig from './base-config'
import { ModelSettingUtil } from './interface'

export default class GroqSettingUtil extends BaseConfig implements ModelSettingUtil {
  public provider: ModelProvider = ModelProvider.Groq
  async getCurrentModelDisplayName(
    model: string,
    sessionType: SessionType,
    providerSettings?: ProviderSettings
  ): Promise<string> {
    return `Groq API (${providerSettings?.models?.find((m) => m.modelId === model)?.nickname || model})`
  }

  public getLocalOptionGroups() {
    return []
  }

  protected async listProviderModels(settings: ProviderSettings) {
    const groq = new Groq({
      groqAPIKey: settings.apiKey!,
      groqModel: '',
      temperature: 0,
    })
    return groq.listModels()
  }

  public isCurrentModelSupportImageInput(model: string) {
    return Groq.helpers.isModelSupportVision(model)
  }

  public isCurrentModelSupportToolUse(model: string) {
    return Groq.helpers.isModelSupportToolUse(model)
  }
}
