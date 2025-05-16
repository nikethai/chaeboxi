import { ModelProvider, ProviderSettings, Session, SessionType, Settings } from 'src/shared/types'
import Claude, { claudeModels } from '../models/claude'
import BaseConfig from './base-config'
import { ModelSettingUtil } from './interface'

export default class ClaudeSettingUtil extends BaseConfig implements ModelSettingUtil {
  public provider: ModelProvider = ModelProvider.Claude
  async getCurrentModelDisplayName(
    model: string,
    sessionType: SessionType,
    providerSettings?: ProviderSettings
  ): Promise<string> {
    return `Claude API (${providerSettings?.models?.find((m) => m.modelId === model)?.nickname || model})`
  }

  public getLocalOptionGroups() {
    return [
      {
        options: claudeModels.map((value) => ({
          label: value,
          value: value,
        })),
      },
    ]
  }

  protected async listProviderModels(settings: ProviderSettings) {
    const claude = new Claude({
      claudeApiHost: settings.apiHost!,
      claudeApiKey: settings.apiKey!,
      claudeModel: '',
    })
    return claude.listModels()
  }

  public isCurrentModelSupportImageInput(model: string) {
    return Claude.helpers.isModelSupportVision(model)
  }

  public isCurrentModelSupportToolUse(model: string) {
    return Claude.helpers.isModelSupportToolUse(model)
  }
}
