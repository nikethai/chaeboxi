import type { Message } from '@shared/types'
import { createStore, useStore } from 'zustand'

export type QueuedMessageEntry = {
  message: Message
  needGenerating: boolean
  queuedAt: number
}

type MessageQueueState = {
  messageQueue: Map<string, QueuedMessageEntry[]>
  enqueueMessage: (sessionId: string, message: Message, needGenerating: boolean) => number
  dequeueMessage: (sessionId: string) => QueuedMessageEntry | undefined
  getQueuedCount: (sessionId: string) => number
  clearSessionQueue: (sessionId: string) => void
}

export const messageQueueStore = createStore<MessageQueueState>((set, get) => ({
  messageQueue: new Map(),
  enqueueMessage: (sessionId, message, needGenerating) => {
    const nextQueue = new Map(get().messageQueue)
    const entries = [...(nextQueue.get(sessionId) || [])]
    entries.push({
      message,
      needGenerating,
      queuedAt: Date.now(),
    })
    nextQueue.set(sessionId, entries)
    set({ messageQueue: nextQueue })
    return entries.length
  },
  dequeueMessage: (sessionId) => {
    const nextQueue = new Map(get().messageQueue)
    const entries = [...(nextQueue.get(sessionId) || [])]
    const nextItem = entries.shift()
    if (entries.length > 0) {
      nextQueue.set(sessionId, entries)
    } else {
      nextQueue.delete(sessionId)
    }
    set({ messageQueue: nextQueue })
    return nextItem
  },
  getQueuedCount: (sessionId) => get().messageQueue.get(sessionId)?.length || 0,
  clearSessionQueue: (sessionId) => {
    const nextQueue = new Map(get().messageQueue)
    nextQueue.delete(sessionId)
    set({ messageQueue: nextQueue })
  },
}))

const EMPTY_QUEUE: QueuedMessageEntry[] = []

export function useQueuedMessageCount(sessionId?: string | null) {
  return useStore(messageQueueStore, (state) => (sessionId ? state.messageQueue.get(sessionId)?.length || 0 : 0))
}

export function useQueuedMessages(sessionId?: string | null): QueuedMessageEntry[] {
  return useStore(messageQueueStore, (state) => (sessionId ? state.messageQueue.get(sessionId) ?? EMPTY_QUEUE : EMPTY_QUEUE))
}
