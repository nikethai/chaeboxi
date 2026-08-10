/** biome-ignore-all lint/suspicious/noExplicitAny: <any> */

import type { DesktopIPC } from '@shared/desktop-ipc-types'
import type { Config, Settings, ShortcutSetting } from '@shared/types'
import { cache } from '@shared/utils/cache'
import { listen as tauriListen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import localforage from 'localforage'
import { v4 as uuidv4 } from 'uuid'
import { parseLocale } from '@/i18n/parser'
import { type ImageGenerationStorage, IndexedDBImageGenerationStorage } from '@/storage/ImageGenerationStorage'
import { getOS } from '../packages/navigator'
import type { ClipboardCapturePayload, FormFactor, Platform, PlatformType, ScreenshotImagePayload } from './interfaces'
import DesktopKnowledgeBaseController from './knowledge-base/desktop-controller'
import WebExporter from './web_exporter'
import { parseTextFileLocally } from './web_platform_utils'

function listenShellEvent<T>(eventName: string, callback: (payload: T) => void): () => void {
  let unlisten: (() => void) | null = null
  let disposed = false
  void tauriListen<T>(eventName, (event) => {
    if (!disposed) {
      callback(event.payload)
    }
  })
    .then((dispose) => {
      if (disposed) {
        dispose()
      } else {
        unlisten = dispose
      }
    })
    .catch((err) => {
      console.error(`[desktop-shell] listen failed: ${eventName}`, err)
    })
  return () => {
    disposed = true
    unlisten?.()
  }
}

const store = localforage.createInstance({ name: 'chatboxstore' })

export default class DesktopPlatform implements Platform {
  public type: PlatformType = 'desktop'
  public formFactor: FormFactor = 'desktop'

  public exporter = new WebExporter()

  private _kbController?: DesktopKnowledgeBaseController
  private _imageGenerationStorage: ImageGenerationStorage | null = null

  public ipc: DesktopIPC
  constructor(ipc: DesktopIPC) {
    this.ipc = ipc
  }

  public getStorageType(): string {
    return 'INDEXEDDB'
  }

  public async getVersion() {
    return cache('ipc:getVersion', () => this.ipc.invoke('getVersion'), { ttl: 5 * 60 * 1000, memoryOnly: true })
  }
  public async getPlatform() {
    return cache('ipc:getPlatform', () => this.ipc.invoke('getPlatform'), { ttl: 5 * 60 * 1000 })
  }
  public async getArch() {
    return cache('ipc:getArch', () => this.ipc.invoke('getArch'), { ttl: 5 * 60 * 1000 })
  }
  public async shouldUseDarkColors(): Promise<boolean> {
    return await this.ipc.invoke('shouldUseDarkColors')
  }
  public onSystemThemeChange(callback: () => void): () => void {
    return this.ipc.onSystemThemeChange(callback)
  }
  public onWindowShow(callback: () => void): () => void {
    return this.ipc.onWindowShow(callback)
  }
  public onWindowFocused(callback: () => void): () => void {
    return this.ipc.onWindowFocused(callback)
  }
  public onUpdateDownloaded(callback: () => void): () => void {
    return this.ipc.onUpdateDownloaded(callback)
  }
  public onNavigate(callback: (path: string) => void): () => void {
    return this.ipc.onNavigate(callback)
  }
  public async openLink(url: string): Promise<void> {
    return this.ipc.invoke('openLink', url)
  }
  public async getDeviceName(): Promise<string> {
    const deviceName = await cache('ipc:getDeviceName', () => this.ipc.invoke('getDeviceName'), {
      ttl: 5 * 60 * 1000,
    })
    return deviceName
  }
  public async getInstanceName(): Promise<string> {
    const deviceName = await this.getDeviceName()
    return `${deviceName} / ${getOS()}`
  }
  public async getLocale() {
    const locale = await cache('ipc:getLocale', () => this.ipc.invoke('getLocale'), { ttl: 5 * 60 * 1000 })
    return parseLocale(locale)
  }
  public async ensureShortcutConfig(config: ShortcutSetting): Promise<void> {
    return this.ipc.invoke('ensureShortcutConfig', JSON.stringify(config))
  }
  public async ensureProxyConfig(config: { proxy?: string }): Promise<void> {
    return this.ipc.invoke('ensureProxy', JSON.stringify(config))
  }
  public async relaunch(): Promise<void> {
    return this.ipc.invoke('relaunch')
  }

  public async getConfig(): Promise<Config> {
    return this.ipc.invoke('getConfig')
  }
  public async getSettings(): Promise<Settings> {
    return this.ipc.invoke('getSettings')
  }

  /**
   * Keys shared across all desktop windows via Tauri disk store.
   * Sessions must be shared so quick chat + main webview stay in sync
   * (each window has its own React Query cache / may partition IndexedDB).
   */
  private needStoreInFile(key: string): boolean {
    return (
      key === 'configs' ||
      key === 'settings' ||
      key === 'configVersion' ||
      key === 'chat-sessions-list' ||
      key.startsWith('session:')
    )
  }

  public async setStoreValue(key: string, value: any) {
    // (legacy comment)
    // (legacy comment)
    let valueJson: string
    try {
      valueJson = JSON.stringify(value)
    } catch (error: any) {
      throw new Error(`Failed to serialize value for key "${key}": ${error.message}`)
    }
    if (this.needStoreInFile(key)) {
      return this.ipc.invoke('setStoreValue', key, valueJson)
    } else {
      await store.setItem(key, valueJson)
    }
  }
  public async getStoreValue(key: string) {
    if (this.needStoreInFile(key)) {
      let value = await this.ipc.invoke('getStoreValue', key)
      // One-time migrate: older builds stored sessions only in IndexedDB
      if ((value === null || value === undefined) && (key.startsWith('session:') || key === 'chat-sessions-list')) {
        const json = await store.getItem<string>(key)
        if (json) {
          try {
            value = typeof json === 'string' ? JSON.parse(json) : json
            await this.ipc.invoke('setStoreValue', key, typeof json === 'string' ? json : JSON.stringify(value))
          } catch (error) {
            console.error(`Failed to migrate stored value for key "${key}":`, error)
          }
        }
      }
      return value ?? null
    } else {
      const json = await store.getItem<string>(key)
      if (!json) return null
      try {
        return JSON.parse(json)
      } catch (error) {
        console.error(`Failed to parse stored value for key "${key}":`, error)
        return null
      }
    }
  }
  public async delStoreValue(key: string) {
    if (this.needStoreInFile(key)) {
      return this.ipc.invoke('delStoreValue', key)
    } else {
      return await store.removeItem(key)
    }
  }
  public async getAllStoreValues(): Promise<{ [key: string]: any }> {
    const ret: { [key: string]: any } = {}
    await store.iterate((json, key) => {
      const value = typeof json === 'string' ? JSON.parse(json) : null
      ret[key] = value
    })
    const json = JSON.parse(await this.ipc.invoke('getAllStoreValues'))
    for (const [key, value] of Object.entries(json)) {
      if (this.needStoreInFile(key)) {
        ret[key] = value
      }
    }
    return ret
  }
  public async getAllStoreKeys(): Promise<string[]> {
    const keys = await store.keys()
    const ipcKeys: string[] = await this.ipc.invoke('getAllStoreKeys')
    return [...keys, ...ipcKeys]
  }
  public async setAllStoreValues(data: { [key: string]: any }): Promise<void> {
    for (const [key, value] of Object.entries(data)) {
      await this.setStoreValue(key, value)
    }
  }

  public async getStoreBlob(key: string): Promise<string | null> {
    return this.ipc.invoke('getStoreBlob', key)
  }
  public async setStoreBlob(key: string, value: string) {
    return this.ipc.invoke('setStoreBlob', key, value)
  }
  public async delStoreBlob(key: string) {
    return this.ipc.invoke('delStoreBlob', key)
  }
  public async listStoreBlobKeys(): Promise<string[]> {
    return this.ipc.invoke('listStoreBlobKeys')
  }

  public initTracking(): void {
    setTimeout(() => {
      this.trackingEvent('user_engagement', {})
    }, 4000) // (legacy)
  }
  public trackingEvent(name: string, params: { [key: string]: string }) {
    const dataJson = JSON.stringify({ name, params })
    this.ipc.invoke('analysticTrackingEvent', dataJson)
  }

  public async shouldShowAboutDialogWhenStartUp(): Promise<boolean> {
    return cache('ipc:shouldShowAboutDialogWhenStartUp', () => this.ipc.invoke('shouldShowAboutDialogWhenStartUp'), {
      ttl: 30 * 1000,
    })
  }

  public async appLog(level: string, message: string) {
    return this.ipc.invoke('appLog', JSON.stringify({ level, message }))
  }

  public async exportLogs(): Promise<string> {
    return this.ipc.invoke('exportLogs')
  }

  public async clearLogs(): Promise<void> {
    return this.ipc.invoke('clearLogs')
  }

  public async ensureAutoLaunch(enable: boolean) {
    return this.ipc.invoke('ensureAutoLaunch', enable)
  }

  async parseFileLocally(file: File): Promise<{ key?: string; isSupported: boolean }> {
    let result: { text: string; isSupported: boolean }
    if (!file.path) {
      // (legacy comment)
      result = await parseTextFileLocally(file)
    } else {
      const resultJSON = await this.ipc.invoke('parseFileLocally', JSON.stringify({ filePath: file.path }))
      result = JSON.parse(resultJSON)
    }
    if (!result.isSupported) {
      return { isSupported: false }
    }
    const key = `parseFile-` + uuidv4()
    await this.setStoreBlob(key, result.text)
    return { key, isSupported: true }
  }

  async parseFileWithMineru(
    file: File,
    apiToken: string
  ): Promise<{ success: boolean; content?: string; error?: string; cancelled?: boolean }> {
    if (!file.path) {
      // Files without path (e.g., pasted files) are not supported for MinerU parsing
      return { success: false, error: 'File path is required for MinerU parsing' }
    }

    return this.ipc.invoke('parser:parse-file-with-mineru', {
      filePath: file.path,
      filename: file.name,
      mimeType: file.type,
      apiToken,
    })
  }

  async cancelMineruParse(filePath: string): Promise<{ success: boolean; error?: string }> {
    return this.ipc.invoke('parser:cancel-mineru-parse', filePath)
  }

  public async parseUrl(url: string): Promise<{ key: string; title: string }> {
    const json = await this.ipc.invoke('parseUrl', url)
    return JSON.parse(json)
  }

  public async isFullscreen() {
    return this.ipc.invoke('isFullscreen')
  }

  public async setFullscreen(enabled: boolean) {
    return this.ipc.invoke('setFullscreen', enabled)
  }

  public async installUpdate() {
    return this.ipc.invoke('install-update')
  }

  public async switchTheme(theme: 'dark' | 'light') {
    return this.ipc.invoke('switch-theme', theme)
  }

  public getKnowledgeBaseController() {
    if (!this._kbController) {
      this._kbController = new DesktopKnowledgeBaseController(this.ipc)
    }
    return this._kbController
  }

  public getImageGenerationStorage(): ImageGenerationStorage {
    if (!this._imageGenerationStorage) {
      this._imageGenerationStorage = new IndexedDBImageGenerationStorage()
    }
    return this._imageGenerationStorage
  }

  public async readFileByPath(path: string): Promise<string> {
    return this.ipc.invoke('fs:read-file', path)
  }

  public async writeFile(path: string, content: string): Promise<void> {
    return this.ipc.invoke('fs:write-file', path, content)
  }

  public async deleteFile(path: string): Promise<void> {
    return this.ipc.invoke('fs:delete-file', path)
  }

  public minimize() {
    return this.ipc.invoke('window:minimize')
  }

  public maximize() {
    return this.ipc.invoke('window:maximize')
  }

  public unmaximize() {
    return this.ipc.invoke('window:unmaximize')
  }

  public closeWindow() {
    return this.ipc.invoke('window:close')
  }

  public isMaximized() {
    return this.ipc.invoke('window:is-maximized')
  }

  public onMaximizedChange(callback: (isMaximized: boolean) => void): () => void {
    const unsubscribe = this.ipc.onWindowMaximizedChanged((_, isMaximized) => {
      callback(isMaximized)
    })

    return unsubscribe
  }

  public async executeCommand(
    command: string,
    cwd?: string,
    timeoutMs?: number
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return this.ipc.invoke('execute_command', JSON.stringify({ command, cwd, timeoutMs }))
  }

  public async setKeepInTray(enabled: boolean): Promise<void> {
    return this.ipc.invoke('shell:setKeepInTray', enabled)
  }

  public async setQuickWindowAlwaysOnTop(enabled: boolean): Promise<void> {
    return this.ipc.invoke('shell:setQuickAlwaysOnTop', enabled)
  }

  public async showQuickWindow(): Promise<void> {
    return this.ipc.invoke('shell:showQuick')
  }

  public async showMainWindow(): Promise<void> {
    return this.ipc.invoke('shell:showMain')
  }

  public async openSessionInMain(sessionId: string): Promise<void> {
    return this.ipc.invoke('shell:openSessionInMain', sessionId)
  }

  public async captureScreenshotRegion(): Promise<ScreenshotImagePayload | null> {
    try {
      return await this.ipc.invoke('shell:captureScreenshot')
    } catch {
      return null
    }
  }

  public async notifyQuickRendererReady(): Promise<void> {
    await this.ipc.invoke('shell:quickRendererReady')
  }

  public async notifyQuickRendererGone(): Promise<void> {
    await this.ipc.invoke('shell:quickRendererGone')
  }

  public async readClipboardImage(): Promise<ScreenshotImagePayload | null> {
    try {
      return await this.ipc.invoke('shell:readClipboardImage')
    } catch {
      return null
    }
  }

  public async getWindowLabel(): Promise<string> {
    try {
      return getCurrentWindow().label
    } catch {
      return 'main'
    }
  }

  public onShellNavigate(callback: (path: string) => void): () => void {
    return listenShellEvent<string>('shell:navigate', (path) => {
      if (typeof path === 'string') {
        callback(path)
      }
    })
  }

  public onScreenshotCaptured(callback: (payload: ScreenshotImagePayload) => void): () => void {
    return listenShellEvent<ScreenshotImagePayload>('shell:screenshot-captured', (payload) => {
      if (payload?.base64) {
        callback(payload)
      }
    })
  }

  public onClipboardCaptured(callback: (payload: ClipboardCapturePayload) => void): () => void {
    return listenShellEvent<ClipboardCapturePayload>('shell:clipboard-captured', (payload) => {
      if (payload?.type === 'text' ? typeof payload.text === 'string' : Boolean(payload?.base64)) {
        callback(payload)
      }
    })
  }

  public onScreenshotError(callback: (message: string) => void): () => void {
    return listenShellEvent<{ message?: string }>('shell:screenshot-error', (payload) => {
      callback(payload?.message || 'Screenshot failed')
    })
  }

  public onHiddenToTray(callback: () => void): () => void {
    return listenShellEvent('shell:hidden-to-tray', () => callback())
  }
}
