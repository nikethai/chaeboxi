/**
 * Team-room helpers (membership, speakers, discuss/work protocols).
 * Pure functions — safe for unit tests without renderer deps.
 */

import { MERMAID_DIAGRAM_GUIDANCE, MERMAID_DIAGRAM_REMINDER } from './mermaid-diagram-guidance'
import {
  MAX_AGENT_TURNS_PER_USER_MSG,
  MAX_ROOM_AGENTS,
  MAX_ROOM_KEEP_DISCUSS_ROUNDS,
  MAX_ROOM_ROUNDS,
} from './types'

export {
  MAX_AGENT_TURNS_PER_USER_MSG,
  MAX_ROOM_AGENTS,
  MAX_ROOM_KEEP_DISCUSS_ROUNDS,
  MAX_ROOM_ROUNDS,
}

export type RoomMode = 'discuss' | 'work'
export type RoomRole = 'turn' | 'synthesis' | 'plan' | 'do' | 'review' | 'deliver'

/** Roles that may use tools (Work mode lead only). */
export const ROOM_TOOLS_ENABLED_ROLES: readonly RoomRole[] = ['do', 'deliver']

export function roomRoleAllowsTools(roomRole?: RoomRole | string): boolean {
  return roomRole === 'do' || roomRole === 'deliver'
}

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

/** Stance labels for discuss mode (by speaker index). */
export function resolveStanceLabel(speakerIndex: number, speakerCount: number): string {
  if (speakerCount <= 1) return 'Participant'
  if (speakerIndex === 0) return 'Proposer'
  if (speakerCount >= 3 && speakerIndex === speakerCount - 1) return 'Integrator'
  return 'Critic'
}

/** Lead for synthesis / work execute (explicit lead, else first speaker). */
export function resolveRoomLead(speakers: string[], roomLeadId?: string): string | undefined {
  if (speakers.length === 0) return undefined
  if (roomLeadId && speakers.includes(roomLeadId)) return roomLeadId
  return speakers[0]
}

/**
 * Discussion protocol for short multi-agent turns.
 * Round ≥2 requires rebuttal / extension (real debate).
 */
export function buildRoomProtocol(
  speakerName: string,
  participantNames: string[],
  options?: {
    roomRound?: number
    stanceLabel?: string
  }
): string {
  const others = participantNames.filter((n) => n !== speakerName)
  const othersList = others.length > 0 ? others.join(', ') : 'none'
  const round = options?.roomRound ?? 1
  const stance = options?.stanceLabel
  const lines = [
    '## Team discussion protocol',
    `You are "${speakerName}", one teammate in a multi-agent discussion.`,
    stance ? `Your stance this turn: ${stance}.` : '',
    `Other teammates: ${othersList}. The user is present and may interrupt anytime.`,
    `This is discussion round ${round}.`,
    'Rules:',
    '- Speak only as yourself. Do not role-play other agents or the user.',
    '- Reply in helpful markdown. Tools, web search, and function calls are NOT available this turn.',
    '- Always write a non-empty reply (at least 2–4 sentences or tight bullets). Never return blank.',
    '- Do NOT prefix your reply with your name or markdown like **Name:** — the UI already labels you.',
    '- Keep replies short and conversational (about 2–6 short paragraphs or tight bullets).',
    '- Build on prior points; disagree when useful. Prefer claims, trade-offs, and next steps.',
    '- Do NOT write a full final report — the user may request a Team answer later.',
    '- If you sketch a flow or architecture, use a ```mermaid fence (not ASCII / ```text).',
  ]
  if (round >= 2) {
    lines.push(
      '- Round 2+ requirement: explicitly agree, disagree, or extend a prior teammate claim. Do not restate your first turn only.',
      '- If you disagree, say what you would change and why. If you agree, add one concrete refinement.'
    )
  }
  if (stance === 'Critic') {
    lines.push('- As Critic: challenge weak assumptions; steelman the best opposing view before rebutting.')
  }
  if (stance === 'Proposer') {
    lines.push('- As Proposer: put forward a clear position and the top reasons.')
  }
  if (stance === 'Integrator') {
    lines.push('- As Integrator: bridge disagreements and name what still needs deciding.')
  }
  return lines.filter(Boolean).join('\n')
}

/**
 * User-role bridge so multi-agent history does not end on assistant
 * (Gemini/OpenAI require the last prompt message to be user for a reliable completion).
 */
export function buildRoomContinuePrompt(speakerName: string, roomRole: RoomRole = 'turn'): string {
  switch (roomRole) {
    case 'synthesis':
      return `(Your turn as "${speakerName}". Write the complete Team answer for the user now. Markdown OK; ${MERMAID_DIAGRAM_REMINDER} Do not call tools. Never return blank.)`
    case 'plan':
      return `(Your turn as "${speakerName}". Give a short plan or approach for the team task. Markdown OK; ${MERMAID_DIAGRAM_REMINDER} No tools. Never return blank.)`
    case 'do':
      return `(Your turn as "${speakerName}". You are the lead executor. Complete the work using available tools if needed. ${MERMAID_DIAGRAM_REMINDER} Never return blank.)`
    case 'review':
      return `(Your turn as "${speakerName}". Review the lead's work briefly: what works, what to fix. Markdown OK; no tools. Never return blank.)`
    case 'deliver':
      return `(Your turn as "${speakerName}". Produce the final deliverable for the user, incorporating review feedback. ${MERMAID_DIAGRAM_REMINDER} Use tools only if a fix requires them. Never return blank.)`
    default:
      return `(Your turn as "${speakerName}". Continue the team discussion in character. Markdown OK; ${MERMAID_DIAGRAM_REMINDER} Do not call tools. Never return blank.)`
  }
}

