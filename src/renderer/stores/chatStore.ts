/**
 * This module contains all fundamental operations for chat sessions and messages.
 * It uses react-query for caching.
 * */

import { shallowEqual } from '@mantine/hooks'
import { CancelledError, useQuery } from '@tanstack/react-query'
import compact from 'lodash/compact'
import isEmpty from 'lodash/isEmpty'
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
    sessionListUpdateQueue = new UpdateQueue<SessionMeta[]>(
      () => _listSessionsMeta(),
      async (sessions) => {
        await storage.setItemNow(StorageKey.ChatSessionsList, sessions)
      }
    )
  }
  console.debug('chatStore', 'updateSessionList', updater)
  const result = await sessionListUpdateQueue.set(updater)
  queryClient.setQueryData(['chat-sessions-list'], sortSessions(result))
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
  const { data: session, ...rest } = useQuery({
    ...getSessionQueryOptions(sessionId!),
    enabled: !!sessionId,
  })
  return { session, ...rest }
}

async function invalidateSessionCache(sessionId: string) {
  // clear 1. session cache 2. session settings cache
  try {
    await queryClient.invalidateQueries({
      predicate(query) {
        return query.queryKey.some((k) => k === sessionId)
      },
    })
  } catch (err) {
    if (err instanceof CancelledError) {
      console.debug('chatStore', 'invalidate session cache cancelled', sessionId)
      return
    }
    throw err
  }
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

export async function updateSessionWithMessages(sessionId: string, updater: Updater<Session>) {
  console.debug('chatStore', 'updateSession', sessionId, updater)
  if (!sessionUpdateQueues[sessionId]) {
    // do not use await here to avoid data race
    sessionUpdateQueues[sessionId] = new UpdateQueue<Session>(
      () => getSession(sessionId),
      async (session) => {
        if (session) {
          console.debug('chatStore', 'persist session', sessionId)
          await storage.setItemNow(StorageKeyGenerator.session(sessionId), session)
        }
      }
    )
  }
  let needUpdateSessionList = true
  const updated = await sessionUpdateQueues[sessionId].set((prev) => {
    if (!prev) {
      throw new Error(`Session ${sessionId} not found`)
    }
    if (typeof updater === 'function') {
      return updater(prev)
    } else {
      if (isEmpty(getSessionMeta(updater as SessionMeta))) {
        needUpdateSessionList = false
      }
      return { ...prev, ...updater }
    }
  })
  if (needUpdateSessionList) {
    await updateSessionList((sessions) => {
      if (!sessions) {
        throw new Error('Session list not found')
      }
      return sessions.map((session) => (session.id === sessionId ? getSessionMeta(updated) : session))
    })
  }
  await invalidateSessionCache(sessionId)
  return updated
}

// 这里只能修改messages之外的字段
export async function updateSession(sessionId: string, updater: Updater<Omit<Session, 'messages'>>) {
  return await updateSessionWithMessages(sessionId, (session) => {
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }
    const updated = typeof updater === 'function' ? updater(session) : updater
    return {
      ...session,
      ...updated,
    }
  })
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

export async function insertMessage(sessionId: string, message: Message, previousId?: string) {
  await updateSessionWithMessages(sessionId, (session) => {
    if (!session) {
      throw new Error(`session ${sessionId} not found`)
    }

    if (previousId) {
      // try to find insert position in message list
      let previousIndex = session.messages.findIndex((m) => m.id === previousId)

      if (previousIndex >= 0) {
        return {
          ...session,
          messages: [
            ...session.messages.slice(0, previousIndex + 1),
            message,
            ...session.messages.slice(previousIndex + 1),
          ],
        } satisfies Session
      }

      // try to find insert position in threads
      if (session.threads) {
        for (const thread of session.threads) {
          previousIndex = thread.messages.findIndex((m) => m.id === previousId)
          if (previousIndex >= 0) {
            return {
              ...session,
              threads: session.threads.map((th) => {
                if (th.id === thread.id) {
                  return {
                    ...thread,
                    messages: [
                      ...thread.messages.slice(0, previousIndex + 1),
                      message,
                      ...thread.messages.slice(previousIndex + 1),
                    ],
                  }
                }
                return th
              }),
            } satisfies Session
          }
        }
      }
    }
    // no previous message, insert to tail of current thread
    return {
      ...session,
      messages: [...session.messages, message],
    } satisfies Session
  })
}

export async function updateMessageCache(sessionId: string, messageId: string, updater: Updater<Message>) {
  return await updateMessage(sessionId, messageId, updater, true)
}

export async function updateMessages(sessionId: string, updater: Updater<Message[]>) {
  return await updateSessionWithMessages(sessionId, (session) => {
    if (!session) {
      throw new Error(`session ${sessionId} not found`)
    }
    const updated = compact(typeof updater === 'function' ? updater(session.messages) : updater)
    return {
      ...session,
      messages: updated,
    }
  })
}

export async function updateMessage(
  sessionId: string,
  messageId: string,
  updater: Updater<Message>,
  onlyUpdateCache?: boolean
) {
  const updateFn = onlyUpdateCache ? updateSessionCache : updateSessionWithMessages

  await updateFn(sessionId, (session) => {
    if (!session) {
      throw new Error(`session ${sessionId} not found`)
    }

    const updateMessages = (messages: Message[]) => {
      return messages.map((m) => {
        if (m.id !== messageId) {
          return m
        }
        const updated = typeof updater === 'function' ? updater(m) : updater
        return {
          ...m,
          ...updated,
        } satisfies Message
      })
    }
    const message = session.messages.find((m) => m.id === messageId)
    if (message) {
      return {
        ...session,
        messages: updateMessages(session.messages),
      }
    }

    // try find message in threads
    if (session.threads) {
      for (const thread of session.threads) {
        const message = thread.messages.find((m) => m.id === messageId)
        if (message) {
          return {
            ...session,
            threads: session.threads.map((th) => {
              if (th.id !== thread.id) {
                return th
              }
              return {
                ...th,
                messages: updateMessages(th.messages),
              }
            }),
          } satisfies Session
        }
      }
    }

    return session
  })
}

export async function removeMessage(sessionId: string, messageId: string) {
  return await updateSessionWithMessages(sessionId, (session) => {
    if (!session) {
      throw new Error(`session ${sessionId} not found`)
    }
    return {
      ...session,
      messages: session.messages.filter((m) => m.id !== messageId),
      threads: session.threads?.map((thread) => {
        return {
          ...thread,
          messages: thread.messages.filter((m) => m.id !== messageId),
        }
      }),
    }
  })
}
