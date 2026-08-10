import type { ModelProvider, ProviderBaseInfo, ProviderModelInfo, ProviderSettings, SessionType } from '@shared/types'

export interface ModelSettingUtil {
  provider: ModelProvider
  // (legacy comment removed)
  getCurrentModelDisplayName(
    model: string,
    sessionType: SessionType,
    providerSettings?: ProviderSettings,
    providerBaseInfo?: ProviderBaseInfo
  ): Promise<string>
  // (legacy comment)
  getMergeOptionGroups(providerSettings: ProviderSettings): Promise<ProviderModelInfo[]>
}
