/**
 * ChatGPT subscription (Codex / WHAM) chat via Responses API.
 * Uses OAuth bearer + ChatGPT-Account-Id; forces stream + store:false.
 */

import { createOpenAI } from '@ai-sdk/openai'
import { extractReasoningMiddleware, wrapLanguageModel } from 'ai'
import AbstractAISDKModel from '../../../models/abstract-ai-sdk'
import type { CallChatCompletionOptions } from '../../../models/types'
import { createFetchWithProxy } from '../../../models/utils/fetch-proxy'
import type { ProviderModelInfo } from '../../../types'
import type { ModelDependencies } from '../../../types/adapters'
import {
  fetchOpenAICodexModels,
  OPENAI_CODEX_DEFAULT_MODELS,
} from '../../oauth/openai-codex-models'
import { OPENAI_CODEX_WHAM_API_BASE } from '../../oauth/openai-codex-oauth'

interface Options {
  apiKey: string
  accountId?: string
  model: ProviderModelInfo
  temperature?: number
  topP?: number
  maxOutputTokens?: number
  stream?: boolean
  useProxy?: boolean
  cloudflareClientId?: string
  cloudflareClientSecret?: string
}

type FetchFunction = typeof globalThis.fetch

export default class OpenAICodex extends AbstractAISDKModel {
  public name = 'OpenAI ChatGPT (Codex)'
  public options: Options

  constructor(options: Options, dependencies: ModelDependencies) {
    super(options, dependencies)
    this.options = options
  }

  protected getCallSettings(options: CallChatCompletionOptions) {
    const openaiProviderOptions = options.providerOptions?.openai
    return {
      temperature: this.options.temperature,
      topP: this.options.topP,
      maxOutputTokens: this.options.maxOutputTokens,
      // WHAM requires stream=true
      stream: true,
      providerOptions: {
        openai: {
          ...openaiProviderOptions,
          store: false,
        },
      },
    }
  }

  static isSupportTextEmbedding() {
    return false
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {}
    if (this.options.accountId) {
      headers['ChatGPT-Account-Id'] = this.options.accountId
    }
    if (this.options.cloudflareClientId) {
      headers['CF-Access-Client-Id'] = this.options.cloudflareClientId
    }
    if (this.options.cloudflareClientSecret) {
      headers['CF-Access-Client-Secret'] = this.options.cloudflareClientSecret
    }
    return headers
  }

  protected getProvider(_options: CallChatCompletionOptions, fetchFunction?: FetchFunction) {
    const baseURL = OPENAI_CODEX_WHAM_API_BASE
    return createOpenAI({
      apiKey: this.options.apiKey,
      baseURL,
      fetch: fetchFunction || createFetchWithProxy(this.options.useProxy, this.dependencies),
      headers: this.buildHeaders(),
    })
  }

  protected getChatModel(options: CallChatCompletionOptions) {
    const provider = this.getProvider(options)
    return wrapLanguageModel({
      model: provider.responses(this.options.model.modelId),
      middleware: extractReasoningMiddleware({ tagName: 'think' }),
    })
  }

  public listModels() {
    return fetchOpenAICodexModels(this.options.apiKey, {
      accountId: this.options.accountId,
    }).catch((error) => {
      console.warn('[OpenAICodex] Failed to fetch WHAM models, using fallback.', error)
      return OPENAI_CODEX_DEFAULT_MODELS
    })
  }

  protected getImageModel() {
    return null
  }
}
