import { atom } from 'jotai'
import type { AgentInfo, ConnectionState, GatewayInfo, SessionInfo } from '@shared/openclaw/gateway/types'

// Re-export shared types for convenience
export type { AgentInfo, ConnectionState, GatewayInfo, SessionInfo }

// ===== OpenClaw Gateway Connection State =====

// UI-specific status that extends ConnectionState with 'error' variant
export type OpenClawGatewayStatus = ConnectionState

export const openclawGatewayStatusAtom = atom<OpenClawGatewayStatus>('disconnected')

// ===== OpenClaw Gateway Info =====

// GatewayInfo from protocol types is used directly
export const openclawGatewayInfoAtom = atom<GatewayInfo | null>(null)

// ===== OpenClaw Agent Info =====

// Uses AgentInfo from protocol types
export const openclawAgentsAtom = atom<AgentInfo[]>([])

export const openclawSelectedAgentIdAtom = atom<string | null>(null)

// ===== OpenClaw Sessions =====

// Extended SessionInfo with UI-specific fields
export interface OpenClawSession extends SessionInfo {
  unreadCount?: number
}

export const openclawSessionsAtom = atom<OpenClawSession[]>([])

export const openclawActiveSessionIdAtom = atom<string | null>(null)
