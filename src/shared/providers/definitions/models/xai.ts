import OpenAICompatible, { type OpenAICompatibleSettings } from '../../../models/openai-compatible'
import type { ProviderModelInfo } from '../../../types'
import type { ModelDependencies } from '../../../types/adapters'
import { fetchXaiModels } from '../../oauth/xai-models'

interface Options extends OpenAICompatibleSettings {}

export default class XAI extends OpenAICompatible {
  public name = 'xAI'
  public options: Options
  constructor(options: Omit<Options, 'apiHost'>, dependencies: ModelDependencies) {
    const apiHost = 'https://api.x.ai/v1'
    super(
      {
        apiKey: options.apiKey,
        apiHost,
        cloudflareClientId: options.cloudflareClientId,
        cloudflareClientSecret: options.cloudflareClientSecret,
        model: options.model,
        temperature: options.temperature,
        topP: options.topP,
        maxOutputTokens: options.maxOutputTokens,
        stream: options.stream,
      },
      dependencies
    )
    this.options = {
      ...options,
      apiHost,
    }
  }

  /**
   * Prefer desktop-native HTTP (no CORS) for SuperGrok OAuth / API key model lists.
   */
  public async listModels(): Promise<ProviderModelInfo[]> {
    if (!this.options.apiKey) {
      return []
    }
    try {
      return await fetchXaiModels(this.options.apiKey, { apiBase: this.options.apiHost })
    } catch (err) {
      console.error('[xAI] listModels failed', err)
      // Fall back to OpenAI-compatible path (may still CORS-fail in webview)
      return super.listModels()
    }
  }
}
