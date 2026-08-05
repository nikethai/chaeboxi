import { ModelProviderEnum, ModelProviderType } from '../../types'
import {
  resolveOpenAIAccountId,
  resolveOpenAIAuthMode,
  resolveOpenAIBearer,
} from '../oauth/openai-codex-auth'
import { defineProvider } from '../registry'
import OpenAI from './models/openai'
import OpenAICodex from './models/openai-codex'

export const openaiProvider = defineProvider({
  id: ModelProviderEnum.OpenAI,
  name: 'OpenAI',
  type: ModelProviderType.OpenAI,
  description:
    'Sign in with ChatGPT (Plus/Pro subscription) or use a Platform API key. Subscription and API billing are separate.',
  urls: {
    website: 'https://openai.com',
    apiKey: 'https://platform.openai.com/api-keys',
    docs: 'https://platform.openai.com/docs',
  },
  defaultSettings: {
    apiHost: 'https://api.openai.com',
    authMode: 'api_key',
    // https://platform.openai.com/docs/models
    models: [
      {
        modelId: 'gpt-5.1',
        capabilities: ['vision', 'tool_use'],
        contextWindow: 400_000,
        maxOutput: 128_000,
      },
      {
        modelId: 'gpt-5-chat-latest',
        capabilities: ['vision', 'tool_use'],
        contextWindow: 400_000,
        maxOutput: 128_000,
      },
      {
        modelId: 'gpt-5',
        capabilities: ['vision', 'tool_use'],
        contextWindow: 400_000,
        maxOutput: 128_000,
      },
      {
        modelId: 'gpt-5-mini',
        capabilities: ['vision', 'tool_use'],
        contextWindow: 128_000,
        maxOutput: 4_096,
      },
      {
        modelId: 'gpt-5-nano',
        capabilities: ['vision', 'tool_use'],
        contextWindow: 128_000,
        maxOutput: 4_096,
      },
      {
        modelId: 'gpt-4o',
        capabilities: ['vision', 'tool_use'],
        contextWindow: 128_000,
        maxOutput: 4_096,
      },
      {
        modelId: 'gpt-4o-mini',
        capabilities: ['vision', 'tool_use'],
        contextWindow: 128_000,
        maxOutput: 4_096,
      },
      {
        modelId: 'o4-mini',
        capabilities: ['vision', 'tool_use', 'reasoning'],
        contextWindow: 200_000,
        maxOutput: 100_000,
      },
      {
        modelId: 'o3-mini',
        capabilities: ['vision', 'tool_use', 'reasoning'],
        contextWindow: 200_000,
        maxOutput: 200_000,
      },
      {
        modelId: 'o3',
        capabilities: ['vision', 'tool_use', 'reasoning'],
        contextWindow: 200_000,
        maxOutput: 100_000,
      },
      {
        modelId: 'text-embedding-3-small',
        type: 'embedding',
      },
    ],
  },
  createModel: (config) => {
    const mode = resolveOpenAIAuthMode(config.providerSetting)
    if (mode === 'oauth') {
      return new OpenAICodex(
        {
          apiKey: resolveOpenAIBearer(config.providerSetting),
          accountId: resolveOpenAIAccountId(config.providerSetting),
          model: config.model,
          temperature: config.settings.temperature,
          topP: config.settings.topP,
          maxOutputTokens: config.settings.maxTokens,
          stream: true,
          useProxy: false,
          cloudflareClientId: config.providerSetting.cloudflareClientId,
          cloudflareClientSecret: config.providerSetting.cloudflareClientSecret,
        },
        config.dependencies
      )
    }
    return new OpenAI(
      {
        apiKey: resolveOpenAIBearer(config.providerSetting),
        apiHost: config.formattedApiHost,
        cloudflareClientId: config.providerSetting.cloudflareClientId,
        cloudflareClientSecret: config.providerSetting.cloudflareClientSecret,
        model: config.model,
        dalleStyle: config.settings.dalleStyle || 'vivid',
        temperature: config.settings.temperature,
        topP: config.settings.topP,
        maxOutputTokens: config.settings.maxTokens,
        injectDefaultMetadata: config.globalSettings.injectDefaultMetadata,
        useProxy: false,
        stream: config.settings.stream,
      },
      config.dependencies
    )
  },
  getDisplayName: (modelId, providerSettings, sessionType) => {
    if (sessionType === 'picture') {
      return 'OpenAI API (DALL-E-3)'
    }
    const label = providerSettings?.models?.find((m) => m.modelId === modelId)?.nickname || modelId
    if (resolveOpenAIAuthMode(providerSettings) === 'oauth') {
      return `ChatGPT (${label})`
    }
    return `OpenAI API (${label})`
  },
})
