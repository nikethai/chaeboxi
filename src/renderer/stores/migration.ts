import { Session, SessionMeta } from '@/../shared/types'
import {
  artifactSessionCN,
  artifactSessionEN,
  imageCreatorSessionForCN,
  imageCreatorSessionForEN,
  mermaidSessionCN,
  mermaidSessionEN,
} from '@/packages/initial_data'
import platform from '@/platform'
import WebPlatform from '@/platform/web_platform'
import storage, { StorageKey } from '@/storage'
import { StorageKeyGenerator } from '@/storage/StoreStorage'
import * as Sentry from '@sentry/react'
import { getDefaultStore } from 'jotai'
import oldStore from 'store'
import * as defaults from '../../shared/defaults'
import { getLogger } from '../lib/utils'
import { migrationProcessAtom } from './atoms/utilAtoms'
import { getSessionMeta } from './sessionStorageMutations'
import { keyBy } from 'lodash'

const log = getLogger('migration')

export async function migrate() {
  await migrateOnData(
    {
      getData: storage.getItem.bind(storage),
      setData: storage.setItemNow.bind(storage),
      setAll: storage.setAll.bind(storage),
      setBlob: storage.setBlob.bind(storage),
    },
    true
  )
}

type MigrateStore = {
  getData: <T>(key: StorageKey, defaultValue: T) => Promise<T>
  setData: <T>(key: StorageKey | string, value: T) => Promise<void>
  setAll: (data: { [key: string]: any }) => Promise<void>
  setBlob?: (key: string, value: string) => Promise<void>
}

export const CurrentVersion = 9

export async function migrateOnData(dataStore: MigrateStore, canRelaunch = true) {
  let needRelaunch = false
  let configVersion = await dataStore.getData(StorageKey.ConfigVersion, 0)
  if (configVersion >= CurrentVersion) {
    return
  }

  const scope = Sentry.getCurrentScope()
  scope.setTag('configVersion', configVersion)
  log.info(`migrateOnData: ${configVersion}, canRelaunch: ${canRelaunch}`)

  if (configVersion < 1) {
    // await migrate_0_to_1(dataStore)
    configVersion = 1
    await dataStore.setData(StorageKey.ConfigVersion, configVersion)
    log.info(`migrate_0_to_1`)
  }
  if (configVersion < 2) {
    // await migrate_1_to_2(dataStore)
    configVersion = 2
    await dataStore.setData(StorageKey.ConfigVersion, configVersion)
    log.info(`migrate_1_to_2`)
  }
  if (configVersion < 3) {
    await migrate_2_to_3(dataStore)
    configVersion = 3
    await dataStore.setData(StorageKey.ConfigVersion, configVersion)
    log.info(`migrate_2_to_3`)
  }
  if (configVersion < 4) {
    // await migrate_3_to_4(dataStore)
    configVersion = 4
    await dataStore.setData(StorageKey.ConfigVersion, configVersion)
    log.info(`migrate_3_to_4`)
  }
  if (configVersion < 5) {
    const _needRelaunch = await migrate_4_to_5(dataStore)
    needRelaunch ||= _needRelaunch
    configVersion = 5
    await dataStore.setData(StorageKey.ConfigVersion, configVersion)
    log.info(`migrate_4_to_5, needRelaunch: ${needRelaunch}`)
  }
  if (configVersion < 6) {
    // await migrate_5_to_6(dataStore)
    configVersion = 6
    await dataStore.setData(StorageKey.ConfigVersion, configVersion)
    log.info(`migrate_5_to_6`)
  }
  if (configVersion < 7) {
    const _needRelaunch = await migrate_6_to_7(dataStore)
    needRelaunch ||= _needRelaunch
    configVersion = 7
    await dataStore.setData(StorageKey.ConfigVersion, configVersion)
    log.info(`migrate_6_to_7, needRelaunch: ${needRelaunch}`)
  }
  let migrate_7_to_8_executed = false
  if (configVersion < 8) {
    // 必须这么写，如果写在一行， 编译优化会导致 migrate 不执行
    const _needRelaunch = await migrate_7_to_8(dataStore)
    needRelaunch ||= _needRelaunch
    configVersion = 8
    await dataStore.setData(StorageKey.ConfigVersion, configVersion)
    log.info(`migrate_7_to_8, needRelaunch: ${needRelaunch}`)
    migrate_7_to_8_executed = true
  }

  if (configVersion < 9) {
    if (!migrate_7_to_8_executed) {
      // 如果 migrate_7_to_8 执行了，就没有必要执行 migrate_8_to_9 找回数据了
      const _needRelaunch = await migrate_8_to_9(dataStore)
      needRelaunch ||= _needRelaunch
    }
    configVersion = 9
    await dataStore.setData(StorageKey.ConfigVersion, configVersion)
    log.info(`migrate_8_to_9, needRelaunch: ${needRelaunch}`)
  }

  // 如果需要重启，则重启应用
  if (needRelaunch && canRelaunch) {
    log.info(`migrate: relaunch`)
    await platform.relaunch()
  }
}

async function migrate_0_to_1(dataStore: MigrateStore) {
  const settings = await dataStore.getData(StorageKey.Settings, defaults.settings())
  // 如果历史版本的用户开启了消息的token计数展示，那么也帮他们开启token消耗展示
  if (settings.showTokenCount) {
    await dataStore.setData(StorageKey.Settings, { ...settings, showTokenUsed: true })
  }
}

