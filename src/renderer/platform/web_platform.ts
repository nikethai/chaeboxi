import * as defaults from '@shared/defaults'
import type { Config, Settings, ShortcutSetting } from '@shared/types'
import localforage from 'localforage'
import { v4 as uuidv4 } from 'uuid'
import { parseLocale } from '@/i18n/parser'
import { type ImageGenerationStorage, IndexedDBImageGenerationStorage } from '@/storage/ImageGenerationStorage'
import { getBrowser, getOS } from '../packages/navigator'
import { CHATBOX_BUILD_TARGET } from '@/variables'
import type {
  FormFactor,
  Platform,
  PlatformType,
  SystemNotificationClickPayload,
  SystemNotificationPayload,
  SystemNotificationPermission,
} from './interfaces'
import type { KnowledgeBaseController } from './knowledge-base/interface'
import { IndexedDBStorage } from './storages'
import {
  getWebOrCapacitorNotificationPermission,
  onWebOrCapacitorNotificationClick,
  requestWebOrCapacitorNotificationPermission,
  showWebOrCapacitorNotification,
} from './system-notifications-web'
import WebExporter from './web_exporter'
import webLogger from './web_logger'
import WebKnowledgeBaseController from './knowledge-base/web-controller'
import { parseTextFileLocally } from './web_platform_utils'

export default class WebPlatform extends IndexedDBStorage implements Platform {
  public type: PlatformType = 'web'
  public formFactor: FormFactor = 'desktop'

  public exporter = new WebExporter()

  private _kbController?: WebKnowledgeBaseController
  private imageGenerationStorage: ImageGenerationStorage | null = null
  /** Capacitor mobile builds prefer LocalNotifications over browser Notification API */
  private readonly preferCapacitorNotifications: boolean

  constructor() {
    super()
    // Capacitor iOS/Android shells are built with mobile_app target
    if (CHATBOX_BUILD_TARGET === 'mobile_app') {
      this.type = 'mobile'
      this.formFactor = 'mobile'
      this.preferCapacitorNotifications = true
    } else {
      this.preferCapacitorNotifications = false
    }
    webLogger.init().catch((e) => console.error('Failed to init web logger:', e))
    if (window.desktopAPI) {
      this._kbController = new WebKnowledgeBaseController(window.desktopAPI)
    }
  }

