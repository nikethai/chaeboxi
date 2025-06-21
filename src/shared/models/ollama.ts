import { ProviderModelInfo } from '../types'
import { ModelDependencies } from '../types/adapters'
import { normalizeOpenAIApiHostAndPath } from '../utils/llm_utils'
import OpenAICompatible from './openai-compatible'

const helpers = {
  isModelSupportVision: (model: string) => {
    return [
      'gemma3',
      'llava',
      'llama3.2-vision',
      'llava-llama3',
      'moondream',
      'bakllava',
      'llava-phi3',
      'granite3.2-vision',
      'qwen3',
    ].some((m) => model.startsWith(m))
  },
  isModelSupportToolUse: (model: string) => {
    return [
      'qwq',
      'llama3.3',
      'llama3.2',
      'llama3.1',
      'mistral',
      'qwen2.5',
      'qwen2.5-coder',
      'qwen2',
      'mistral-nemo',
      'mixtral',
      'smollm2',
      'mistral-small',
      'command-r',
      'hermes3',
      'mistral-large',
      'qwen3',
    ].some((m) => model.startsWith(m))
  },
}

interface Options {
  ollamaHost: string
  model: ProviderModelInfo
  temperature: number
}

export default class Ollama extends OpenAICompatible {
  public name = 'Ollama'

  constructor(public options: Options, dependencies: ModelDependencies) {
    super(
      {
        apiKey: 'ollama',
        apiHost: normalizeOpenAIApiHostAndPath({ apiHost: options.ollamaHost }).apiHost,
        model: options.model,
        temperature: options.temperature,
      },
      dependencies
    )
  }
  public isSupportToolUse(): boolean {
    return helpers.isModelSupportToolUse(this.options.model.modelId) || super.isSupportToolUse()
  }
  public isSupportVision(): boolean {
    return helpers.isModelSupportVision(this.options.model.modelId) || super.isSupportVision()
  }
}
