import { ModelHelpers } from './types'
import OpenAICompatible from './openai-compatible'
import { normalizeOpenAIApiHostAndPath } from './llm_utils'

const helpers: ModelHelpers = {
  isModelSupportVision: (model: string) => {
    model = model.toLowerCase()
    return model.includes('vision') || model.includes('llava')
  },
  isModelSupportToolUse: (model: string) => {
    return false
  },
}

interface Options {
  lmStudioHost: string
  lmStudioModel: string
  temperature?: number
  topP?: number
}

export default class LMStudio extends OpenAICompatible {
  public name = 'LM Studio'
  public static helpers = helpers

  constructor(public options: Options) {
    super({
      apiKey: '',
      apiHost: normalizeOpenAIApiHostAndPath({ apiHost: options.lmStudioHost }).apiHost,
      model: options.lmStudioModel,
      temperature: options.temperature,
      topP: options.topP,
    })
  }

  isSupportToolUse() {
    return helpers.isModelSupportToolUse(this.options.lmStudioModel)
  }
}
