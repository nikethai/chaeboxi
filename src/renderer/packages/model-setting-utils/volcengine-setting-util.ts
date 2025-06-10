import { ModelProvider, ProviderSettings, SessionType } from 'src/shared/types'
import VolcEngine from '../models/volcengine'
import BaseConfig from './base-config'
import { ModelSettingUtil } from './interface'

export default class VolcEngineSettingUtil extends BaseConfig implements ModelSettingUtil {
  public provider: ModelProvider = ModelProvider.VolcEngine
  async getCurrentModelDisplayName(
    model: string,
    sessionType: SessionType,
    providerSettings?: ProviderSettings
  ): Promise<string> {
    return `VolcEngine API (${providerSettings?.models?.find((m) => m.modelId === model)?.nickname || model})`
  }

  protected async listProviderModels(settings: ProviderSettings) {
    return []
  }
}
