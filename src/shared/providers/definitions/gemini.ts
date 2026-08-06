import { ModelProviderEnum, ModelProviderType } from '../../types'
import {
  resolveGeminiAntigravityProjectId,
  resolveGeminiAuthMode,
  resolveGeminiCredential,
} from '../oauth/gemini-antigravity-auth'
import { defineProvider } from '../registry'
import Gemini from './models/gemini'
import GeminiAntigravity from './models/gemini-antigravity'

export const geminiProvider = defineProvider({
  id: ModelProviderEnum.Gemini,
  name: 'Gemini',
  type: ModelProviderType.Gemini,
  urls: {
    website: 'https://gemini.google.com/',
    apiKey: 'https://aistudio.google.com/apikey',
    docs: 'https://ai.google.dev/gemini-api/docs',
  },
  description:
    'Sign in with Google (Antigravity / experimental subscription quota) or use an AI Studio API key. Subscription and API billing are separate. Google sign-in is unofficial and may carry account risk.',
  defaultSettings: {
    apiHost: 'https://generativelanguage.googleapis.com',
    authMode: 'api_key',
    // https://ai.google.dev/models/gemini
    models: [
      {
        modelId: 'gemini-3-pro-preview',
        capabilities: ['vision', 'reasoning', 'tool_use'],
        contextWindow: 1_000_000,
        maxOutput: 8_192,
      },
      {
        modelId: 'gemini-3-pro-image-preview',
        capabilities: ['vision'],
        contextWindow: 32_768,
        maxOutput: 8_192,
      },
      {
        modelId: 'gemini-2.5-flash',
        capabilities: ['vision', 'reasoning', 'tool_use'],
        contextWindow: 1_000_000,
        maxOutput: 8_192,
      },
      {
        modelId: 'gemini-2.5-pro',
        capabilities: ['vision', 'reasoning', 'tool_use'],
        contextWindow: 1_000_000,
        maxOutput: 8_192,
      },
      {
        modelId: 'gemini-2.5-flash-image',
        capabilities: ['vision'],
        contextWindow: 32_768,
        maxOutput: 8_192,
      },
      {
        modelId: 'gemini-3.1-flash-image-preview',
        capabilities: ['vision'],
        contextWindow: 32_768,
        maxOutput: 8_192,
      },
      {
        modelId: 'gemini-2.0-flash',
        capabilities: ['vision'],
        contextWindow: 1_000_000,
        maxOutput: 8_192,
      },
    ],
  },
  createModel: (config) => {
    const mode = resolveGeminiAuthMode(config.providerSetting)
    if (mode === 'oauth') {
      return new GeminiAntigravity(
        {
          apiKey: resolveGeminiCredential(config.providerSetting),
          projectId: resolveGeminiAntigravityProjectId(config.providerSetting),
          model: config.model,
          temperature: config.settings.temperature,
          topP: config.settings.topP,
          maxOutputTokens: config.settings.maxTokens,
          stream: config.settings.stream,
          useProxy: false,
        },
        config.dependencies
      )
    }
    return new Gemini(
      {
        geminiAPIKey: config.providerSetting.apiKey || '',
        geminiAPIHost: config.formattedApiHost,
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
    const mode = resolveGeminiAuthMode(providerSettings)
    const nick = providerSettings?.models?.find((m) => m.modelId === modelId)?.nickname || modelId
    return mode === 'oauth' ? `Gemini Antigravity (${nick})` : `Gemini API (${nick})`
  },
})
