import type { ProviderModelInfo } from '../types'
import type { ModelDependencies } from '../types/adapters'
import OpenAICompatible from './openai-compatible'


interface Options {
  xAIKey: string
  model: ProviderModelInfo
  temperature?: number
  topP?: number
  maxTokens?: number
  stream?: boolean
}

export default class XAI extends OpenAICompatible {
  public name = 'xAI'

  constructor(
    public options: Options,
    dependencies: ModelDependencies
  ) {
    super(
      {
        apiKey: options.xAIKey,
        apiHost: 'https://api.x.ai/v1',
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
