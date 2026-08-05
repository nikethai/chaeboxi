import { ModelProviderEnum, ModelProviderType } from '../../types'
import { getQwenPreset } from '../plan-presets'
import { defineProvider } from '../registry'
import CustomOpenAI from './models/custom-openai'

/** Legacy/China standard DashScope host (fallback when no plan preset) */
const QWEN_API_HOST = 'https://dashscope.aliyuncs.com/compatible-mode/v1'

export const qwenProvider = defineProvider({
  id: ModelProviderEnum.Qwen,
  name: 'Qwen',
  type: ModelProviderType.OpenAI,
  urls: {
    website: 'https://www.qwencloud.com',
    apiKey: 'https://home.qwencloud.com/api-keys',
    docs: 'https://docs.qwencloud.com/developer-guides/clients-and-developer-tools/chatbox',
  },
  defaultSettings: {
    // Prefer Token Plan path for new users; existing users keep saved apiHost
    planId: 'token-plan',
    region: 'international',
    apiHost: 'https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1',
    models: getQwenPreset('token-plan', 'international')!.models,
  },
  createModel: (config) => {
    const preset = getQwenPreset(config.providerSetting.planId, config.providerSetting.region)
    const fallbackHost = preset?.apiHost || QWEN_API_HOST
    return new CustomOpenAI(
      {
        apiKey: config.providerSetting.apiKey || '',
        apiHost: config.formattedApiHost || fallbackHost,
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
