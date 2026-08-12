import { ModelProviderEnum, ModelProviderType } from '../../types'
import { resolveXaiBearer } from '../oauth/xai-auth'
import { defineProvider } from '../registry'
import XAI from './models/xai'

export const xaiProvider = defineProvider({
  id: ModelProviderEnum.XAI,
  name: 'xAI',
  type: ModelProviderType.OpenAI,
  urls: {
    website: 'https://x.ai/',
    apiKey: 'https://console.x.ai/',
    docs: 'https://docs.x.ai/',
  },
  description:
    'Sign in with SuperGrok or X Premium (OAuth), or use a developer API key from console.x.ai. Subscription and API billing are separate.',
  defaultSettings: {
    apiHost: 'https://api.x.ai',
    authMode: 'oauth',
    models: [
      {
        modelId: 'grok-4-1-fast-reasoning',
        contextWindow: 2_000_000,
        capabilities: ['vision', 'tool_use', 'reasoning'],
      },
      {
        modelId: 'grok-4-1-fast-non-reasoning',
        contextWindow: 2_000_000,
        capabilities: ['vision', 'tool_use'],
      },
      {
        modelId: 'grok-build-0.1',
        contextWindow: 1_000_000,
        capabilities: ['tool_use'],
      },
      {
        modelId: 'grok-imagine-image',
        nickname: 'Grok Imagine',
        capabilities: ['image_generation', 'image_edit'],
      },
    ],
  },
  createModel: (config) => {
    return new XAI(
      {
        apiKey: resolveXaiBearer(config.providerSetting),
        cloudflareClientId: config.providerSetting.cloudflareClientId,
        cloudflareClientSecret: config.providerSetting.cloudflareClientSecret,
        model: config.model,
        temperature: config.settings.temperature,
        topP: config.settings.topP,
        maxOutputTokens: config.settings.maxTokens,
        stream: config.settings.stream,
      },
      config.dependencies
    )
  },
  getDisplayName: (modelId, providerSettings) => {
    return `xAI (${providerSettings?.models?.find((m) => m.modelId === modelId)?.nickname || modelId})`
  },
})
