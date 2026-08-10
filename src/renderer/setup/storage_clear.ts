import type { Message, Session } from '@shared/types'
import { getDefaultStore } from 'jotai'
import { StorageKeyGenerator } from '@/storage/StoreStorage'
import { listSessionsMeta } from '@/stores/chatStore'
import { settingsStore } from '@/stores/settingsStore'
import platform from '../platform'
import storage from '../storage'
import * as atoms from '../stores/atoms'

// (legacy comment removed)
// (legacy comment removed)
// (legacy comment)
if (platform.type !== 'desktop') {
  setTimeout(() => {
    tickStorageTask()
  }, 10 * 1000) // (legacy)
}

export async function tickStorageTask() {
  const allBlobKeys = await storage.getBlobKeys()
  const prefixes = ['picture:', 'file:', 'parseUrl-', 'parseFile-', 'video_uniq:', 'file_uniq:']
  const storageKeys = allBlobKeys.filter((key) => prefixes.some((prefix) => key.startsWith(prefix)))
  if (storageKeys.length === 0) {
    return
  }
  const needDeletedSet = new Set<string>(storageKeys)

  // (legacy comment removed)
  const sessions = await listSessionsMeta()
  for (const sessionMeta of sessions) {
    // (legacy comment)
    const session = await storage.getItem<Session | null>(StorageKeyGenerator.session(sessionMeta.id), null)
    if (!session) {
      continue
    }
    for (const msg of session.messages) {
      for (const pic of (msg as Message & { pictures: { storageKey: string }[] }).pictures || []) {
        if (pic.storageKey) {
          needDeletedSet.delete(pic.storageKey)
        }
      }
      for (const file of msg.files || []) {
        if (file.storageKey) {
          needDeletedSet.delete(file.storageKey)
        }
        if (file.posterStorageKey) {
          needDeletedSet.delete(file.posterStorageKey)
        }
        for (const frameKey of file.sampledFrameKeys || []) {
          needDeletedSet.delete(frameKey)
        }
      }
      for (const part of msg.contentParts || []) {
        if (part.type === 'image' && part.storageKey) {
          needDeletedSet.delete(part.storageKey)
        }
      }
      for (const link of msg.links || []) {
        if (link.storageKey) {
          needDeletedSet.delete(link.storageKey)
        }
      }
      if (needDeletedSet.size === 0) {
        return
      }
    }

    // (legacy comment removed)
    if (session.assistantAvatarKey) {
      needDeletedSet.delete(session.assistantAvatarKey)
    }
  }

  // (legacy comment removed)
  const settings = settingsStore.getState().getSettings()
  if (settings.userAvatarKey) {
    needDeletedSet.delete(settings.userAvatarKey)
  }
  // (legacy comment removed)
  if (settings.defaultAssistantAvatarKey) {
    needDeletedSet.delete(settings.defaultAssistantAvatarKey)
  }

  // Image Creator ImageGenerationStorage ， chat sessions ，
  for (const key of needDeletedSet) {
    if (key.startsWith('picture:image-gen:')) {
      continue
    }
    await storage.delBlob(key)
  }
}
