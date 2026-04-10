import { ModelProviderEnum, ModelProviderType } from '../../types'
import { defineProvider } from '../registry'
import OpenClawModel from '../../models/openclaw'

export const openClawProvider = defineProvider({
  id: ModelProviderEnum.OpenClaw,
  name: 'OpenClaw',
  type: ModelProviderType.OpenAI,
  description: 'OpenClaw local AI agent runtime',
  urls: {
    website: 'https://openclaw.ai/',
    docs: 'https://docs.openclaw.ai/',
  },
  defaultSettings: {
    apiHost: 'ws://127.0.0.1:18789',
    models: [
      {
        modelId: 'pi-agent',
        nickname: 'Pi Agent',
        capabilities: ['tool_use'],
      },
    ],
  },
  createModel: (config) => {
    return new OpenClawModel({
      apiHost: config.formattedApiHost || 'ws://127.0.0.1:18789',
      apiKey: config.providerSetting.apiKey || '',
      model: config.model,
      dependencies: config.dependencies,
    })
  },
  getDisplayName: (modelId, providerSettings) => {
    return `OpenClaw (${providerSettings?.models?.find((m) => m.modelId === modelId)?.nickname || modelId})`
  },
})
