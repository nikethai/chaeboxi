import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { extractReasoningMiddleware, wrapLanguageModel } from 'ai'
import { max } from 'lodash'
import type { ProviderModelInfo } from '../types'
import type { ModelDependencies } from '../types/adapters'
import { normalizeOpenAIApiHostAndPath } from '../utils/llm_utils'
import AbstractAISDKModel from './abstract-ai-sdk'
import { ApiError } from './errors'
import type { CallChatCompletionOptions } from './types'

interface Options {
  apiKey: string
  apiHost: string
  apiPath: string
  model: ProviderModelInfo
  temperature?: number
  topP?: number
  maxTokens?: number
  stream?: boolean
  useProxy?: boolean
}

type FetchFunction = typeof globalThis.fetch

export default class CustomOpenAI extends AbstractAISDKModel {
  public name = 'Custom OpenAI'

  constructor(public options: Options, dependencies: ModelDependencies) {
    super(options, dependencies)
    const { apiHost, apiPath } = normalizeOpenAIApiHostAndPath(options)
    this.options = { ...options, apiHost, apiPath }
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
      maxTokens: this.options.maxTokens,
      stream: this.options.stream,
    }
  }

  static isSupportTextEmbedding() {
    return true
  }

  protected getProvider(_options: CallChatCompletionOptions, fetchFunction?: FetchFunction) {
    return createOpenAICompatible({
      name: this.name,
      apiKey: this.options.apiKey,
      baseURL: this.options.apiHost,
      fetch: fetchFunction,
      headers: this.options.apiHost.includes('openrouter.ai')
        ? {
            'HTTP-Referer': 'https://chatboxai.app',
            'X-Title': 'Chatbox AI',
          }
        : this.options.apiHost.includes('aihubmix.com')
          ? {
              'APP-Code': 'VAFU9221',
            }
          : undefined,
    })
  }

  protected getChatModel(options: CallChatCompletionOptions) {
    const fetcher = this.createFetchWithProxy()
    const { apiHost, apiPath } = this.options
    const provider = this.getProvider(options, async (_input, init) => {
      return fetcher(`${apiHost}${apiPath}`, init)
    })
    return wrapLanguageModel({
      model: provider.languageModel(this.options.model.modelId),
      middleware: extractReasoningMiddleware({ tagName: 'think' }),
    })
  }

  public async listModels(): Promise<string[]> {
    const fetcher = this.createFetchWithProxy()
    const { apiHost } = this.options
    const res = await fetcher(`${apiHost}/models`, {
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
