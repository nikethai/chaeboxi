/**
 * Resolve agent persona display meta (name + avatar) for room UI and generation labels.
 * Covers built-in, local custom, and remote catalog agents (same sources as @ picker).
 */

import type { AgentRole, AgentStance, CopilotDetail } from '@shared/types'
import { getDefaultStore } from 'jotai'
import { getBuiltInCopilotById, myCopilotsAtom } from '@/hooks/useCopilots'
import queryClient from '@/stores/queryClient'
import {
  agentAvatarAccent,
  resolveAgentAvatar,
  type ResolvedAgentAvatar,
} from './agent-avatar'

export type AgentMeta = {
  id: string
  name: string
  emojiAvatar?: string
  picUrl?: string
  avatarKey?: string
  role?: AgentRole
  stance?: AgentStance
  description?: string
  avatarSeed?: string
  /** Resolved image for UI (blob / url / procedural). */
  avatar: ResolvedAgentAvatar
  accent: string
  /** True when id was not found in built-in / local / remote catalogs. */
  isFallback?: boolean
}

/**
 * Full agent detail for prompts/settings. Returns null only when completely unknown.
 */
export function getAgentDetailById(id: string | undefined | null): CopilotDetail | null {
  if (!id) return null

  const builtin = getBuiltInCopilotById(id)
  if (builtin) {
    // Merge local overrides (starred, avatar, etc.) over built-in defaults
    try {
      const stored = getDefaultStore().get(myCopilotsAtom)
      const list = Array.isArray(stored) ? stored : []
      const override = list.find((c) => c.id === id)
      if (override) {
        return { ...builtin, ...override, builtIn: true, prompt: override.prompt || builtin.prompt }
      }
    } catch {
      // jotai store unavailable
    }
    return builtin
  }

  try {
    const stored = getDefaultStore().get(myCopilotsAtom)
    const list = Array.isArray(stored) ? stored : []
    const found = list.find((c) => c.id === id)
    if (found) return found
  } catch {
    // jotai store unavailable (tests / early boot)
  }

  // Remote catalog (Chatbox shared agents) — same list as @ picker / AgentRoomStrip
  try {
    const remoteEntries = queryClient.getQueriesData<CopilotDetail[]>({ queryKey: ['remote-copilots'] })
    for (const [, data] of remoteEntries) {
      if (!Array.isArray(data)) continue
      const found = data.find((c) => c.id === id)
      if (found) return found
    }
  } catch {
    // query client unavailable
  }

  return null
}

/**
 * Look up built-in, local, then remote agents.
 * Falls back to a stable display meta so multi-agent turns never skip an id silently.
 */
export function resolveAgentMeta(id: string | undefined | null): AgentMeta | null {
  if (!id) return null

  const detail = getAgentDetailById(id)
  if (detail) {
    const avatar =
      resolveAgentAvatar(detail) ||
      resolveAgentAvatar({ id: detail.id, role: detail.role, avatarSeed: detail.avatarSeed })!
    return {
      id: detail.id,
      name: detail.name,
      emojiAvatar: detail.emojiAvatar,
      picUrl: detail.picUrl,
      avatarKey: detail.avatarKey,
      role: detail.role,
      stance: detail.stance,
      description: detail.description,
      avatarSeed: detail.avatarSeed,
      avatar,
      accent: avatar.kind === 'procedural' ? avatar.accent : agentAvatarAccent(detail.id, detail.avatarSeed),
      isFallback: false,
    }
  }

  // Unknown id (stale chip / race): still return meta so room orchestration does not skip the speaker.
  const avatar = resolveAgentAvatar({ id, role: 'custom' })!
  return {
    id,
    name: humanizeAgentId(id),
    avatar,
    accent: avatar.kind === 'procedural' ? avatar.accent : agentAvatarAccent(id),
    isFallback: true,
  }
}

function humanizeAgentId(id: string): string {
  const tail = id.includes(':') ? id.split(':').pop() || id : id
  // Skip raw UUIDs / opaque hashes — they look like "Aic0 En" and confuse users
  if (/^[0-9a-f]{8,}$/i.test(tail.replace(/[-_]/g, ''))) {
    return 'Agent'
  }
  const spaced = tail.replace(/[-_]+/g, ' ').trim()
  if (!spaced || spaced.length > 40) return 'Agent'
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Stable muted accent for multi-agent speaker chrome (CSS color string). */
export function agentAccentColor(agentId: string): string {
  return agentAvatarAccent(agentId)
}
