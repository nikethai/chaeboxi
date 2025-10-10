/**
 * This module contains all fundamental operations for chat sessions and messages.
 * It uses react-query for caching.
 * */

import { shallowEqual } from '@mantine/hooks'
import { useQuery } from '@tanstack/react-query'
import {
  GlobalSessionSettingsSchema,
  type Message,
  type Session,
  type SessionMeta,
  type Updater,
  type UpdaterFn,
} from 'src/shared/types'
import { v4 as uuidv4 } from 'uuid'
import storage, { StorageKey } from '@/storage'
import { StorageKeyGenerator } from '@/storage/StoreStorage'
import { migrateSession, sortSessions } from '../utils/session-utils'
import { lastUsedModelStore } from './lastUsedModelStore'
import queryClient from './queryClient'
import { getSessionMeta, mergeSettings } from './sessionHelpers'
import { settingsStore } from './settingsStore'
import { UpdateQueue } from './updateQueue'

// MARK: session list operations

// list sessions meta
async function _listSessionsMeta(): Promise<SessionMeta[]> {
  console.debug('chatStore', 'listSessionsMeta')
  const sessionMetaList = await storage.getItem<SessionMeta[]>(StorageKey.ChatSessionsList, [])
  // session list showing order: reversed, pinned at top
  return sessionMetaList
}

const listSessionsMetaQueryOptions = {
  queryKey: ['chat-sessions-list'],
  queryFn: () => _listSessionsMeta().then(sortSessions),
  staleTime: Infinity,
}

export async function listSessionsMeta() {
  return await queryClient.fetchQuery(listSessionsMetaQueryOptions)
}

export function useSessionList() {
  const { data: sessionMetaList, refetch } = useQuery({ ...listSessionsMetaQueryOptions })
  return { sessionMetaList, refetch }
}

let sessionListUpdateQueue: UpdateQueue<SessionMeta[]> | null = null

export async function updateSessionList(updater: UpdaterFn<SessionMeta[]>) {
  if (!sessionListUpdateQueue) {
    const sessionList = await _listSessionsMeta() // origin storage order
    sessionListUpdateQueue = new UpdateQueue<SessionMeta[]>(sessionList, (sessions) => {
      storage.setItemNow(StorageKey.ChatSessionsList, sessions)
    })
  }
  console.debug('chatStore', 'updateSessionList', updater)
  await sessionListUpdateQueue.set(updater)
  await queryClient.invalidateQueries({ queryKey: ['chat-sessions-list'] })
}

// MARK: session operations

// get session
async function _getSessionById(id: string): Promise<Session | null> {
  console.debug('chatStore', 'getSessionById', id)
  const session = await storage.getItem<Session | null>(StorageKeyGenerator.session(id), null)
  if (!session) {
    return null
  }
  return migrateSession(session)
}

const getSessionQueryOptions = (sessionId: string) => ({
  queryKey: ['chat-session', sessionId],
  queryFn: () => _getSessionById(sessionId),
  staleTime: Infinity,
})

export async function getSession(sessionId: string) {
  return await queryClient.fetchQuery(getSessionQueryOptions(sessionId))
}

export function useSession(sessionId: string | null) {
  const { data: session } = useQuery({
    ...getSessionQueryOptions(sessionId!),
    enabled: !!sessionId,
  })
  return { session }
}

async function invalidateSessionCache(sessionId: string) {
  // clear 1. session cache 2. session settings cache
  await queryClient.invalidateQueries({
    predicate(query) {
      return query.queryKey.some((k) => k === sessionId)
    },
  })
}

// create session
export async function createSession(newSession: Omit<Session, 'id'>, previousId?: string) {
  console.debug('chatStore', 'createSession', newSession)
  const { chat: lastUsedChatModel, picture: lastUsedPictureModel } = lastUsedModelStore.getState()
  const session = {
    ...newSession,
    id: uuidv4(),
    settings: {
      ...(newSession.type === 'picture' ? lastUsedPictureModel : lastUsedChatModel),
      ...newSession.settings,
    },
  }
  await storage.setItemNow(StorageKeyGenerator.session(session.id), session)
  const sMeta = getSessionMeta(session)
  await updateSessionList((sessions) => {
    if (!sessions) {
      throw new Error('Session list not found')
    }
    if (previousId) {
      let previouseSessionIndex = sessions.findIndex((s) => s.id === previousId)
      if (previouseSessionIndex < 0) {
        previouseSessionIndex = sessions.length - 1
      }
      return [...sessions.slice(0, previouseSessionIndex + 1), sMeta, ...sessions.slice(previouseSessionIndex + 1)]
    }
    return [...sessions, sMeta]
  })
  return session
}

