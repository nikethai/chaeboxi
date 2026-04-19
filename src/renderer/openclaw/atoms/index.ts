import { atom, getDefaultStore } from 'jotai'
import type { AgentInfo, ConnectionState, GatewayInfo, SessionInfo } from '@shared/openclaw/gateway/types'
import { evictGatewayClient, getOrCreateGatewayClient } from '@shared/models/openclaw'
import type { GatewayClientCreateOptions } from '@shared/models/openclaw'
import { settingsStore, useSettingsStore } from '@/stores/settingsStore'
import { useCallback, useEffect, useMemo } from 'react'

export type { AgentInfo, ConnectionState, GatewayInfo, SessionInfo }

export const openclawGatewayStatusAtom = atom<ConnectionState>('disconnected')

export const openclawGatewayInfoAtom = atom<GatewayInfo | null>(null)

export const openclawAgentsAtom = atom<AgentInfo[]>([])

export const openclawSelectedAgentIdAtom = atom<string | null>(null)

export interface OpenClawSession extends SessionInfo {
  unreadCount?: number
  messageCount?: number
}

export const openclawSessionsAtom = atom<OpenClawSession[]>([])

export const openclawActiveSessionIdAtom = atom<string | null>(null)

// ─────────────────────────────────────────────────────────────────────────────
// Jotai store reference for setting atom values outside React tree
// ─────────────────────────────────────────────────────────────────────────────

const jotaiStore = getDefaultStore()

// ─────────────────────────────────────────────────────────────────────────────
// Gateway connection manager — singleton per active gateway config
// ─────────────────────────────────────────────────────────────────────────────

let _currentOptsKey = ''
let _currentClientOpts: GatewayClientCreateOptions | null = null

/** Reuse the same cache-key format as the shared model layer */
function buildGatewayCacheKey(opts: GatewayClientCreateOptions): string {
  return `${opts.apiHost}:${opts.apiKey}:${opts.cloudflareClientId}:${opts.cloudflareClientSecret}`
}

function getActiveGatewayOpts(): GatewayClientCreateOptions {
  const openclawSettings = settingsStore.getState().openclaw
  const providerSettings = settingsStore.getState().providers?.openclaw
  const activeGateway = openclawSettings?.gateways?.find((g) => g.isDefault) || openclawSettings?.gateways?.[0]
  return {
    apiHost: activeGateway?.url || providerSettings?.apiHost || 'http://127.0.0.1:18789',
    apiKey: activeGateway?.token || providerSettings?.apiKey || '',
    cloudflareClientId: activeGateway?.cloudflareClientId || providerSettings?.cloudflareClientId || '',
    cloudflareClientSecret: activeGateway?.cloudflareClientSecret || providerSettings?.cloudflareClientSecret || '',
  }
}

/**
 * Ensure the gateway is connected and sync connection state to atoms.
 * Safe to call concurrently — returns existing promise if already connecting.
 */
export function ensureGatewayConnected(): Promise<void> {
  const opts = getActiveGatewayOpts()
  const optsKey = buildGatewayCacheKey(opts)

  // Already connected with the same options — just update atom and return
  if (_currentClientOpts && _currentClientOpts.apiHost === opts.apiHost && _currentClientOpts.apiKey === opts.apiKey && _currentClientOpts.cloudflareClientId === opts.cloudflareClientId && _currentClientOpts.cloudflareClientSecret === opts.cloudflareClientSecret) {
    const existingClient = getOrCreateGatewayClient(opts)
    if (existingClient.connected) {
      jotaiStore.set(openclawGatewayStatusAtom, 'connected')
      return Promise.resolve()
    }
  }

  // Options changed — evict old client (properly disconnects and removes from shared cache)
  if (_currentClientOpts && optsKey !== buildGatewayCacheKey(_currentClientOpts)) {
    evictGatewayClient(_currentClientOpts)
    _currentClientOpts = null
    jotaiStore.set(openclawGatewayStatusAtom, 'disconnected')
    jotaiStore.set(openclawGatewayInfoAtom, null)
    jotaiStore.set(openclawAgentsAtom, [])
    jotaiStore.set(openclawSessionsAtom, [])
  }

  _currentClientOpts = opts
  jotaiStore.set(openclawGatewayStatusAtom, 'connecting')

  const client = getOrCreateGatewayClient(opts)

  return client
    .connect()
    .then(() => {
      jotaiStore.set(openclawGatewayStatusAtom, 'connected')
      const info = client.getGatewayInfo()
      if (info) {
        jotaiStore.set(openclawGatewayInfoAtom, info)
      }
      return refreshAgentsAndSessions()
    })
    .catch(() => {
      jotaiStore.set(openclawGatewayStatusAtom, 'error')
    })
}

async function refreshAgentsAndSessions(): Promise<void> {
  if (!_currentClientOpts) return
  const client = getOrCreateGatewayClient(_currentClientOpts)
  if (!client.connected) return
  try {
    const [agentsResponse, sessionsResponse] = await Promise.all([
      client.listAgents(),
      client.listSessions(),
    ])
    jotaiStore.set(openclawAgentsAtom, agentsResponse.agents)
    jotaiStore.set(
      openclawSessionsAtom,
      sessionsResponse.sessions.map((s) => ({ ...s, messageCount: 0 }))
    )
  } catch (err) {
    console.warn('[OpenClaw] Failed to refresh agents/sessions:', err)
  }
}

/**
 * Bridge the gateway client to Jotai atoms.
 *
 * - Keeps `openclawGatewayStatusAtom` / `openclawGatewayInfoAtom` in sync
 *   with the actual gateway connection state.
 * - When connected, fetches agents and sessions into their atoms.
 *
 * Call this once per component that needs gateway data. Idempotent —
 * concurrent calls share the same connection.
 */
export function useGatewaySync(): {
  ensureConnected: () => Promise<void>
  gatewayKey: string
} {
  const openclawSettings = useSettingsStore((s) => s.openclaw)
  const providerSettings = useSettingsStore((s) => s.providers?.openclaw)

  const opts = useMemo<GatewayClientCreateOptions>(() => {
    const activeGateway = openclawSettings?.gateways?.find((g) => g.isDefault) || openclawSettings?.gateways?.[0]
    return {
      apiHost: activeGateway?.url || providerSettings?.apiHost || 'http://127.0.0.1:18789',
      apiKey: activeGateway?.token || providerSettings?.apiKey || '',
      cloudflareClientId: activeGateway?.cloudflareClientId || providerSettings?.cloudflareClientId || '',
      cloudflareClientSecret: activeGateway?.cloudflareClientSecret || providerSettings?.cloudflareClientSecret || '',
    }
  }, [openclawSettings, providerSettings])

  // Full options key — used as dep so any credential change triggers reset
  const gatewayKey = useMemo(() => buildGatewayCacheKey(opts), [opts])

  // Detect gateway config changes and reset atoms so components reconnect
  useEffect(() => {
    if (gatewayKey !== _currentOptsKey) {
      _currentOptsKey = gatewayKey
      // Reset atoms — they'll be repopulated on next ensureGatewayConnected call
      jotaiStore.set(openclawGatewayStatusAtom, 'disconnected')
      jotaiStore.set(openclawGatewayInfoAtom, null)
      jotaiStore.set(openclawAgentsAtom, [])
      jotaiStore.set(openclawSessionsAtom, [])
    }
  }, [gatewayKey])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ensureConnected = useCallback(ensureGatewayConnected, [])

  // Automatically connect on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void ensureGatewayConnected()
    // ensureGatewayConnected is module-level and stable
  }, [])

  return { ensureConnected, gatewayKey }
}
