import { ModelOptionGroup, ModelProvider, ProviderSettings, SessionType } from 'src/shared/types'

export interface ModelSettingUtil {
  provider: ModelProvider
  // 用在消息下面展示的模型名称
  getCurrentModelDisplayName(
    model: string,
    sessionType: SessionType,
    providerSettings?: ProviderSettings
  ): Promise<string>
  // 获取该provider在代码里写死的模型组
  getLocalOptionGroups(): ModelOptionGroup[]
  // 获取该provider远程的模型组
  getMergeOptionGroups(providerSettings: ProviderSettings): Promise<ModelOptionGroup[]>
  // 判断模型对feature的支持
  isCurrentModelSupportImageInput(model: string): boolean
  isCurrentModelSupportToolUse(model: string): boolean
}
