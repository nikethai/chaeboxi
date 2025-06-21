import { ProviderModelInfo } from '../types'
import { ModelDependencies } from '../types/adapters'
import OpenAICompatible from './openai-compatible'

interface Options {
  chatglmApiKey: string
  model: ProviderModelInfo
}

export default class ChatGLM extends OpenAICompatible {
  public name = 'ChatGLM'

  constructor(public options: Options, dependencies: ModelDependencies) {
    super(
      {
        apiKey: options.chatglmApiKey,
        apiHost: 'https://open.bigmodel.cn/api/paas/v4/',
        model: options.model,
      },
      dependencies
    )
  }

  public async listModels() {
    return []
  }
}
