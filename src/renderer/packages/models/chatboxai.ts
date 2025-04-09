import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { ChatboxAILicenseDetail, ChatboxAIModel } from 'src/shared/types'
import * as remote from '../remote'
import AbstractAISDKModel, { CallSettings } from './abstract-ai-sdk'
import { CallChatCompletionOptions, ModelHelpers, ModelInterface } from './types'

export const chatboxAIModels: ChatboxAIModel[] = ['chatboxai-3.5', 'chatboxai-4']

const helpers: ModelHelpers = {
  isModelSupportVision: (model: string) => {
    return !['gpt-3.5-turbo', 'o1-mini', 'o1-preview', 'DeepSeek-R1', 'DeepSeek-V3'].includes(model)
  },
  isModelSupportToolUse: (model: string) => {
    return !['o1-mini', 'o1-preview', 'gemini-2.0-flash-exp', 'gemini-2.0-flash-exp-image-generation'].includes(model)
  },
}

interface Options {
  licenseKey?: string
  chatboxAIModel: ChatboxAIModel
  licenseInstances?: {
    [key: string]: string
  }
  licenseDetail?: ChatboxAILicenseDetail
  language: string
  dalleStyle: 'vivid' | 'natural'
  temperature: number
}

interface Config {
  uuid: string
}

export default class ChatboxAI extends AbstractAISDKModel implements ModelInterface {
  public name = 'ChatboxAI'
  public static helpers = helpers

  constructor(public options: Options, public config: Config) {
    super()
  }

  getChatModel(options: CallChatCompletionOptions) {
    const license = this.options.licenseKey || ''
    const instanceId = (this.options.licenseInstances ? this.options.licenseInstances[license] : '') || ''
    if (this.options.chatboxAIModel.startsWith('gemini')) {
      const provider = createGoogleGenerativeAI({
        apiKey: this.options.licenseKey || '',
        baseURL: `${remote.API_ORIGIN}/gateway/google-ai-studio/v1beta`,
        headers: {
          'Instance-Id': instanceId,
          Authorization: `Bearer ${this.options.licenseKey || ''}`,
        },
      })
      return provider.chat(this.options.chatboxAIModel, {
        structuredOutputs: false,
      })
    } else {
      const provider = createOpenAICompatible({
        name: 'ChatboxAI',
        apiKey: this.options.licenseKey || '',
        baseURL: `${remote.API_ORIGIN}/gateway/openai/v1`,
        headers: {
          'Instance-Id': instanceId,
        },
      })
      return provider.languageModel(this.options.chatboxAIModel)
    }
  }

  isSupportSystemMessage() {
    return ![
      'o1-mini',
      'gemini-2.0-flash-exp',
      'gemini-2.0-flash-thinking-exp',
      'gemini-2.0-flash-exp-image-generation',
    ].includes(this.options.chatboxAIModel)
  }

  isSupportVision() {
    return helpers.isModelSupportVision(this.options.chatboxAIModel)
  }

  isSupportToolUse() {
    return helpers.isModelSupportToolUse(this.options.chatboxAIModel)
  }
}
