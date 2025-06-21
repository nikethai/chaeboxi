import { ProviderModelInfo } from '../types'
import { ModelDependencies } from '../types/adapters'
import OpenAICompatible from './openai-compatible'
import { normalizeOpenAIApiHostAndPath } from '../utils/llm_utils'

interface Options {
  lmStudioHost: string
  model: ProviderModelInfo
  temperature?: number
  topP?: number
}

export default class LMStudio extends OpenAICompatible {
  public name = 'LM Studio'

  constructor(public options: Options, dependencies: ModelDependencies) {
    super(
      {
        apiKey: '',
        apiHost: normalizeOpenAIApiHostAndPath({ apiHost: options.lmStudioHost }).apiHost,
        model: options.model,
        temperature: options.temperature,
        topP: options.topP,
      },
      dependencies
    )
  }
}
