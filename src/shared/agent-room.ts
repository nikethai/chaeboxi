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
    '- Reply with plain helpful text only. Tools, web search, and function calls are NOT available this turn.',
    '- Always write a non-empty reply (at least 2–4 sentences or tight bullets). Never return blank.',
    '- Do NOT prefix your reply with your name or markdown like **Name:** — the UI already labels you.',
    '- Keep replies short and conversational (about 2–6 short paragraphs or tight bullets), like Slack.',
    '- Build on prior points; disagree when useful.',
    '- Do NOT write the full final report — a synthesis turn will follow after discussion.',
  ].join('\n')
}

/**
 * User-role bridge so multi-agent history does not end on assistant
 * (Gemini/OpenAI require the last prompt message to be user for a reliable completion).
 */
export function buildRoomContinuePrompt(speakerName: string, roomRole: 'turn' | 'synthesis' = 'turn'): string {
  if (roomRole === 'synthesis') {
    return `(Your turn as "${speakerName}". Write the complete Final answer for the user now. Plain text only; do not call tools. Never return blank.)`
  }
  return `(Your turn as "${speakerName}". Continue the multi-agent discussion in character. Plain text only; do not call tools. Never return blank.)`
}

/**
 * Protocol for the final council answer after multi-agent discussion.
 * Lead agent (typically first mentioned) produces the full user-facing answer.
 */
export function buildSynthesisProtocol(leadName: string, participantNames: string[]): string {
  const others = participantNames.filter((n) => n !== leadName)
  const othersList = others.length > 0 ? others.join(', ') : 'none'
  return [
    '## Final answer protocol (council synthesis)',
    `You are "${leadName}", the lead synthesizer for this multi-agent discussion.`,
    `Other participants were: ${othersList}. The user is waiting for a complete answer.`,
    'Rules:',
    '- Tools, web search, and function calls are NOT available — answer from the discussion and your knowledge.',
    '- Produce a complete, well-structured final answer the user can use and copy. Never return blank.',
    '- Do NOT prefix with your name or **Name:** — the UI already labels you.',
    '- Base the answer on the discussion above. Reconcile agreements; note important disagreements briefly.',
    '- Do not invent consensus that did not appear in the discussion.',
    '- Speak as yourself (the lead), not as a neutral moderator bot.',
    '- Longer, structured output is allowed and expected for this turn only.',
  ].join('\n')
}

/** First speaker in order is the synthesis lead (first @ mention / room order). */
export function resolveSynthesisLead(speakers: string[]): string | undefined {
  return speakers.length >= 2 ? speakers[0] : undefined
}

/** Whether a completed multi-agent room should append a synthesis turn. */
export function shouldRunSynthesis(params: {
  speakerCount: number
  completedDiscussionTurns: number
  interrupted: boolean
}): boolean {
  return params.speakerCount >= 2 && params.completedDiscussionTurns > 0 && !params.interrupted
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
