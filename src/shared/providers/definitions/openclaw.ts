import { ModelProviderEnum, ModelProviderType } from '../../types'
import { defineProvider } from '../registry'
import OpenClawModel from '../../models/openclaw'
import { OpenClawGatewayClient } from '../../openclaw/gateway'

export const openClawProvider = defineProvider({
  id: ModelProviderEnum.OpenClaw,
  name: 'OpenClaw',
  type: ModelProviderType.OpenAI,
  description: 'OpenClaw gateway via WebSocket',
  urls: {
    website: 'https://docs.openclaw.ai/',
  },
  defaultSettings: {
    apiHost: 'http://127.0.0.1:18789',
    models: [
      {
        modelId: 'pi-agent',
        capabilities: ['tool_use'],
      },
    ],
  },
  listModels: async (config) => {
    const client = new OpenClawGatewayClient(config.formattedApiHost, {
      token: config.providerSetting.apiKey || undefined,
      cloudflareClientId: config.providerSetting.cloudflareClientId || undefined,
      cloudflareClientSecret: config.providerSetting.cloudflareClientSecret || undefined,
    })

    try {
      await client.connect()
      const response = await client.listAgents()
      return response.agents.map((agent) => ({
        modelId: agent.id,
        nickname: agent.name,
        capabilities: agent.capabilities as ('vision' | 'reasoning' | 'tool_use' | 'web_search')[],
      }))
    } catch (error) {
      console.warn('[OpenClaw] Failed to list agents:', error)
      return [
        {
          modelId: 'pi-agent',
          capabilities: ['tool_use'],
        },
      ]
    } finally {
      client.disconnect()
    }
  },
  createModel: (config) => {
    return new OpenClawModel(
      {
        apiKey: config.providerSetting.apiKey || '',
        apiHost: config.formattedApiHost,
        model: config.model,
        cloudflareClientId: config.providerSetting.cloudflareClientId || undefined,
        cloudflareClientSecret: config.providerSetting.cloudflareClientSecret || undefined,
      },
      config.dependencies
    )
  },
  getDisplayName: (modelId, providerSettings) => {
    return `OpenClaw (${providerSettings?.models?.find((m) => m.modelId === modelId)?.nickname || modelId})`
  },
})