const sessionUpdateQueues: Record<string, UpdateQueue<Session>> = {}
// TODO: 外部调用，把messages拆分出去
export async function updateSession(sessionId: string, updater: Updater<Session>) {
  console.debug('chatStore', 'updateSession', sessionId, updater)
  if (!sessionUpdateQueues[sessionId]) {
    const session = await getSession(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }
    sessionUpdateQueues[sessionId] = new UpdateQueue<Session>(session, (session) => {
      if (session) {
        storage.setItemNow(StorageKeyGenerator.session(sessionId), session)
      }
    })
  }
  const updated = await sessionUpdateQueues[sessionId].set((prev) => {
    if (!prev) {
      throw new Error(`Session ${sessionId} not found`)
    }
    if (typeof updater === 'function') {
      return updater(prev)
    } else {
      return { ...prev, ...updater }
    }
  })
  await updateSessionList((sessions) => {
    if (!sessions) {
      throw new Error('Session list not found')
    }
    return sessions.map((session) => (session.id === sessionId ? getSessionMeta(updated) : session))
  })
  await invalidateSessionCache(sessionId)
  return updated
}

// only update session cache without touching storage, for performance sensitive usage
export async function updateSessionCache(sessionId: string, updater: Updater<Session>) {
  console.debug('chatStore', 'updateSessionCache', sessionId, updater)
  const session = await getSession(sessionId)
  if (!session) {
    throw new Error(`Session ${sessionId} not found`)
  }
  queryClient.setQueryData(['chat-session', sessionId], (old: Session | undefined | null) => {
    if (!old) {
      return old
    }
    if (typeof updater === 'function') {
      return updater(old)
    } else {
      return { ...old, ...updater }
    }
  })
}

export async function deleteSession(id: string) {
  console.debug('chatStore', 'deleteSession', id)
  await storage.removeItem(StorageKeyGenerator.session(id))
  await invalidateSessionCache(id)
  await updateSessionList((sessions) => {
    if (!sessions) {
      throw new Error('Session list not found')
    }
    return sessions.filter((session) => session.id !== id)
  })
}

// MARK: session settings operations

// get session settings, merged with global settings
async function _getSessionSettings(sessionId: string) {
  const globalSettings = settingsStore.getState().getSettings()
  const session = await getSession(sessionId)
  return mergeSettings(globalSettings, session?.settings, session?.type)
}

const getSessionSettingsQueryOptions = (sessionId: string) => ({
  queryKey: ['session-settings', sessionId],
  queryFn: async () => _getSessionSettings(sessionId),
  staleTime: Infinity,
})

export function useSessionSettings(sessionId: string | null) {
  const { data: sessionSettings } = useQuery({
    ...getSessionSettingsQueryOptions(sessionId!),
    enabled: !!sessionId,
  })
  return { sessionSettings }
}

let changeWatched = false

function changeWatch() {
  if (changeWatched) {
    return
  }
  changeWatched = true
  settingsStore.subscribe(
    (state) => GlobalSessionSettingsSchema.parse(state),
    () => {
      console.debug('chat-store', 'globalSessionSettings changed, refetch session settings')
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'session-settings' })
    },
    { equalityFn: shallowEqual }
  )
}
changeWatch()

export function getSessionSettings(sessionId: string) {
  return queryClient.fetchQuery(getSessionSettingsQueryOptions(sessionId))
}

// MARK: message operations

// list messages
export async function listMessages(sessionId?: string | null): Promise<Message[]> {
  console.debug('chatStore', 'listMessages', sessionId)
  if (!sessionId) {
    return []
  }
  const session = await getSession(sessionId)
  if (!session) {
    return []
  }
  return session.messages
}
