import * as chatStore from '@/stores/chatStore'

export async function initData() {
  await initSessionsIfNeeded()
}

async function initSessionsIfNeeded() {
  // migration， sessionList
  const sessionList = await chatStore.listSessionsMeta()
  if (sessionList.length > 0) {
    return
  }

  const newSessionList = await initPresetSessions()

  await chatStore.updateSessionList(() => {
    return newSessionList
  })
}

async function initPresetSessions() {
  return []
}
