import { ModelProviderEnum, ModelProviderType } from '../../types'
import { defineProvider } from '../registry'
import CustomOpenAI from './models/custom-openai'

const QWEN_API_HOST = 'https://dashscope.aliyuncs.com/compatible-mode/v1'

export const qwenProvider = defineProvider({
  id: ModelProviderEnum.Qwen,
  name: 'Qwen',
  type: ModelProviderType.OpenAI,
  urls: {
    website: 'https://chat.qwen.ai',
    docs: 'https://qwenlm.github.io/qwen-code-docs/en/users/overview/',
  },
  defaultSettings: {
    apiHost: QWEN_API_HOST,
    models: [
      {
        modelId: 'qwen3.5-plus',
        capabilities: ['reasoning'],
      },
      {
        modelId: 'qwen3-coder-plus',
        capabilities: ['reasoning', 'tool_use'],
      },
      {
        modelId: 'qwen3-max-2026-01-23',
        capabilities: ['reasoning'],
      },
    ],
  },
  createModel: (config) => {
    return new CustomOpenAI(
      {
        apiKey: config.providerSetting.apiKey || '',
        apiHost: config.formattedApiHost || QWEN_API_HOST,
        apiPath: '',
        model: config.model,
        temperature: config.settings.temperature,
        topP: config.settings.topP,
        maxOutputTokens: config.settings.maxTokens,
        useProxy: config.providerSetting.useProxy || false,
        stream: config.settings.stream,
      },
      config.dependencies
    )
  },
  getDisplayName: (modelId, providerSettings) => {
    return `Qwen (${providerSettings?.models?.find((m) => m.modelId === modelId)?.nickname || modelId})`
  },
})
