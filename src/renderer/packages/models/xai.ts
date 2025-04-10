import { ModelHelpers } from './base'
import OpenAICompatible from './openai-compatible'

const helpers: ModelHelpers = {
  isModelSupportVision: (model: string) => {
    return model.includes('vision')
  },
  isModelSupportToolUse: (model: string) => {
    return true
  },
}

interface Options {
  xAIKey: string
  xAIModel: string
  temperature?: number
  topP?: number
}

export default class XAI extends OpenAICompatible {
  public name = 'xAI'
  public static helpers = helpers

  constructor(public options: Options) {
    super({
      apiKey: options.xAIKey,
      apiHost: 'https://api.x.ai/v1',
      model: options.xAIModel,
      temperature: options.temperature,
      topP: options.topP,
    })
  }

  isSupportToolUse() {
    return helpers.isModelSupportToolUse(this.options.xAIModel)
  }
}
