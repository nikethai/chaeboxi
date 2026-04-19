import { afterEach, describe, expect, it, vi } from 'vitest'
import { OpenClawGatewayClient, analyzeGatewayUrl, isLocalhostUrl, normalizeGatewayUrl, wsToHttpUrl } from './client'
import { classifyCapabilityRisk, getCapabilityRiskColor, getCapabilityTooltip } from './capabilities'

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

  it('sends the current agent payload shape expected by the gateway', async () => {
    const client = new OpenClawGatewayClient('http://127.0.0.1:18789')

    ;(client as unknown as { ws: { readyState: number; close: () => void; send: () => void }; state: string }).ws = {
      readyState: 1,
      close: vi.fn(),
      send: vi.fn(),
    }
    ;(client as unknown as { state: string }).state = 'connected'

    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('11111111-1111-1111-1111-111111111111')
    const requestSpy = vi.spyOn(client, 'request').mockResolvedValue({
      runId: 'server-run-id',
    })

    const stream = client.invokeAgent(
      'pi-agent',
      { role: 'user', content: 'hello' },
      {
        sessionKey: 'chaeboxi:session-1',
      }
    )
    const nextEvent = stream.next()

    await waitForPendingStreamWaiter(client)

    expect(requestSpy).toHaveBeenCalledWith('agent', {
      agentId: 'pi-agent',
      message: 'hello',
      sessionId: undefined,
      sessionKey: 'chaeboxi:session-1',
      extraSystemPrompt: undefined,
      idempotencyKey: '11111111-1111-1111-1111-111111111111',
    })

    client.disconnect()
    await expect(nextEvent).rejects.toThrow('Connection closed during agent invocation')
  })

  it('rejects a pending agent stream waiter when disconnect closes the connection', async () => {
    const client = new OpenClawGatewayClient('http://127.0.0.1:18789')

    ;(client as unknown as { ws: { readyState: number; close: () => void; send: () => void }; state: string }).ws = {
      readyState: 1,
      close: vi.fn(),
      send: vi.fn(),
    }
    ;(client as unknown as { state: string }).state = 'connected'

    vi.spyOn(client, 'request').mockResolvedValue({ runId: 'server-run-id' })

    const stream = client.invokeAgent('pi-agent', { role: 'user', content: 'hello' })
    const nextEvent = stream.next()

    await waitForPendingStreamWaiter(client)

    client.disconnect()

    await expect(nextEvent).rejects.toThrow('Connection closed during agent invocation')
  })

  it('routes stream events using the run id returned by the gateway', async () => {
    const client = new OpenClawGatewayClient('http://127.0.0.1:18789')

    ;(client as unknown as { ws: { readyState: number; close: () => void; send: () => void }; state: string }).ws = {
      readyState: 1,
      close: vi.fn(),
      send: vi.fn(),
    }
    ;(client as unknown as { state: string }).state = 'connected'

    vi.spyOn(client, 'request').mockResolvedValue({ runId: 'server-run-id' })

    const stream = client.invokeAgent('pi-agent', { role: 'user', content: 'hello' })
    const nextEventPromise = stream.next()

    await waitForPendingStreamWaiter(client)

    const handlers = (client as unknown as { eventHandlers: Array<(event: string, data: unknown) => void> }).eventHandlers
    handlers[0]?.('agent', {
      stream: 'assistant',
      runId: 'server-run-id',
      data: {
        delta: 'hello back',
      },
    })

    await expect(nextEventPromise).resolves.toMatchObject({
      done: false,
      value: {
        type: 'chunk',
        invocationId: 'server-run-id',
        runId: 'server-run-id',
        delta: 'hello back',
      },
    })
  })

  it('normalizes legacy invocationId events for backward compatibility', async () => {
    const client = new OpenClawGatewayClient('http://127.0.0.1:18789')

    ;(client as unknown as { ws: { readyState: number; close: () => void; send: () => void }; state: string }).ws = {
      readyState: 1,
      close: vi.fn(),
      send: vi.fn(),
    }
    ;(client as unknown as { state: string }).state = 'connected'

    vi.spyOn(client, 'request').mockResolvedValue({ status: 'accepted', invocationId: 'legacy-invocation-id' })

    const stream = client.invokeAgent('pi-agent', { role: 'user', content: 'hello' })
    const nextEventPromise = stream.next()

    await waitForPendingStreamWaiter(client)

    const handlers = (client as unknown as { eventHandlers: Array<(event: string, data: unknown) => void> }).eventHandlers
    handlers[0]?.('agent', {
      type: 'chunk',
      invocationId: 'legacy-invocation-id',
      delta: 'hello back',
    })

    await expect(nextEventPromise).resolves.toMatchObject({
      done: false,
      value: {
        type: 'chunk',
        invocationId: 'legacy-invocation-id',
        runId: 'legacy-invocation-id',
        delta: 'hello back',
      },
    })
  })

  it('accepts tool events forwarded on session.tool', async () => {
    const client = new OpenClawGatewayClient('http://127.0.0.1:18789')

    ;(client as unknown as { ws: { readyState: number; close: () => void; send: () => void }; state: string }).ws = {
      readyState: 1,
      close: vi.fn(),
      send: vi.fn(),
    }
    ;(client as unknown as { state: string }).state = 'connected'

    vi.spyOn(client, 'request').mockResolvedValue({ runId: 'server-run-id' })

    const stream = client.invokeAgent('pi-agent', { role: 'user', content: 'hello' })
    const nextEventPromise = stream.next()

    await waitForPendingStreamWaiter(client)

    const handlers = (client as unknown as { eventHandlers: Array<(event: string, data: unknown) => void> }).eventHandlers
    handlers[0]?.('session.tool', {
      type: 'tool',
      runId: 'server-run-id',
      tool: 'read_file',
      input: {
        path: '/tmp/demo.txt',
      },
    })

    await expect(nextEventPromise).resolves.toMatchObject({
      done: false,
      value: {
        type: 'tool',
        invocationId: 'server-run-id',
        runId: 'server-run-id',
        tool: 'read_file',
        input: {
          path: '/tmp/demo.txt',
        },
      },
    })
  })
})

