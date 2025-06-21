import { ProviderModelInfo } from '../types'
import { ModelDependencies } from '../types/adapters'
import OpenAICompatible from './openai-compatible'

interface Options {
  deepseekAPIKey: string
  model: ProviderModelInfo
  temperature?: number
  topP?: number
}

export default class DeepSeek extends OpenAICompatible {
  public name = 'DeepSeek'

  constructor(public options: Options, dependencies: ModelDependencies) {
    super({
      apiKey: options.deepseekAPIKey,
      apiHost: 'https://api.deepseek.com/v1',
      model: options.model,
      temperature: options.model.modelId === 'deepseek-reasoner' ? undefined : options.temperature,
      topP: options.model.modelId === 'deepseek-reasoner' ? undefined : options.topP,
    }, dependencies)
  }

  isSupportToolUse(scope?: 'web-browsing') {
    if (scope === 'web-browsing') {
      return false
    }
    return super.isSupportToolUse()
  }
}
