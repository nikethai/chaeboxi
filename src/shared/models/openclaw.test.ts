import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearAllGatewayClients, getOrCreateGatewayClient } from './openclaw'

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
