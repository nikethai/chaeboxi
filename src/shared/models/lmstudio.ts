import type { ProviderModelInfo } from '../types'
import type { ModelDependencies } from '../types/adapters'
import { normalizeOpenAIApiHostAndPath } from '../utils/llm_utils'
import OpenAICompatible from './openai-compatible'

interface Options {
  lmStudioHost: string
  model: ProviderModelInfo
  temperature?: number
  topP?: number
  maxTokens?: number
  stream?: boolean
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
        maxTokens: options.maxTokens,
        stream: options.stream,
      },
      dependencies
    )
  }
}
