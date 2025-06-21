import { ProviderModelInfo } from '../types'
import { ModelDependencies } from '../types/adapters'
import OpenAICompatible from './openai-compatible'

interface Options {
  siliconCloudKey: string
  model: ProviderModelInfo
  temperature?: number
  topP?: number
}

export default class SiliconFlow extends OpenAICompatible {
  public name = 'SiliconFlow'

  constructor(public options: Options, dependencies: ModelDependencies) {
    super({
      apiKey: options.siliconCloudKey,
      apiHost: 'https://api.siliconflow.cn/v1',
      model: options.model,
      temperature: options.temperature,
      topP: options.topP,
    }, dependencies)
  }

  isSupportToolUse(scope?: 'web-browsing') {
    if (scope === 'web-browsing' && this.options.model.modelId.includes('deepseek')) {
      return false
    }
    return super.isSupportToolUse()
  }
}