describe('wsToHttpUrl', () => {
  it('converts ws:// to http://', () => {
    expect(wsToHttpUrl('ws://example.com:18789')).toBe('http://example.com:18789')
  })

  it('converts wss:// to https://', () => {
    expect(wsToHttpUrl('wss://example.com:18789')).toBe('https://example.com:18789')
  })

  it('passes through other protocols', () => {
    expect(wsToHttpUrl('http://example.com')).toBe('http://example.com')
  })
})

describe('isLocalhostUrl', () => {
  it('returns true for localhost', () => {
    expect(isLocalhostUrl('http://localhost:18789')).toBe(true)
  })

  it('returns true for 127.0.0.1', () => {
    expect(isLocalhostUrl('http://127.0.0.1:18789')).toBe(true)
  })

  it('returns true for [::1]', () => {
    expect(isLocalhostUrl('http://[::1]:18789')).toBe(true)
  })

  it('returns false for remote hosts', () => {
    expect(isLocalhostUrl('http://gateway.example.com:18789')).toBe(false)
  })

  it('returns false for invalid URLs', () => {
    expect(isLocalhostUrl('not-a-url')).toBe(false)
  })
})

describe('analyzeGatewayUrl', () => {
  it('returns safe for localhost', () => {
    const result = analyzeGatewayUrl('http://127.0.0.1:18789')
    expect(result.securityLevel).toBe('safe')
    expect(result.isLocalhost).toBe(true)
    expect(result.isSecure).toBe(true)
  })

  it('returns warning for remote wss', () => {
    const result = analyzeGatewayUrl('https://gateway.example.com:18789')
    expect(result.securityLevel).toBe('warning')
    expect(result.isLocalhost).toBe(false)
    expect(result.isSecure).toBe(true)
    expect(result.warning).toBeDefined()
  })

  it('returns danger for remote ws', () => {
    const result = analyzeGatewayUrl('http://gateway.example.com:18789')
    expect(result.securityLevel).toBe('danger')
    expect(result.isLocalhost).toBe(false)
    expect(result.isSecure).toBe(false)
    expect(result.warning).toContain('Plaintext')
  })
})

describe('normalizeGatewayUrl', () => {
  it('converts http to ws', () => {
    expect(normalizeGatewayUrl('http://localhost:18789')).toBe('ws://localhost:18789')
  })

  it('preserves implicit 443 for remote https endpoints', () => {
    expect(normalizeGatewayUrl('https://gateway.example.com')).toBe('wss://gateway.example.com')
  })

  it('converts https to wss', () => {
    expect(normalizeGatewayUrl('https://example.com:18789')).toBe('wss://example.com:18789')
  })

  it('adds default port when missing', () => {
    expect(normalizeGatewayUrl('http://localhost')).toBe('ws://localhost:18789')
  })

  it('passes through ws:// URLs unchanged', () => {
    expect(normalizeGatewayUrl('ws://example.com:9999')).toBe('ws://example.com:9999')
  })
})

describe('classifyCapabilityRisk', () => {
  it('classifies shell as dangerous', () => {
    expect(classifyCapabilityRisk('shell')).toBe('dangerous')
    expect(classifyCapabilityRisk('exec')).toBe('dangerous')
    expect(classifyCapabilityRisk('SHELL')).toBe('dangerous')
  })

  it('classifies tool_use as moderate', () => {
    expect(classifyCapabilityRisk('tool_use')).toBe('moderate')
    expect(classifyCapabilityRisk('file_read')).toBe('moderate')
  })

  it('classifies vision as safe', () => {
    expect(classifyCapabilityRisk('vision')).toBe('safe')
    expect(classifyCapabilityRisk('reasoning')).toBe('safe')
  })
})

describe('getCapabilityRiskColor', () => {
  it('returns correct colors', () => {
    expect(getCapabilityRiskColor('dangerous')).toBe('red')
    expect(getCapabilityRiskColor('moderate')).toBe('yellow')
    expect(getCapabilityRiskColor('safe')).toBe('chatbox-brand')
  })
})

describe('getCapabilityTooltip', () => {
  it('returns tooltip for dangerous capabilities', () => {
    const tooltip = getCapabilityTooltip('shell', 'dangerous')
    expect(tooltip).toContain('system-level')
  })

  it('returns tooltip for moderate capabilities', () => {
    const tooltip = getCapabilityTooltip('tool_use', 'moderate')
    expect(tooltip).toContain('tool access')
  })

  it('returns undefined for safe capabilities', () => {
    expect(getCapabilityTooltip('vision', 'safe')).toBeUndefined()
  })
})
