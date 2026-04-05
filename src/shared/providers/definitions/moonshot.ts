import { ModelProviderEnum, ModelProviderType } from '../../types'
import { defineProvider } from '../registry'
import OpenAI from './models/openai'

export const MOONSHOT_API_HOST = 'https://api.moonshot.ai/v1'

export const moonshotProvider = defineProvider({
  id: ModelProviderEnum.Moonshot,
  name: 'Moonshot AI',
  type: ModelProviderType.OpenAI,
  urls: {
    website: 'https://www.moonshot.ai',
  },
  defaultSettings: {
    apiHost: MOONSHOT_API_HOST,
    models: [
      {
        modelId: 'kimi-k2.5',
        capabilities: ['vision'],
        contextWindow: 256_000,
        maxOutput: 8_192,
      },
      {
        modelId: 'kimi-k2-thinking',
      },
      {
        modelId: 'kimi-k2-thinking-turbo',
      },
    ],
  },
  createModel: (config) => {
    return new OpenAI(
      {
        apiKey: config.providerSetting.apiKey || '',
        apiHost: config.formattedApiHost || MOONSHOT_API_HOST,
        model: config.model,
        dalleStyle: 'vivid',
        temperature: config.settings.temperature,
        topP: config.settings.topP,
        maxOutputTokens: config.settings.maxTokens,
        injectDefaultMetadata: config.globalSettings.injectDefaultMetadata,
        useProxy: config.providerSetting.useProxy || false,
        stream: config.settings.stream,
      },
      config.dependencies
    )
  },
  getDisplayName: (modelId, providerSettings) => {
    return `Moonshot (${providerSettings?.models?.find((m) => m.modelId === modelId)?.nickname || modelId})`
  },
})
