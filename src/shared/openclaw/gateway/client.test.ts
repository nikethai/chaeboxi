import { afterEach, describe, expect, it, vi } from 'vitest'
import { OpenClawGatewayClient } from './client'

async function waitForPendingStreamWaiter(client: OpenClawGatewayClient): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt++) {
    if ((client as unknown as { agentEventResolvers: Map<string, unknown> }).agentEventResolvers.size > 0) {
      return
    }
    await Promise.resolve()
  }

  throw new Error('Timed out waiting for stream waiter registration')
}

describe('OpenClawGatewayClient', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects a pending agent stream waiter when disconnect closes the connection', async () => {
    const client = new OpenClawGatewayClient('http://127.0.0.1:18789')

    ;(client as unknown as { ws: { readyState: number; close: () => void; send: () => void }; state: string }).ws = {
      readyState: 1,
      close: vi.fn(),
      send: vi.fn(),
    }
    ;(client as unknown as { state: string }).state = 'connected'

    vi.spyOn(client, 'request').mockResolvedValue({ status: 'accepted' })

    const stream = client.invokeAgent('pi-agent', { role: 'user', content: 'hello' })
    const nextEvent = stream.next()

    await waitForPendingStreamWaiter(client)

    client.disconnect()

    await expect(nextEvent).rejects.toThrow('Connection closed during agent invocation')
  })
})
