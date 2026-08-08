/**
 * Multi-agent room orchestrator (council hybrid).
 * Sequential short discussion turns, then one synthesis final answer from the lead (first speaker).
 * Interruptible via message cancel / new user send.
 */

import {
  buildSpeakerTurnQueue,
  mergeRoomMembers,
  normalizeSessionAgentIds,
  resolveSpeakers,
  resolveSynthesisLead,
  shouldRunSynthesis,
  toSessionAgentFields,
} from '@shared/agent-room'
import { createMessage, type Message } from '@shared/types'
import { getMessageText } from '@shared/utils/message'
import { type AgentMeta, resolveAgentMeta } from '@/packages/agents'
import * as chatStore from '../chatStore'
import * as scrollActions from '../scrollActions'
import { generate } from './generation'
import { messageQueueStore } from './messageQueue'
import { insertMessage, modifyMessage, submitNewUserMessage } from './messages'

export type RoomAgentMeta = AgentMeta

export { resolveAgentMeta }

/**
 * Jump chat viewport to the latest message.
 * Virtuoso `followOutput` only works while already at bottom; multi-agent discussion
 * often leaves the user mid-list, so Final answer needs an explicit scroll.
 */
function scrollChatToLatest(behavior: 'auto' | 'smooth' = 'smooth') {
  const run = () => scrollActions.scrollToBottom(behavior)
  // Immediate + delayed passes so Virtuoso has mounted the new row / grown height
  requestAnimationFrame(run)
  setTimeout(run, 80)
  setTimeout(run, 320)
}

/**
 * Update session room membership from mentions; dual-write copilotId.
 * Returns the new agentIds list.
 */
export async function applyRoomMembership(sessionId: string, mentionedAgentIds?: string[]): Promise<string[]> {
  const session = await chatStore.getSession(sessionId)
  if (!session) return []

  const existing = normalizeSessionAgentIds(session)
  const merged = mergeRoomMembers(existing, mentionedAgentIds ?? [])
  const fields = toSessionAgentFields(merged)
  await chatStore.updateSession(sessionId, {
    agentIds: fields.agentIds,
    copilotId: fields.copilotId,
  })
  return merged
}

function messageHasUsableText(msg: Message | undefined): boolean {
  if (!msg) return false
  if (msg.error || msg.errorCode) return false
  return getMessageText(msg, true, true).trim().length > 0
}

async function generateSpeakerTurn(
  sessionId: string,
  params: {
    meta: AgentMeta
    roomRole: 'turn' | 'synthesis'
    participantNames: string[]
    truncateTokenLimit?: number
    skipQueuedMessages: boolean
  }
): Promise<{ msg: Message; interrupted: boolean }> {
  const assistantMsg: Message = {
    ...createMessage('assistant', ''),
    generating: true,
    agentId: params.meta.id,
    name: params.meta.name,
    roomRole: params.roomRole,
  }
  await insertMessage(sessionId, assistantMsg)

  // Final answer: jump to the new bubble as soon as it appears (before stream)
  if (params.roomRole === 'synthesis') {
    scrollChatToLatest('smooth')
  }

  // Always skip the message queue during room turns; process it only after synthesis succeeds.
  const runOnce = async () => {
    await generate(sessionId, assistantMsg, {
      operationType: 'send_message',
      truncateTokenLimit: params.truncateTokenLimit,
      speakerAgentId: params.meta.id,
      roomMulti: true,
      roomRole: params.roomRole,
      participantNames: params.participantNames,
      skipQueuedMessages: true,
    })
  }

  await runOnce()

  let after = await chatStore.getSession(sessionId)
  let justGenerated = after?.messages.find((m) => m.id === assistantMsg.id)

  // One retry when the provider returns an empty body (rate limit / flaky stream)
  if (justGenerated && !justGenerated.cancel && !messageHasUsableText(justGenerated) && !justGenerated.error) {
    await modifyMessage(sessionId, {
      ...justGenerated,
      generating: true,
      contentParts: [],
      error: undefined,
      errorCode: undefined,
    })
    await runOnce()
    after = await chatStore.getSession(sessionId)
    justGenerated = after?.messages.find((m) => m.id === assistantMsg.id)
  }

  // Still empty — surface a soft placeholder so the turn is not a blank shell
  if (justGenerated && !messageHasUsableText(justGenerated) && !justGenerated.error && !justGenerated.cancel) {
    const placeholder =
      params.roomRole === 'synthesis'
        ? '_Synthesis returned no content. Try sending again or re-@ the agents._'
        : `_${params.meta.name} did not return content for this turn._`
    await modifyMessage(sessionId, {
      ...justGenerated,
      generating: false,
      contentParts: [{ type: 'text', text: placeholder }],
    })
  }

  after = await chatStore.getSession(sessionId)
  justGenerated = after?.messages.find((m) => m.id === assistantMsg.id) ?? assistantMsg
  const latest = after?.messages[after.messages.length - 1]
  const interrupted = Boolean(justGenerated.cancel || latest?.role === 'user')

  // Final answer finished (or placeholder): ensure viewport ends on the latest message
  if (params.roomRole === 'synthesis' && !interrupted) {
    scrollChatToLatest('smooth')
  }

  // Process any queued user messages after the final synthesis turn
  if (!params.skipQueuedMessages && !interrupted) {
    while (messageQueueStore.getState().getQueuedCount(sessionId) > 0) {
      const nextQueuedMessage = messageQueueStore.getState().dequeueMessage(sessionId)
      if (!nextQueuedMessage) break
      await submitNewUserMessage(sessionId, {
        newUserMsg: nextQueuedMessage.message,
        needGenerating: nextQueuedMessage.needGenerating,
      })
      if (nextQueuedMessage.needGenerating) break
    }
  }

  return { msg: justGenerated, interrupted }
}

