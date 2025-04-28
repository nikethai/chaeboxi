import * as defaults from '../../shared/defaults'
import {
  mermaidSessionCN,
  mermaidSessionEN,
  artifactSessionCN,
  artifactSessionEN,
  imageCreatorSessionForCN,
  imageCreatorSessionForEN,
} from '@/packages/initial_data'
import platform from '@/platform'
import WebPlatform from '@/platform/web_platform'
import storage, { StorageKey } from '@/storage'
import oldStore from 'store'
import { getSessionMeta } from './sessionStorageMutations'
import { StorageKeyGenerator } from '@/storage/StoreStorage'
import pMap from 'p-map'
import { getLogger } from '../lib/utils'
import * as Sentry from '@sentry/react'

const log = getLogger('migration')

export async function migrate() {
  await migrateOnData(
    {
      getData: storage.getItem.bind(storage),
      setData: storage.setItemNow.bind(storage),
      setBlob: storage.setBlob.bind(storage),
    },
    true
  )
}

type MigrateStore = {
  getData: <T>(key: StorageKey, defaultValue: T) => Promise<T>
  setData: <T>(key: StorageKey | string, value: T) => Promise<void>
  setBlob?: (key: string, value: string) => Promise<void>
}

export const CurrentVersion = 8

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
    await migrate_0_to_1(dataStore)
    configVersion = 1
    await dataStore.setData(StorageKey.ConfigVersion, configVersion)
    log.info(`migrate_0_to_1`)
  }
  if (configVersion < 2) {
    await migrate_1_to_2(dataStore)
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
    await migrate_3_to_4(dataStore)
    configVersion = 4
    await dataStore.setData(StorageKey.ConfigVersion, configVersion)
    log.info(`migrate_3_to_4`)
  }
  if (configVersion < 5) {
    needRelaunch ||= await migrate_4_to_5(dataStore)
    configVersion = 5
    await dataStore.setData(StorageKey.ConfigVersion, configVersion)
    log.info(`migrate_4_to_5, needRelaunch: ${needRelaunch}`)
  }
  if (configVersion < 6) {
    await migrate_5_to_6(dataStore)
    configVersion = 6
    await dataStore.setData(StorageKey.ConfigVersion, configVersion)
    log.info(`migrate_5_to_6`)
  }
  if (configVersion < 7) {
    needRelaunch ||= await migrate_6_to_7(dataStore)
    configVersion = 7
    await dataStore.setData(StorageKey.ConfigVersion, configVersion)
    log.info(`migrate_6_to_7, needRelaunch: ${needRelaunch}`)
  }
  if (configVersion < 8) {
    needRelaunch ||= await migrate_7_to_8(dataStore)
    configVersion = 8
    await dataStore.setData(StorageKey.ConfigVersion, configVersion)
    log.info(`migrate_7_to_8, needRelaunch: ${needRelaunch}`)
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
  const sessions = await dataStore.getData(StorageKey.ChatSessions, defaults.sessions())
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
  const sessions = await dataStore.getData(StorageKey.ChatSessions, defaults.sessions())
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
  const sessions = await dataStore.getData(StorageKey.ChatSessions, defaults.sessions())
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
  const sessions = await dataStore.getData(StorageKey.ChatSessions, defaults.sessions())
  if (sessions.length === 0) {
    return false
  }
  log.info(`migrate_7_to_8, sessions: ${sessions.length}`)
  const sessionList = sessions.map((session) => getSessionMeta(session))
  await dataStore.setData(StorageKey.ChatSessionsList, sessionList)
  log.info(`migrate_7_to_8, sessionList: ${sessionList.length}`)
  await pMap(sessions, (session) => dataStore.setData(StorageKeyGenerator.session(session.id), session), {
    concurrency: 5,
  })
  log.info(`migrate_7_to_8, done`)
  return true
}
