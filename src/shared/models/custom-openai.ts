import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { extractReasoningMiddleware, wrapLanguageModel } from 'ai'
import { ProviderModelInfo } from '../types'
import { ModelDependencies } from '../types/adapters'
import AbstractAISDKModel from './abstract-ai-sdk'
import { ApiError } from './errors'
import { CallChatCompletionOptions } from './types'

interface Options {
  apiKey: string
  apiHost: string
  apiPath: string
  model: ProviderModelInfo
  temperature?: number
  topP?: number
  useProxy?: boolean
}

export default class CustomOpenAI extends AbstractAISDKModel {
  public name = 'Custom OpenAI'

  constructor(public options: Options, dependencies: ModelDependencies) {
    super(options, dependencies)
  }

  private createFetchWithProxy = () => {
    if (!this.options.useProxy) {
      return fetch
    }

    return async (url: RequestInfo | URL, init?: RequestInit) => {
      return this.dependencies.request.fetchWithProxy(url.toString(), init)
    }
  }

  protected getCallSettings() {
    return {
      temperature: this.options.temperature,
      topP: this.options.topP,
    }
  }

  static isSupportTextEmbedding() {
    return true
  }

  protected getProvider() {
    return createOpenAICompatible({
      name: this.name,
      apiKey: this.options.apiKey,
      baseURL: `${this.options.apiHost}${this.options.apiPath}`,
      fetch: this.createFetchWithProxy(),
    })
  }

  protected getChatModel(options: CallChatCompletionOptions) {
    const provider = this.getProvider()
    return wrapLanguageModel({
      model: provider.languageModel(this.options.model.modelId),
      middleware: extractReasoningMiddleware({ tagName: 'think' }),
    })
  }

  public async listModels(): Promise<string[]> {
    const fetcher = this.createFetchWithProxy()
    const res = await fetcher(`${this.options.apiHost}${this.options.apiPath}/models`, {
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
      },
    })

    if (!res.ok) {
      throw new ApiError(`Failed to fetch models: ${res.status}`)
    }

    const data = await res.json()
    if (!data.data) {
      throw new ApiError('Invalid response format')
    }

    return data.data.map((item: any) => item.id)
  }

  protected getImageModel() {
    // Custom OpenAI providers typically don't support image generation
    return null
  }
}