/**
 * Run multi-agent sequential discussion after a user message, then optional synthesis.
 * Caller must already have inserted the user message.
 * Does not insert a pre-created assistant message — creates one per speaker turn (+ synthesis).
 */
export async function runAgentRoomDiscussion(
  sessionId: string,
  params: {
    mentionedAgentIds?: string[]
    truncateTokenLimit?: number
  }
): Promise<void> {
  const roomIds = await applyRoomMembership(sessionId, params.mentionedAgentIds)
  const speakers = resolveSpeakers(roomIds, params.mentionedAgentIds)

  if (speakers.length === 0) {
    return
  }

  // Single speaker: let normal path handle (caller should use generate with one assistant)
  if (speakers.length === 1) {
    return
  }

  // Prefer resolved names; fall back so every speaker id still appears in protocol text.
  const participantNames = speakers.map((id) => resolveAgentMeta(id)?.name ?? id)
  // One full pass over all speakers (rounds × speakers), always including every tagged agent.
  const queue = buildSpeakerTurnQueue(speakers)

  let completedDiscussionTurns = 0
  let interrupted = false

  for (let i = 0; i < queue.length; i++) {
    const agentId = queue[i]
    const meta =
      resolveAgentMeta(agentId) ??
      ({
        id: agentId,
        name: agentId,
        emojiAvatar: '🤖',
      } satisfies AgentMeta)

    const session = await chatStore.getSession(sessionId)
    if (!session) return

    const lastMsg = session.messages[session.messages.length - 1]
    // User sent a new message mid-room → stop remaining discussion + synthesis.
    if (lastMsg?.role === 'user' && i > 0) {
      interrupted = true
      break
    }
    // Another assistant still streaming (should not happen in sequential mode) → stop.
    if (lastMsg?.role === 'assistant' && lastMsg.generating && lastMsg.agentId && lastMsg.agentId !== agentId) {
      interrupted = true
      break
    }

    const { interrupted: turnInterrupted } = await generateSpeakerTurn(sessionId, {
      meta,
      roomRole: 'turn',
      participantNames,
      truncateTokenLimit: params.truncateTokenLimit,
      skipQueuedMessages: true,
    })

    completedDiscussionTurns += 1
    if (turnInterrupted) {
      interrupted = true
      break
    }
  }

  if (
    !shouldRunSynthesis({
      speakerCount: speakers.length,
      completedDiscussionTurns,
      interrupted,
    })
  ) {
    return
  }

  const leadId = resolveSynthesisLead(speakers)
  const leadMeta = leadId ? resolveAgentMeta(leadId) : null
  if (!leadMeta) return

  // Bail if user already interrupted between last turn and synthesis
  const beforeSynth = await chatStore.getSession(sessionId)
  if (!beforeSynth) return
  const tail = beforeSynth.messages[beforeSynth.messages.length - 1]
  if (tail?.role === 'user') return

  await generateSpeakerTurn(sessionId, {
    meta: leadMeta,
    roomRole: 'synthesis',
    participantNames,
    truncateTokenLimit: params.truncateTokenLimit,
    skipQueuedMessages: false,
  })
}

/**
 * Whether the submit path should use room multi-agent orchestration.
 */
export function shouldRunMultiAgentRoom(mentionedAgentIds: string[] | undefined, roomAgentIds: string[]): boolean {
  const speakers = resolveSpeakers(roomAgentIds, mentionedAgentIds)
  return speakers.length >= 2
}
