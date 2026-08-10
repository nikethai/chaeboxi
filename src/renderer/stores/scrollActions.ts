import { getSession } from './chatStore'
import { getAllMessageList } from './sessionHelpers'
import { uiStore } from './uiStore'

// scrollToMessage ， false
export async function scrollToMessage(
  sessionId: string,
  msgId: string,
  align: 'start' | 'center' | 'end' = 'start',
  behavior: 'auto' | 'smooth' = 'auto' // 'auto' ，'smooth'
): Promise<boolean> {
  const session = await getSession(sessionId)
  if (!session) {
    return false
  }
  const currentMessages = getAllMessageList(session)
  if (!currentMessages) {
    return false
  }
  const index = currentMessages.findIndex((msg) => msg.id === msgId)
  if (index === -1) {
    return false
  }
  scrollToIndex(index, align, behavior)
  return true
}

export function scrollToIndex(
  index: number | 'LAST',
  align: 'start' | 'center' | 'end' = 'start',
  behavior: 'auto' | 'smooth' = 'auto' // 'auto' ，'smooth'
) {
  const virtuoso = uiStore.getState().messageScrolling
  virtuoso?.current?.scrollToIndex({ index, align, behavior })
}

export function scrollToTop(behavior: 'auto' | 'smooth' = 'auto') {
  clearAutoScroll()
  return scrollToIndex(0, 'start', behavior)
}

export function scrollToBottom(behavior: 'auto' | 'smooth' = 'auto') {
  clearAutoScroll()
  const virtuoso = uiStore.getState().messageScrolling
  // Prefer scrollTo Infinity so newly inserted room turns pin even before Virtuoso
  // has fully measured the last index (multi-agent discuss used to stall mid-list).
  virtuoso?.current?.scrollTo({ top: Number.MAX_SAFE_INTEGER, behavior })
  // Second pass after layout so tall streamed messages stay in view
  requestAnimationFrame(() => {
    virtuoso?.current?.scrollToIndex({ index: 'LAST', align: 'end', behavior })
  })
  return scrollToIndex('LAST', 'end', behavior)
}

let autoScrollTask: {
  id: string
  task: {
    msgId: string
    align: 'start' | 'center' | 'end'
    behavior: 'auto' | 'smooth'
  }
} | null = null

export function startAutoScroll(
  msgId: string,
  align: 'start' | 'center' | 'end' = 'start',
  behavior: 'auto' | 'smooth' = 'auto' // 'auto' ，'smooth'
): string {
  const newTask = { msgId, align, behavior }
  const newId = JSON.stringify(newTask)
  if (autoScrollTask) {
    if (autoScrollTask.id === newId) {
      return autoScrollTask.id
    } else {
      clearAutoScroll()
    }
  }
  autoScrollTask = {
    id: newId,
    task: newTask,
  }
  return newId
}

export function clearAutoScroll(id?: string) {
  if (!autoScrollTask) {
    return true
  }
  if (id && id !== autoScrollTask.id) {
    return false
  }
  autoScrollTask = null
  return true
}

export function getMessageListViewportHeight() {
  const messageListElement = uiStore.getState().messageListElement
  if (!messageListElement) {
    return 0
  }
  return messageListElement.current?.clientHeight ?? 0
}
