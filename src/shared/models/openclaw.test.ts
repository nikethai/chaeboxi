import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearAllGatewayClients, getOrCreateGatewayClient } from './openclaw'

describe('getOrCreateGatewayClient', () => {
  afterEach(() => {
    clearAllGatewayClients()
    vi.restoreAllMocks()
  })

  it('evicts stale gateway clients when the active gateway settings change', () => {
    const firstClient = getOrCreateGatewayClient('http://127.0.0.1:18789', 'token-a')
    const disconnectSpy = vi.spyOn(firstClient, 'disconnect')

    const secondClient = getOrCreateGatewayClient('http://127.0.0.1:28789', 'token-b')

    expect(secondClient).not.toBe(firstClient)
    expect(disconnectSpy).toHaveBeenCalledTimes(1)
    expect(getOrCreateGatewayClient('http://127.0.0.1:28789', 'token-b')).toBe(secondClient)
  })
})
