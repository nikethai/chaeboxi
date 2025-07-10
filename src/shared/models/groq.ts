import type { ProviderModelInfo } from '../types'
import type { ModelDependencies } from '../types/adapters'
import OpenAICompatible from './openai-compatible'

interface Options {
  groqAPIKey: string
  model: ProviderModelInfo
  temperature?: number
  topP?: number
  maxTokens?: number
}

export default class Groq extends OpenAICompatible {
  public name = 'Groq'

  constructor(
    public options: Options,
    dependencies: ModelDependencies
  ) {
    super(
      {
        apiKey: options.groqAPIKey,
        apiHost: 'https://api.groq.com/openai/v1',
        model: options.model,
        temperature: options.temperature,
        topP: options.topP,
        maxTokens: options.maxTokens,
      },
      dependencies
    )
  }
}
