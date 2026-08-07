/**
 * Slack-style multi-agent room helpers (membership, speakers, protocol).
 * Pure functions — safe for unit tests without renderer deps.
 */

import { MAX_AGENT_TURNS_PER_USER_MSG, MAX_ROOM_AGENTS, MAX_ROOM_ROUNDS } from './types'

export { MAX_AGENT_TURNS_PER_USER_MSG, MAX_ROOM_AGENTS, MAX_ROOM_ROUNDS }

/**
 * Normalize legacy copilotId into agentIds (dual-read migration).
 */
export function normalizeSessionAgentIds(session: { agentIds?: string[]; copilotId?: string }): string[] {
  if (session.agentIds && session.agentIds.length > 0) {
    return uniqueIds(session.agentIds)
  }
  if (session.copilotId) {
    return [session.copilotId]
  }
  return []
}

/**
 * Merge room members with newly mentioned agents, preserving order, capped.
 */
export function mergeRoomMembers(existing: string[], mentioned: string[], max = MAX_ROOM_AGENTS): string[] {
  return uniqueIds([...existing, ...mentioned]).slice(0, max)
}

/**
 * Resolve who should speak after a user message.
 * - If mentions this turn: those agents (order preserved)
 * - Else: room members
 */
export function resolveSpeakers(roomAgentIds: string[], mentionedAgentIds?: string[]): string[] {
  if (mentionedAgentIds && mentionedAgentIds.length > 0) {
    return uniqueIds(mentionedAgentIds)
  }
  return uniqueIds(roomAgentIds)
}

/**
 * Dual-write fields for session persistence during rename migration.
 */
export function toSessionAgentFields(agentIds: string[]): {
  agentIds: string[] | undefined
  copilotId: string | undefined
} {
  const ids = uniqueIds(agentIds)
  if (ids.length === 0) {
    return { agentIds: undefined, copilotId: undefined }
  }
  return { agentIds: ids, copilotId: ids[0] }
}

export function buildRoomProtocol(speakerName: string, participantNames: string[]): string {
  const others = participantNames.filter((n) => n !== speakerName)
  const othersList = others.length > 0 ? others.join(', ') : 'none'
  return [
    '## Group chat protocol (Slack-style room)',
    `You are "${speakerName}", one participant in a multi-agent group chat.`,
    `Other participants: ${othersList}. The user is also present and may interrupt anytime.`,
    'Rules:',
    '- Speak only as yourself. Do not role-play other agents or the user.',
    '- Keep replies short and conversational (about 2–6 short paragraphs or tight bullets), like Slack.',
    '- Build on prior points; disagree when useful. Do not write a full report unless asked.',
    '- Do not summarize the whole discussion for everyone unless the user asks.',
  ].join('\n')
}

/**
 * Build ordered speaker turns for a room round (round-robin).
 */
export function buildSpeakerTurnQueue(
  speakers: string[],
  rounds = MAX_ROOM_ROUNDS,
  maxTurns = MAX_AGENT_TURNS_PER_USER_MSG
): string[] {
  if (speakers.length === 0) return []
  if (speakers.length === 1) return [speakers[0]]
  const queue: string[] = []
  for (let r = 0; r < rounds; r++) {
    for (const id of speakers) {
      if (queue.length >= maxTurns) return queue
      queue.push(id)
    }
  }
  return queue
}

function uniqueIds(ids: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}
