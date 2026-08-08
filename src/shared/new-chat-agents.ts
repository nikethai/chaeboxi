/**
 * Pure helpers for blank / new-chat multi-agent selection.
 */

import { MAX_ROOM_AGENTS } from './types'

export { MAX_ROOM_AGENTS }

export function toggleAgentSelection(
  current: string[],
  id: string,
  max = MAX_ROOM_AGENTS
): { next: string[]; rejected?: 'at_cap' } {
  if (!id) return { next: current }
  if (current.includes(id)) {
    return { next: current.filter((x) => x !== id) }
  }
  if (current.length >= max) {
    return { next: current, rejected: 'at_cap' }
  }
  return { next: [...current, id] }
}

export function toSessionAgentFieldsFromSelection(agentIds: string[]): {
  agentIds: string[] | undefined
  copilotId: string | undefined
} {
  const ids = agentIds.filter(Boolean)
  if (ids.length === 0) {
    return { agentIds: undefined, copilotId: undefined }
  }
  return { agentIds: ids, copilotId: ids[0] }
}
