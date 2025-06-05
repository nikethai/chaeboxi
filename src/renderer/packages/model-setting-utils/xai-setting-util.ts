import { ModelProvider, ProviderSettings, SessionType } from 'src/shared/types'
import { ModelSettingUtil } from './interface'
import BaseConfig from './base-config'
import XAI from '../models/xai'

export default class XAISettingUtil extends BaseConfig implements ModelSettingUtil {
  public provider: ModelProvider = ModelProvider.XAI
  async getCurrentModelDisplayName(
    model: string,
    sessionType: SessionType,
    providerSettings?: ProviderSettings
  ): Promise<string> {
    return `xAI API (${providerSettings?.models?.find((m) => m.modelId === model)?.nickname || model})`
  }

  protected async listProviderModels(settings: ProviderSettings) {
    const xai = new XAI({ xAIKey: settings.apiKey!, model: { modelId: '', capabilities: [] } })
    return xai.listModels()
  }
}
