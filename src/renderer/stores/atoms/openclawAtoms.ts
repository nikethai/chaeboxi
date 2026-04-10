import { atom } from 'jotai'
import type { AgentInfo, ConnectionState, GatewayInfo, SessionInfo } from '@shared/openclaw/gateway/types'

export type { AgentInfo, ConnectionState, GatewayInfo, SessionInfo }

export const openclawGatewayStatusAtom = atom<ConnectionState>('disconnected')

export const openclawGatewayInfoAtom = atom<GatewayInfo | null>(null)

export const openclawAgentsAtom = atom<AgentInfo[]>([])

export const openclawSelectedAgentIdAtom = atom<string | null>(null)

export interface OpenClawSession extends SessionInfo {
  unreadCount?: number
}

export const openclawSessionsAtom = atom<OpenClawSession[]>([])

export const openclawActiveSessionIdAtom = atom<string | null>(null)
