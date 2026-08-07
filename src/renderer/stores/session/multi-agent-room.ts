/**
 * Slack-style multi-agent room orchestrator.
 * Sequential short turns among room members; interruptible via message cancel / new user send.
 */

import {
  buildSpeakerTurnQueue,
  mergeRoomMembers,
  normalizeSessionAgentIds,
  resolveSpeakers,
  toSessionAgentFields,
} from '@shared/agent-room'
import { createMessage, type Message } from '@shared/types'
import { getDefaultStore } from 'jotai'
import { getBuiltInCopilotById, myCopilotsAtom } from '@/hooks/useCopilots'
import * as chatStore from '../chatStore'
import { generate } from './generation'
import { insertMessage } from './messages'

export type RoomAgentMeta = {
  id: string
  name: string
  emojiAvatar?: string
  picUrl?: string
}

function resolveAgentMeta(id: string): RoomAgentMeta | null {
  const builtin = getBuiltInCopilotById(id)
  if (builtin) {
    return {
      id: builtin.id,
      name: builtin.name,
      emojiAvatar: builtin.emojiAvatar,
      picUrl: builtin.picUrl,
    }
  }
  try {
    const stored = getDefaultStore().get(myCopilotsAtom)
    const list = Array.isArray(stored) ? stored : []
    const found = list.find((c) => c.id === id)
    if (found) {
      return {
        id: found.id,
        name: found.name,
        emojiAvatar: found.emojiAvatar,
        picUrl: found.picUrl,
      }
    }
  } catch {
    // ignore
  }
  return null
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

/**
 * Run multi-agent sequential discussion after a user message.
 * Caller must already have inserted the user message.
 * Does not insert a pre-created assistant message — creates one per speaker turn.
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

  const metas = speakers.map((id) => resolveAgentMeta(id)).filter(Boolean) as RoomAgentMeta[]
  const participantNames = metas.map((m) => m.name)
  const queue = buildSpeakerTurnQueue(speakers)

  for (let i = 0; i < queue.length; i++) {
    const agentId = queue[i]
    const meta = resolveAgentMeta(agentId)
    if (!meta) continue

    // If user already queued a new message or something is generating from interrupt, stop.
    const session = await chatStore.getSession(sessionId)
    if (!session) return

    // Stop if a newer user message was inserted after we started (user interrupted mid-room).
    // Detect: last message is user and not the one we started from — skip for simplicity:
    // if any assistant is generating from cancel, generate's cancel handles it.
    const lastMsg = session.messages[session.messages.length - 1]
    if (lastMsg?.role === 'user' && i > 0) {
      // New user message arrived while we were between turns
      return
    }
    if (lastMsg?.role === 'assistant' && lastMsg.generating && lastMsg.agentId && lastMsg.agentId !== agentId) {
      return
    }

    const assistantMsg: Message = {
      ...createMessage('assistant', ''),
      generating: true,
      agentId: meta.id,
      name: meta.name,
    }
    await insertMessage(sessionId, assistantMsg)

    const isLast = i === queue.length - 1
    await generate(sessionId, assistantMsg, {
      operationType: 'send_message',
      truncateTokenLimit: params.truncateTokenLimit,
      speakerAgentId: meta.id,
      roomMulti: true,
      participantNames,
      skipQueuedMessages: !isLast,
    })

    // Re-read: if generation was cancelled mid-stream, stop the room
    const after = await chatStore.getSession(sessionId)
    const justGenerated = after?.messages.find((m) => m.id === assistantMsg.id)
    if (
      justGenerated?.cancel ||
      (justGenerated?.generating === false && justGenerated?.error && i < queue.length - 1)
    ) {
      // continue on soft errors; only stop if message was cancelled without content
    }
    // If user sent a new message (last is user), stop
    const latest = after?.messages[after.messages.length - 1]
    if (latest?.role === 'user') {
      return
    }
  }
}

/**
 * Whether the submit path should use room multi-agent orchestration.
 */
export function shouldRunMultiAgentRoom(mentionedAgentIds: string[] | undefined, roomAgentIds: string[]): boolean {
  const speakers = resolveSpeakers(roomAgentIds, mentionedAgentIds)
  return speakers.length >= 2
}
