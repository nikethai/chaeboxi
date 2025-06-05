import { ModelProvider, ProviderSettings, SessionType } from 'src/shared/types'
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

  protected async listProviderModels(settings: ProviderSettings) {
    const ollama = new Ollama({
      ollamaHost: settings.apiHost!,
      model: {
        modelId: '',
        capabilities: [],
      },
      temperature: 0,
    })
    return ollama.listModels()
  }
}
