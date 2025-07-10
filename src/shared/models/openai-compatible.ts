import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { extractReasoningMiddleware, wrapLanguageModel } from 'ai'
import type { ProviderModelInfo } from '../types'
import type { ModelDependencies } from '../types/adapters'
import AbstractAISDKModel from './abstract-ai-sdk'
import { ApiError } from './errors'
import type { ModelInterface } from './types'

interface OpenAICompatibleSettings {
  apiKey: string
  apiHost: string
  model: ProviderModelInfo
  temperature?: number
  topP?: number
  useProxy?: boolean
  maxTokens?: number
  stream?: boolean
}

export default abstract class OpenAICompatible extends AbstractAISDKModel implements ModelInterface {
  public name = 'OpenAI Compatible'

  constructor(private settings: OpenAICompatibleSettings, dependencies: ModelDependencies) {
    super(settings, dependencies)
  }

  protected getCallSettings() {
    return {
      temperature: this.settings.temperature,
      topP: this.settings.topP,
      maxTokens: this.settings.maxTokens,
    }
  }

  private createFetchWithProxy = () => {
    if (!this.settings.useProxy) {
      return undefined
    }

    return async (url: RequestInfo | URL, init?: RequestInit) => {
      return this.dependencies.request.fetchWithProxy(url.toString(), init)
    }
  }

  static isSupportTextEmbedding() {
    return true
  }

  protected getProvider() {
    return createOpenAICompatible({
      name: this.name,
      apiKey: this.settings.apiKey,
      baseURL: this.settings.apiHost,
      fetch: this.createFetchWithProxy(),
    })
  }

  protected getChatModel() {
    const provider = this.getProvider()
    return wrapLanguageModel({
      model: provider.languageModel(this.settings.model.modelId),
      middleware: extractReasoningMiddleware({ tagName: 'think' }),
    })
  }

  public async listModels(): Promise<string[]> {
    return fetchRemoteModels(
      {
        apiHost: this.settings.apiHost,
        apiKey: this.settings.apiKey,
        useProxy: this.settings.useProxy,
      },
      this.dependencies
    ).catch((err) => {
      console.error(err)
      return []
    })
  }
}

interface ListModelsResponse {
  object: 'list'
  data: {
    id: string
    object: 'model'
    created: number
    owned_by: string
  }[]
}

export async function fetchRemoteModels(
  params: { apiHost: string; apiKey: string; useProxy?: boolean },
  dependencies: ModelDependencies
) {
  const response = await dependencies.request.apiRequest({
    url: `${params.apiHost}/models`,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
    },
    useProxy: params.useProxy,
  })
  const json: ListModelsResponse = await response.json()
  if (!json.data) {
    throw new ApiError(JSON.stringify(json))
  }
  return json.data.map((item) => item.id)
}
