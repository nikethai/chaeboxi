import { afterEach, describe, expect, it, vi } from 'vitest'
import OpenClawModel, { clearAllGatewayClients, getOrCreateGatewayClient } from './openclaw'
import { OpenClawGatewayClient } from '../openclaw/gateway'

describe('getOrCreateGatewayClient', () => {
  afterEach(() => {
    clearAllGatewayClients()
    vi.restoreAllMocks()
  })

  it('evicts stale gateway clients when the active gateway settings change', () => {
    const firstClient = getOrCreateGatewayClient({ apiHost: 'http://127.0.0.1:18789', apiKey: 'token-a' })
    const disconnectSpy = vi.spyOn(firstClient, 'disconnect')

    const secondClient = getOrCreateGatewayClient({ apiHost: 'http://127.0.0.1:28789', apiKey: 'token-b' })

    expect(secondClient).not.toBe(firstClient)
    expect(disconnectSpy).toHaveBeenCalledTimes(1)
    expect(getOrCreateGatewayClient({ apiHost: 'http://127.0.0.1:28789', apiKey: 'token-b' })).toBe(secondClient)
  })

  it('creates different clients for different CF credentials on same host', () => {
    const clientA = getOrCreateGatewayClient({
      apiHost: 'http://gateway.example.com',
      apiKey: 'token',
      cloudflareClientId: 'id-a',
      cloudflareClientSecret: 'secret-a',
    })
    const disconnectSpy = vi.spyOn(clientA, 'disconnect')

    const clientB = getOrCreateGatewayClient({
      apiHost: 'http://gateway.example.com',
      apiKey: 'token',
      cloudflareClientId: 'id-b',
      cloudflareClientSecret: 'secret-b',
    })

    expect(clientB).not.toBe(clientA)
    expect(disconnectSpy).toHaveBeenCalledTimes(1)
  })

  it('returns same client for identical config', () => {
    const clientA = getOrCreateGatewayClient({
      apiHost: 'http://gateway.example.com',
      apiKey: 'token',
      cloudflareClientId: 'id-a',
    })
    const clientB = getOrCreateGatewayClient({
      apiHost: 'http://gateway.example.com',
      apiKey: 'token',
      cloudflareClientId: 'id-a',
    })

    expect(clientB).toBe(clientA)
  })
})

describe('OpenClawModel', () => {
  afterEach(() => {
    clearAllGatewayClients()
    vi.restoreAllMocks()
  })

  it('reuses the latest gateway session and forwards system prompts as extraSystemPrompt', async () => {
    vi.spyOn(OpenClawGatewayClient.prototype, 'connect').mockResolvedValue({
      status: 'ok',
      stateVersion: 1,
      uptimeMs: 1,
      limits: {},
      policy: {},
      features: {},
    })
    vi.spyOn(OpenClawGatewayClient.prototype, 'listSessions').mockResolvedValue({
      sessions: [
        {
          id: 'old-session',
          createdAt: 1,
          updatedAt: 1,
          agentId: 'rp-agent',
        },
        {
          id: 'latest-session',
          createdAt: 2,
          updatedAt: 20,
          agentId: 'rp-agent',
        },
      ],
    })

    const invokeAgentSpy = vi.spyOn(OpenClawGatewayClient.prototype, 'invokeAgent').mockImplementation(async function* () {
      yield {
        type: 'chunk',
        invocationId: 'run-1',
        delta: 'hello',
      }
      yield {
        type: 'done',
        invocationId: 'run-1',
        status: 'ok',
      }
    })

    const model = new OpenClawModel(
      {
        apiKey: 'token',
        apiHost: 'http://127.0.0.1:18789',
        model: {
          modelId: 'rp-agent',
          capabilities: ['tool_use'],
        },
      },
      {} as never
    )

    await model.chat(
      [
        { role: 'system', content: 'Read AGENTS.md first.' },
        { role: 'user', content: 'hi' },
      ],
      { sessionId: 'local-session-1' }
    )

    expect(invokeAgentSpy).toHaveBeenCalledWith(
      'rp-agent',
      { role: 'user', content: 'hi' },
      {
        sessionId: 'latest-session',
        sessionKey: undefined,
        extraSystemPrompt: 'Read AGENTS.md first.',
      },
      undefined
    )
  })
})
