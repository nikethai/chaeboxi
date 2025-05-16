import { ModelProvider, ProviderSettings, Session, SessionType, Settings } from 'src/shared/types'
import ChatGLM, { chatglmModels } from '../models/chatglm'
import BaseConfig from './base-config'
import { ModelSettingUtil } from './interface'

export default class ChatGLMSettingUtil extends BaseConfig implements ModelSettingUtil {
  public provider: ModelProvider = ModelProvider.ChatGLM6B
  async getCurrentModelDisplayName(model: string): Promise<string> {
    return model
  }

  public getLocalOptionGroups() {
    return [{ options: chatglmModels.map((model) => ({ label: model, value: model })) }]
  }

  protected async listProviderModels(settings: ProviderSettings) {
    return []
  }

  public isCurrentModelSupportImageInput(model: string) {
    return ChatGLM.helpers.isModelSupportVision(model)
  }

  public isCurrentModelSupportToolUse(model: string) {
    return ChatGLM.helpers.isModelSupportToolUse(model)
  }
}
