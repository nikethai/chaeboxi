import { ModelProvider, ProviderSettings, Session, SessionType, Settings } from 'src/shared/types'
import { ModelSettingUtil } from './interface'
import Gemini, { GeminiModel, geminiModels } from '../models/gemini'
import BaseConfig from './base-config'

export default class GeminiSettingUtil extends BaseConfig implements ModelSettingUtil {
  public provider: ModelProvider = ModelProvider.Gemini
  async getCurrentModelDisplayName(
    model: string,
    sessionType: SessionType,
    providerSettings?: ProviderSettings
  ): Promise<string> {
    return `Gemini API (${providerSettings?.models?.find((m) => m.modelId === model)?.nickname || model})`
  }

  public getLocalOptionGroups() {
    return [
      {
        options: geminiModels.map((value) => {
          return {
            label: value,
            value: value,
          }
        }),
      },
    ]
  }

  protected async listProviderModels(settings: ProviderSettings) {
    const gemini = new Gemini({
      geminiAPIHost: settings.apiHost!,
      geminiAPIKey: settings.apiKey!,
      geminiModel: 'gemini-pro',
      temperature: 0,
    })
    return gemini.listModels()
  }

  public isCurrentModelSupportImageInput(model: string) {
    return Gemini.helpers.isModelSupportVision(model)
  }

  public isCurrentModelSupportToolUse(model: string) {
    return Gemini.helpers.isModelSupportToolUse(model)
  }
}
