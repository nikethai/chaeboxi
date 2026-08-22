import { arrayMove } from '@dnd-kit/sortable'
import { copyMessagesWithMapping, copyThreads, type Session, type SessionMeta } from '@shared/types'
import { getDefaultStore } from 'jotai'
import { omit } from 'lodash'
import { router } from '@/router'
import { sortSessions } from '@/utils/session-utils'
import * as atoms from '../atoms'
import * as chatStore from '../chatStore'
import * as scrollActions from '../scrollActions'
import { initEmptyChatSession, initEmptyPictureSession } from '../sessionHelpers'

/**
 * Create a new session and switch to it
 */
async function create(newSession: Omit<Session, 'id'>) {
  const session = await chatStore.createSession(newSession)
  switchCurrentSession(session.id)
  return session
}

export type CreateEmptyOptions = {
  /** Assign the new session to a project folder */
  folderId?: string
  /** Canonical Project id (dual-written with folderId) */
  projectId?: string
  /** Optional agent/copilot to attach (e.g. project default) */
  copilotId?: string
  /** Preferred: agent persona id(s) for the room */
  agentIds?: string[]
}

/**
 * Create a new empty session, optionally scoped to a project folder.
 */
export async function createEmpty(type: 'chat' | 'picture', options?: CreateEmptyOptions) {
  let draft: Omit<Session, 'id'>
  switch (type) {
    case 'chat':
      draft = initEmptyChatSession()
      break
    case 'picture':
      draft = initEmptyPictureSession()
      break
    default:
      throw new Error(`Unknown session type: ${type}`)
  }

  const projectId = options?.projectId || options?.folderId
  if (projectId) {
    draft = { ...draft, folderId: projectId, projectId }
  }
  const agentIds =
    options?.agentIds && options.agentIds.length > 0
      ? options.agentIds
      : options?.copilotId
        ? [options.copilotId]
        : undefined
  if (agentIds?.length) {
    const { toSessionAgentFields } = await import('@shared/agent-room')
    const fields = toSessionAgentFields(agentIds)
    draft = { ...draft, agentIds: fields.agentIds, copilotId: fields.copilotId }
  }

  return await create(draft)
}

/**
 * Copy a session (internal helper)
 */
async function copySession(
  sourceMeta: SessionMeta & {
    name?: Session['name']
    messages?: Session['messages']
    threads?: Session['threads']
    threadName?: Session['threadName']
    compactionPoints?: Session['compactionPoints']
  }
) {
  const source = await chatStore.getSession(sourceMeta.id)
  if (!source) {
    throw new Error(`Session ${sourceMeta.id} not found`)
  }

  // Copy messages and get ID mapping
  const { messages: newMessages, idMapping } = sourceMeta.messages
    ? copyMessagesWithMapping(sourceMeta.messages)
    : copyMessagesWithMapping(source.messages)

  // Use sourceMeta.compactionPoints if explicitly provided (e.g., from thread),
  // otherwise fall back to source session's compactionPoints
  const sourceCompactionPoints =
    'compactionPoints' in sourceMeta ? sourceMeta.compactionPoints : source.compactionPoints

  // Map compactionPoints IDs
  const newCompactionPoints = sourceCompactionPoints
    ?.map((cp) => {
      const newSummaryId = idMapping.get(cp.summaryMessageId)
      const newBoundaryId = idMapping.get(cp.boundaryMessageId)
      if (!newSummaryId || !newBoundaryId) {
        console.warn('[copySession] Skipping compactionPoint with unmapped IDs', cp)
        return null
      }
      return {
        ...cp,
        summaryMessageId: newSummaryId,
        boundaryMessageId: newBoundaryId,
      }
    })
    .filter((cp): cp is NonNullable<typeof cp> => cp !== null)

  const newSession = {
    ...omit(source, 'id', 'messages', 'threads', 'messageForksHash', 'compactionPoints'),
    ...(sourceMeta.name ? { name: sourceMeta.name } : {}),
    messages: newMessages,
    threads: sourceMeta.threads ? copyThreads(sourceMeta.threads, idMapping) : copyThreads(source.threads, idMapping),
    messageForksHash: undefined,
    compactionPoints: newCompactionPoints?.length ? newCompactionPoints : undefined,
    ...(sourceMeta.threadName ? { threadName: sourceMeta.threadName } : {}),
  }
  return await chatStore.createSession(newSession, source.id)
}

