import { ChatboxAIModel, ModelProvider, ProviderSettings, Session, SessionType, Settings } from 'src/shared/types'
import { ModelSettingUtil } from './interface'
import { chatboxAIModels } from '../models/chatboxai'
import BaseConfig from './base-config'
import { ModelOptionGroup } from 'src/shared/types'
import ChatboxAI from '../models/chatboxai'

function formatModelLabel(value: string): string {
  if (value === 'deepseek-chat') {
    return 'DeepSeek V3'
  } else if (value === 'deepseek-reasoner') {
    return 'DeepSeek R1'
  }
  return value.replace('chatboxai-', 'Chatbox AI ')
}

export default class ChatboxAISettingUtil extends BaseConfig implements ModelSettingUtil {
  public provider: ModelProvider = ModelProvider.ChatboxAI

  // private async getCurrentModelOptionLabel(settings: Settings): Promise<string> {
  //   const currentValue = this.getCurrentModelOptionValue(settings)
  //   const optionGroups = await this.getMergeOptionGroups(settings)
  //   for (const optionGroup of optionGroups) {
  //     const option = optionGroup.options.find((option) => option.value === currentValue)
  //     if (option) {
  //       return option.label
  //     }
  //   }
  //   return currentValue
  // }

  async getCurrentModelDisplayName(
    model: string,
    sessionType: SessionType,
    providerSettings?: ProviderSettings
  ): Promise<string> {
    if (sessionType === 'picture') {
      return `Chatbox AI`
    } else {
      // let model = await this.getCurrentModelOptionLabel(settings)
      // if (!model.toLowerCase().includes('chatbox')) {
      //   model = `Chatbox AI (${model})`
      // }
      // model = model.replace('chatboxai-', 'Chatbox AI ')
      // return model
      return `Chatbox AI (${providerSettings?.models?.find((m) => m.modelId === model)?.nickname || model})`
    }
  }

  public getLocalOptionGroups() {
    return [
      {
        options: chatboxAIModels.map((value) => ({
          label: formatModelLabel(value),
          value: value,
        })),
      },
    ]
  }

  protected async listProviderModels() {
    return []
  }

  protected mergeOptionGroups(localOptionGroups: ModelOptionGroup[], remoteOptionGroups: ModelOptionGroup[]) {
    const ret = [...remoteOptionGroups, ...localOptionGroups]
    const existedOptionSet = new Set<string>()
    for (const group of ret) {
      group.options = group.options.filter((option) => {
        const existed = existedOptionSet.has(option.value)
        existedOptionSet.add(option.value)
        return !existed
      })
    }
    return ret.filter((group) => group.options.length > 0)
  }

  public isCurrentModelSupportImageInput(model: string) {
    return ChatboxAI.helpers.isModelSupportVision(model)
  }

  public isCurrentModelSupportToolUse(model: string) {
    return ChatboxAI.helpers.isModelSupportToolUse(model)
  }
}
