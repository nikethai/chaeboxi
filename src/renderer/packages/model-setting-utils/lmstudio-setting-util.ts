import { createModelDependencies } from '@/adapters'
import LMStudio from 'src/shared/models/lmstudio'
import { ModelProvider, ModelProviderEnum, ProviderSettings, SessionType } from 'src/shared/types'
import BaseConfig from './base-config'
import { ModelSettingUtil } from './interface'

export default class LMStudioSettingUtil extends BaseConfig implements ModelSettingUtil {
  public provider: ModelProvider = ModelProviderEnum.LMStudio
  async getCurrentModelDisplayName(
    model: string,
    sessionType: SessionType,
    providerSettings?: ProviderSettings
  ): Promise<string> {
    return `LM Studio (${providerSettings?.models?.find((m) => m.modelId === model)?.nickname || model})`
  }

  protected async listProviderModels(settings: ProviderSettings) {
    const dependencies = await createModelDependencies()
    const lmStudio = new LMStudio(
      {
        lmStudioHost: settings.apiHost!,
        model: {
          modelId: '',
          capabilities: [],
        },
      },
      dependencies
    )
    return lmStudio.listModels()
  }
}