async function migrate_1_to_2(dataStore: MigrateStore) {
  const sessions = await dataStore.getData<Session[]>(StorageKey.ChatSessions, [])
  const lang = await platform.getLocale()
  if (lang.startsWith('zh')) {
    if (sessions.find((session) => session.id === imageCreatorSessionForCN.id)) {
      return
    }
    await dataStore.setData(StorageKey.ChatSessions, [...sessions, imageCreatorSessionForCN])
  } else {
    if (sessions.find((session) => session.id === imageCreatorSessionForEN.id)) {
      return
    }
    await dataStore.setData(StorageKey.ChatSessions, [...sessions, imageCreatorSessionForEN])
  }
}

async function migrate_2_to_3(dataStore: MigrateStore) {
  // 原来 Electron 应用存储图片 base64 数据到 IndexedDB，现在改成本地文件存储
  if (!dataStore.setBlob) {
    return
  }
  if (platform.type !== 'desktop') {
    return
  }
  const ws = new WebPlatform()
  const blobKeys = await ws.listStoreBlobKeys()
  for (const key of blobKeys) {
    const value = await ws.getStoreBlob(key)
    if (!value) {
      continue
    }
    await dataStore.setBlob(key, value)
    await ws.delStoreBlob(key)
  }
}

async function migrate_3_to_4(dataStore: MigrateStore) {
  const sessions = await dataStore.getData<Session[]>(StorageKey.ChatSessions, [])
  const lang = await platform.getLocale()
  const targetSession = lang.startsWith('zh') ? artifactSessionCN : artifactSessionEN
  if (sessions.find((session) => session.id === targetSession.id)) {
    return
  }
  await dataStore.setData(StorageKey.ChatSessions, [...sessions, targetSession])
}

async function migrate_4_to_5(dataStore: MigrateStore): Promise<boolean> {
  if (platform.type !== 'web') {
    return false
  }
  // 针对网页版，从 store 迁移至 localforage
  // 本质上是从更小的 localStorage 迁移到更大的 IndexedDB，解决容量不够用的问题
  const keys: string[] = []
  oldStore.each((value, key) => {
    keys.push(key)
  })
  if (keys.length === 0) {
    return false
  }
  for (const key of keys) {
    await dataStore.setData(key, oldStore.get(key))
  }
  return true
}

async function migrate_5_to_6(dataStore: MigrateStore) {
  const sessions = await dataStore.getData<Session[]>(StorageKey.ChatSessions, [])
  const lang = await platform.getLocale()
  const targetSession = lang.startsWith('zh') ? mermaidSessionCN : mermaidSessionEN
  if (sessions.find((session) => session.id === targetSession.id)) {
    return
  }
  await dataStore.setData(StorageKey.ChatSessions, [...sessions, targetSession])
}

// 针对 mobile 端，从 store 迁移至 sqlite
// 解决容量不够用的问题
async function migrate_6_to_7(dataStore: MigrateStore): Promise<boolean> {
  if (platform.type !== 'mobile') {
    return false
  }
  // 针对mobile端，从 store 迁移至 sqllite
  // 解决容量不够用的问题
  const keys: string[] = []
  oldStore.each((value, key) => {
    keys.push(key)
  })
  if (keys.length === 0) {
    return false
  }
  for (const key of keys) {
    await dataStore.setData(key, oldStore.get(key))
  }
  return true
}

// 从所有 sessions 保存在一个 key 迁移到每个 session 保存在一个 key，增加 session 列表的读取性能
async function migrate_7_to_8(dataStore: MigrateStore): Promise<boolean> {
  const sessions = await dataStore.getData<Session[]>(StorageKey.ChatSessions, [])
  log.info(`migrate_7_to_8, sessions: ${sessions.length}`)
  if (sessions.length === 0) {
    return false
  }

  const sessionList = sessions.map((session) => getSessionMeta(session))
  await dataStore.setData(StorageKey.ChatSessionsList, sessionList)
  log.info(`migrate_7_to_8, sessionList: ${sessionList.length}`)

  // 一次写入所有 session， 提升性能
  const sessionMap = keyBy(sessions, (session) => StorageKeyGenerator.session(session.id))
  await dataStore.setAll(sessionMap)
  log.info(`migrate_7_to_8, done`)
  return true
}

// 修复之前从 7 以下升级，会导致 7_8 不执行的问题，从 chat-sessions 里找到 chat-sessions-list 中不存在的 session，然后迁移
async function migrate_8_to_9(dataStore: MigrateStore): Promise<boolean> {
  if (platform.type !== 'mobile') {
    return false
  }

  const sessions = await dataStore.getData<Session[]>(StorageKey.ChatSessions, [])
  log.info(`migrate_8_to_9, old sessions: ${sessions.length}`)
  if (sessions.length === 0) {
    return false
  }

  const sessionList = await dataStore.getData<SessionMeta[]>(StorageKey.ChatSessionsList, [])
  const existedSessionIds = new Set(sessionList.map((session) => session.id))

  // 找到 chat-sessions 里不存在于 chat-sessions-list 的 session
  const missedSessions = sessions.filter((session) => !existedSessionIds.has(session.id))
  const missedSessionList = missedSessions.map((session) => getSessionMeta(session))
  log.info(`migrate_8_to_9, missedSessions: ${missedSessions.length}`)

  // 写入 chat-sessions-list
  await dataStore.setData(StorageKey.ChatSessionsList, [...sessionList, ...missedSessionList])
  const missedSessionMap = keyBy(missedSessions, (session) => StorageKeyGenerator.session(session.id))
  await dataStore.setAll(missedSessionMap)
  log.info(`migrate_8_to_9 done`)

  return true
}

function setInitProcess(process: string) {
  const store = getDefaultStore()
  store.set(migrationProcessAtom, process)
}
