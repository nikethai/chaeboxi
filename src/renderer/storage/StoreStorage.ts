import type { DebouncedFunc } from 'lodash'
import debounce from 'lodash/debounce'
import { v4 as uuidv4 } from 'uuid'
import BaseStorage from './BaseStorage'

export enum StorageKey {
  ChatSessions = 'chat-sessions',
  Configs = 'configs',
  Settings = 'settings',
  MyCopilots = 'myCopilots',
  ConfigVersion = 'configVersion',
  RemoteConfig = 'remoteConfig',
  ChatSessionsList = 'chat-sessions-list',
  ChatSessionSettings = 'chat-session-settings',
  PictureSessionSettings = 'picture-session-settings',
  AuthInfo = 'authInfo',
}

export const StorageKeyGenerator = {
  session(id: string) {
    return `session:${id}`
  },
  picture(category: string) {
    return `picture:${category}:${uuidv4()}`
  },
  file(sessionId: string, msgId: string) {
    return `file:${sessionId}:${msgId}:${uuidv4()}`
  },
  fileUniqKey(file: File) {
    return `file_uniq:${file.name}:${file.size}:${file.lastModified}`
  },
  linkUniqKey(url: string) {
    return `link_uniq:${url}`
  },
}

export default class StoreStorage extends BaseStorage {
  private immediateKeys = new Set<string>([StorageKey.Settings, StorageKey.Configs, StorageKey.ConfigVersion])

  public async getItem<T>(key: string, initialValue: T): Promise<T> {
    const value: T = await super.getItem(key, initialValue)

    if (key === StorageKey.Configs && value === initialValue) {
      await super.setItemNow(key, initialValue) // 持久化初始生成的 uuid
    }

    return value
  }

  private debounceQueue = new Map<string, DebouncedFunc<(key: string, value: unknown) => void>>()

  public async setItem<T>(key: string, value: T): Promise<void> {
    // These keys are startup-critical and should not be dropped on fast restarts.
    if (this.immediateKeys.has(key)) {
      await this.setItemNow(key, value)
      return
    }

    let debounced = this.debounceQueue.get(key)
    if (!debounced) {
      debounced = debounce(this.setItemNow.bind(this), 500, { maxWait: 2000 })
      this.debounceQueue.set(key, debounced)
    }
    debounced(key, value)
  }
}
