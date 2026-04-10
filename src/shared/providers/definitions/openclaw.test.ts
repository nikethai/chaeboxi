import { afterEach, describe, expect, it, vi } from 'vitest'
import { OpenClawGatewayClient } from '../../openclaw/gateway'
import { openClawProvider } from './openclaw'

describe('openClawProvider.listModels', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('disconnects the temporary gateway client after model discovery', async () => {
    vi.spyOn(OpenClawGatewayClient.prototype, 'connect').mockResolvedValue({
      status: 'ok',
      stateVersion: 1,
      uptimeMs: 1,
      limits: {},
      policy: {},
      features: {},
    })
    vi.spyOn(OpenClawGatewayClient.prototype, 'listAgents').mockResolvedValue({
      agents: [{ id: 'pi-agent', name: 'Pi Agent', capabilities: ['tool_use'] }],
    })
    const disconnectSpy = vi.spyOn(OpenClawGatewayClient.prototype, 'disconnect').mockImplementation(() => {})

    const models = await (
      openClawProvider as typeof openClawProvider & {
        listModels: (config: { formattedApiHost: string; providerSetting: { apiKey?: string } }) => Promise<
          Array<{
            modelId: string
            nickname?: string
            capabilities: ('vision' | 'reasoning' | 'tool_use' | 'web_search')[]
          }>
        >
      }
    ).listModels({
      formattedApiHost: 'http://127.0.0.1:18789',
      providerSetting: { apiKey: 'token-a' },
    })

    expect(models).toEqual([
      {
        modelId: 'pi-agent',
        nickname: 'Pi Agent',
        capabilities: ['tool_use'],
      },
    ])
    expect(disconnectSpy).toHaveBeenCalledTimes(1)
  })
})
