import { ModelProvider, ProviderSettings, Session, SessionType, Settings } from 'src/shared/types'
import { ModelSettingUtil } from './interface'
import Ollama from '../models/ollama'
import BaseConfig from './base-config'

export default class OllamaSettingUtil extends BaseConfig implements ModelSettingUtil {
  public provider: ModelProvider = ModelProvider.Ollama
  async getCurrentModelDisplayName(
    model: string,
    sessionType: SessionType,
    providerSettings?: ProviderSettings
  ): Promise<string> {
    return `Ollama (${providerSettings?.models?.find((m) => m.modelId === model)?.nickname || model})`
  }

  public getLocalOptionGroups() {
    return []
  }

  protected async listProviderModels(settings: ProviderSettings) {
    const ollama = new Ollama({ ollamaHost: settings.apiHost!, ollamaModel: '', temperature: 0 })
    return ollama.listModels()
  }

  isCurrentModelSupportImageInput(model: string): boolean {
    return Ollama.helpers.isModelSupportVision(model)
  }

  isCurrentModelSupportToolUse(model: string): boolean {
    return Ollama.helpers.isModelSupportToolUse(model)
  }
}