/**
 * Protocol for on-demand Team answer after multi-agent discussion.
 */
export function buildSynthesisProtocol(leadName: string, participantNames: string[]): string {
  const others = participantNames.filter((n) => n !== leadName)
  const othersList = others.length > 0 ? others.join(', ') : 'none'
  return [
    '## Team answer protocol (on-demand synthesis)',
    `You are "${leadName}", the lead synthesizer for this team discussion.`,
    `Other participants were: ${othersList}. The user requested a complete Team answer.`,
    'Rules:',
    '- Tools, web search, and function calls are NOT available — answer from the discussion and your knowledge.',
    '- Produce a complete, well-structured answer the user can use and copy. Never return blank.',
    '- Do NOT prefix with your name or **Name:** — the UI already labels you.',
    '- Base the answer on the discussion above. Reconcile agreements; note important disagreements briefly.',
    '- Do not invent consensus that did not appear in the discussion.',
    '- Speak as yourself (the lead), not as a neutral moderator bot.',
    '- Longer, structured output is allowed and expected for this turn only.',
    MERMAID_DIAGRAM_GUIDANCE,
  ].join('\n')
}

export function buildWorkPlanProtocol(speakerName: string, participantNames: string[], leadName: string): string {
  const others = participantNames.filter((n) => n !== speakerName)
  const othersList = others.length > 0 ? others.join(', ') : 'none'
  return [
    '## Team work — plan turn',
    `You are "${speakerName}". Teammates: ${othersList}. Lead executor will be "${leadName}".`,
    'Rules:',
    '- Tools are NOT available this turn.',
    '- Propose a short plan, split of concerns, or constraints for the task (2–6 bullets or short paragraphs).',
    '- Speak only as yourself. Do not write the full deliverable yet.',
    '- Never return blank.',
  ].join('\n')
}

export function buildWorkDoProtocol(leadName: string, participantNames: string[]): string {
  const others = participantNames.filter((n) => n !== leadName)
  const othersList = others.length > 0 ? others.join(', ') : 'none'
  return [
    '## Team work — execute turn (lead)',
    `You are "${leadName}", the lead executor for this team task.`,
    `Collaborators who planned: ${othersList}.`,
    'Rules:',
    '- You may use tools, web search, and function calls when needed to complete the work.',
    '- Follow the plan discussion above. Produce real progress / artifacts the user can use.',
    '- Do not prefix with your name. Never return blank.',
    '- Peers will review after you; leave the work in a reviewable state.',
    MERMAID_DIAGRAM_GUIDANCE,
  ].join('\n')
}

export function buildWorkReviewProtocol(speakerName: string, leadName: string): string {
  return [
    '## Team work — review turn',
    `You are "${speakerName}" reviewing lead "${leadName}"'s work.`,
    'Rules:',
    '- Tools are NOT available. Critique briefly: strengths, issues, concrete fixes.',
    '- Do not rewrite the entire deliverable. Never return blank.',
  ].join('\n')
}

export function buildWorkDeliverProtocol(leadName: string): string {
  return [
    '## Team work — deliver turn (lead)',
    `You are "${leadName}". Incorporate peer review and produce the final deliverable for the user.`,
    'Rules:',
    '- Use tools only if a fix requires them.',
    '- Deliver complete, usable output. Do not prefix with your name. Never return blank.',
    MERMAID_DIAGRAM_GUIDANCE,
  ].join('\n')
}

/** Protocol block for a given room role (used by generation). */
export function buildProtocolForRoomRole(
  roomRole: RoomRole,
  speakerName: string,
  participantNames: string[],
  options?: {
    roomRound?: number
    stanceLabel?: string
    leadName?: string
  }
): string {
  const leadName = options?.leadName ?? participantNames[0] ?? speakerName
  switch (roomRole) {
    case 'synthesis':
      return buildSynthesisProtocol(speakerName, participantNames)
    case 'plan':
      return buildWorkPlanProtocol(speakerName, participantNames, leadName)
    case 'do':
      return buildWorkDoProtocol(speakerName, participantNames)
    case 'review':
      return buildWorkReviewProtocol(speakerName, leadName)
    case 'deliver':
      return buildWorkDeliverProtocol(speakerName)
    default:
      return buildRoomProtocol(speakerName, participantNames, {
        roomRound: options?.roomRound,
        stanceLabel: options?.stanceLabel,
      })
  }
}

/** First speaker in order is the default synthesis lead (first @ mention / room order). */
export function resolveSynthesisLead(speakers: string[], roomLeadId?: string): string | undefined {
  return speakers.length >= 2 ? resolveRoomLead(speakers, roomLeadId) : undefined
}

/**
 * Whether synthesis / Team answer may run.
 * Discuss path requires explicit user request (no auto Final).
 */
export function shouldRunSynthesis(params: {
  speakerCount: number
  completedDiscussionTurns: number
  interrupted: boolean
  /** On-demand Team answer; default false (no auto synthesis). */
  requested?: boolean
}): boolean {
  return (
    params.requested === true &&
    params.speakerCount >= 2 &&
    params.completedDiscussionTurns > 0 &&
    !params.interrupted
  )
}

/** Whether another discuss round can run after the default rounds. */
export function canKeepDiscussing(roundsCompleted: number, max = MAX_ROOM_KEEP_DISCUSS_ROUNDS): boolean {
  return roundsCompleted < max
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

/**
 * Map queue index → 1-based discussion round given speaker count.
 */
export function roundForQueueIndex(queueIndex: number, speakerCount: number): number {
  if (speakerCount <= 0) return 1
  return Math.floor(queueIndex / speakerCount) + 1
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