/**
 * Copy session and switch to it
 */
export async function copyAndSwitchSession(source: SessionMeta) {
  const newSession = await copySession(source)
  switchCurrentSession(newSession.id)
}

/**
 * Switch current session by id
 */
export function switchCurrentSession(sessionId: string) {
  const store = getDefaultStore()
  store.set(atoms.currentSessionIdAtom, sessionId)
  router.navigate({
    to: `/session/${sessionId}`,
  })
  scrollActions.clearAutoScroll()
}

/**
 * Reorder sessions in the list
 */
export async function reorderSessions(oldIndex: number, newIndex: number) {
  console.debug('sessionActions', 'reorderSessions', oldIndex, newIndex)
  await chatStore.updateSessionList((sessions) => {
    if (!sessions) {
      throw new Error('Session list not found')
    }
    // sortSessions normalizes display order (pinned first, then reversed chronological)
    // We must apply it both before arrayMove (to match UI indices) and after (to persist correct order)
    const sortedSessions = sortSessions(sessions)
    return sortSessions(arrayMove(sortedSessions, oldIndex, newIndex))
  })
}

/**
 * Switch to session by sorted index
 */
export async function switchToIndex(index: number) {
  const sessions = await chatStore.listSessionsMeta()
  const target = sessions[index]
  if (!target) {
    return
  }
  switchCurrentSession(target.id)
}

/**
 * Switch to next/previous session in sorted order
 */
export async function switchToNext(reversed?: boolean) {
  const sessions = await chatStore.listSessionsMeta()
  if (!sessions) {
    return
  }
  const store = getDefaultStore()
  const currentSessionId = store.get(atoms.currentSessionIdAtom)
  const currentIndex = sessions.findIndex((s) => s.id === currentSessionId)
  if (currentIndex < 0) {
    switchCurrentSession(sessions[0].id)
    return
  }
  let targetIndex = reversed ? currentIndex - 1 : currentIndex + 1
  if (targetIndex >= sessions.length) {
    targetIndex = 0
  }
  if (targetIndex < 0) {
    targetIndex = sessions.length - 1
  }
  const target = sessions[targetIndex]
  switchCurrentSession(target.id)
}

/**
 * Clear session list, keeping only specified number of sessions
 */
async function clearSessionList(keepNum: number) {
  const sessionMetaList = await chatStore.listSessionsMeta()
  const deleted = sessionMetaList?.slice(keepNum)
  if (!deleted?.length) {
    return
  }
  for (const s of deleted) {
    await chatStore.deleteSession(s.id)
  }
  await chatStore.updateSessionList((sessions) => {
    if (!sessions) {
      throw new Error('Session list not found')
    }
    return sessions.filter((s) => !deleted?.some((d) => d.id === s.id))
  })
}

/**
 * Clear conversation list, keeping only specified number of sessions (from top)
 */
export async function clearConversationList(keepNum: number) {
  await clearSessionList(keepNum)
}

/**
 * Clear all messages in a session, keeping only system prompt
 */
export async function clear(sessionId: string) {
  const session = await chatStore.getSession(sessionId)
  if (!session) {
    return
  }
  session.messages.forEach((msg) => {
    msg?.cancel?.()
  })
  return await chatStore.updateSessionWithMessages(session.id, {
    messages: session.messages.filter((m) => m.role === 'system').slice(0, 1),
    threads: undefined,
  })
}

// Re-export copySession for use by threads.ts (moveThreadToConversations)
export { copySession as _copySession }
