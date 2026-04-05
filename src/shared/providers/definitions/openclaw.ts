import { ModelProviderEnum, ModelProviderType } from '../../types'
import { defineProvider } from '../registry'
import CustomOpenAI from './models/custom-openai'

export const openClawProvider = defineProvider({
  id: ModelProviderEnum.OpenClaw,
  name: 'OpenClaw',
  type: ModelProviderType.OpenAI,
  description: 'Local OpenClaw gateway',
  urls: {
    website: 'https://docs.openclaw.ai/',
  },
  defaultSettings: {
    apiHost: 'http://127.0.0.1:18789/v1',
    models: [
      {
        modelId: 'pi-agent',
        capabilities: ['tool_use'],
      },
    ],
  },
  createModel: (config) => {
    return new CustomOpenAI(
      {
        apiKey: config.providerSetting.apiKey || '',
        apiHost: config.formattedApiHost,
        apiPath: config.formattedApiPath,
        cloudflareClientId: config.providerSetting.cloudflareClientId,
        cloudflareClientSecret: config.providerSetting.cloudflareClientSecret,
        model: config.model,
        temperature: config.settings.temperature,
        topP: config.settings.topP,
        maxOutputTokens: config.settings.maxTokens,
        stream: config.settings.stream,
        useProxy: false,
      },
      config.dependencies
    )
  },
  getDisplayName: (modelId, providerSettings) => {
    return `OpenClaw (${providerSettings?.models?.find((m) => m.modelId === modelId)?.nickname || modelId})`
  },
})