  public async getVersion(): Promise<string> {
    return 'web'
  }
  public async getPlatform(): Promise<string> {
    return 'web'
  }
  public async getArch(): Promise<string> {
    return 'web'
  }
  public async shouldUseDarkColors(): Promise<boolean> {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  public onSystemThemeChange(callback: () => void): () => void {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', callback)
    return () => {
      window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', callback)
    }
  }
  public onWindowShow(callback: () => void): () => void {
    return () => null
  }
  public onWindowFocused(callback: () => void): () => void {
    return () => null
  }
  public onUpdateDownloaded(callback: () => void): () => void {
    return () => null
  }
  public async openLink(url: string): Promise<void> {
    window.open(url)
  }
  public async getDeviceName(): Promise<string> {
    // (legacy comment)
    return await Promise.resolve(getBrowser()!)
  }
  public async getInstanceName(): Promise<string> {
    return `${getOS()} / ${getBrowser()}`
  }
  public async getLocale() {
    const lang = window.navigator.language
    return parseLocale(lang)
  }
  public async ensureShortcutConfig(config: ShortcutSetting): Promise<void> {
    return
  }
  public async ensureProxyConfig(config: { proxy?: string }): Promise<void> {
    return
  }
  public async relaunch(): Promise<void> {
    location.reload()
  }

  public async getConfig(): Promise<Config> {
    let value: Config = await this.getStoreValue('configs')
    if (value === undefined || value === null) {
      value = defaults.newConfigs()
      await this.setStoreValue('configs', value)
    }
    return value
  }
  public async getSettings(): Promise<Settings> {
    let value: Settings = await this.getStoreValue('settings')
    if (value === undefined || value === null) {
      value = defaults.settings()
      await this.setStoreValue('settings', value)
    }
    return value
  }

  public async getStoreBlob(key: string): Promise<string | null> {
    return localforage.getItem<string>(key)
  }
  public async setStoreBlob(key: string, value: string): Promise<void> {
    await localforage.setItem(key, value)
  }
  public async delStoreBlob(key: string) {
    return localforage.removeItem(key)
  }
  public async listStoreBlobKeys(): Promise<string[]> {
    return localforage.keys()
  }

  public async initTracking() {
    // Upstream tracking disabled
  }
  public trackingEvent(name: string, params: { [key: string]: string }) {
    // Upstream tracking disabled
  }

  public async shouldShowAboutDialogWhenStartUp(): Promise<boolean> {
    return false
  }

  public async appLog(level: string, message: string): Promise<void> {
    webLogger.log(level, message)
  }

  public async exportLogs(): Promise<string> {
    return webLogger.exportLogs()
  }

  public async clearLogs(): Promise<void> {
    return webLogger.clearLogs()
  }

  public async ensureAutoLaunch(enable: boolean) {
    return
  }

  async pickImportedArchivePath(): Promise<string | null> {
    throw new Error('Imported archives are desktop-only')
  }

  async inspectImportedArchive(_path: string): Promise<unknown> {
    throw new Error('Imported archives are desktop-only')
  }

  async parseFileLocally(file: File): Promise<{ key?: string; isSupported: boolean }> {
    const result = await parseTextFileLocally(file)
    if (!result.isSupported) {
      return { isSupported: false }
    }
    const key = `parseFile-` + uuidv4()
    await this.setStoreBlob(key, result.text)
    return { key, isSupported: true }
  }

  public async parseUrl(url: string): Promise<{ key: string; title: string }> {
    throw new Error('Not implemented')
  }

  public async isFullscreen() {
    return true
  }

  public async setFullscreen(enabled: boolean): Promise<void> {
    return
  }

  installUpdate(): Promise<void> {
    throw new Error('Method not implemented.')
  }

  public getKnowledgeBaseController(): KnowledgeBaseController {
    if (!this._kbController) {
      throw new Error('Knowledge base is not available on the web platform.')
    }
    return this._kbController
  }

  public getImageGenerationStorage(): ImageGenerationStorage {
    if (!this.imageGenerationStorage) {
      this.imageGenerationStorage = new IndexedDBImageGenerationStorage()
    }
    return this.imageGenerationStorage
  }

  public async readFileByPath(_path: string): Promise<string> {
    throw new Error('Filesystem read is not supported in the web platform.')
  }

  public async writeFile(_path: string, _content: string): Promise<void> {
    throw new Error('Filesystem write is not supported in the web platform.')
  }

  public async deleteFile(_path: string): Promise<void> {
    throw new Error('Filesystem delete is not supported in the web platform.')
  }

  public minimize() {
    return Promise.resolve()
  }

  public maximize() {
    return Promise.resolve()
  }

  public unmaximize() {
    return Promise.resolve()
  }

  public closeWindow() {
    return Promise.resolve()
  }

  public isMaximized() {
    return Promise.resolve(true)
  }

  public onMaximizedChange() {
    return () => null
  }

  public async getSystemNotificationPermission(): Promise<SystemNotificationPermission> {
    return getWebOrCapacitorNotificationPermission(this.preferCapacitorNotifications)
  }

  public async requestSystemNotificationPermission(): Promise<SystemNotificationPermission> {
    return requestWebOrCapacitorNotificationPermission(this.preferCapacitorNotifications)
  }

  public async showSystemNotification(payload: SystemNotificationPayload): Promise<void> {
    await showWebOrCapacitorNotification(payload, this.preferCapacitorNotifications)
  }

  public onSystemNotificationClick(callback: (payload: SystemNotificationClickPayload) => void): () => void {
    return onWebOrCapacitorNotificationClick(callback, this.preferCapacitorNotifications)
  }
}
