import type { ProviderModelInfo } from '../types'
import type { ModelDependencies } from '../types/adapters'
import OpenAICompatible from './openai-compatible'

interface Options {
  chatglmApiKey: string
  model: ProviderModelInfo
  temperature?: number
  topP?: number
  maxTokens?: number
  stream?: boolean
}

export default class ChatGLM extends OpenAICompatible {
  public name = 'ChatGLM'

  constructor(public options: Options, dependencies: ModelDependencies) {
    super(
      {
        apiKey: options.chatglmApiKey,
        apiHost: 'https://open.bigmodel.cn/api/paas/v4/',
        model: options.model,
        temperature: options.temperature,
        topP: options.topP,
        maxTokens: options.maxTokens,
        stream: options.stream,
      },
      dependencies
    )
  }

  public async listModels() {
    return []
  }
}
