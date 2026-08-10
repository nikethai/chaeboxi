/** biome-ignore-all lint/suspicious/noExplicitAny: <any> */
import type { Config, Language, Settings, ShortcutSetting } from '@shared/types'
import type { ImageGenerationStorage } from '@/storage/ImageGenerationStorage'
import type { KnowledgeBaseController } from './knowledge-base/interface'

export type PlatformType = 'web' | 'desktop' | 'mobile'

export type FormFactor = 'desktop' | 'mobile'

export interface Storage {
  getStorageType(): string
  setStoreValue(key: string, value: any): Promise<void>
  getStoreValue(key: string): Promise<any>
  delStoreValue(key: string): Promise<void>
  getAllStoreValues(): Promise<{ [key: string]: any }>
  getAllStoreKeys(): Promise<string[]>
  setAllStoreValues(data: { [key: string]: any }): Promise<void>
}

export interface Platform extends Storage {
  type: PlatformType
  formFactor: FormFactor

  exporter: Exporter

  // (legacy comment removed)

  getVersion(): Promise<string>
  getPlatform(): Promise<string>
  getArch(): Promise<string>
  shouldUseDarkColors(): Promise<boolean>
  onSystemThemeChange(callback: () => void): () => void
  onWindowShow(callback: () => void): () => void
  onWindowFocused(callback: () => void): () => void
  onUpdateDownloaded(callback: () => void): () => void
  onNavigate?(callback: (path: string) => void): () => void
  openLink(url: string): Promise<void>
  getDeviceName(): Promise<string>
  getInstanceName(): Promise<string>
  getLocale(): Promise<Language>
  ensureShortcutConfig(config: ShortcutSetting): Promise<void>
  ensureProxyConfig(config: { proxy?: string }): Promise<void>
  relaunch(): Promise<void>

  // (legacy comment removed)

  getConfig(): Promise<Config>
  getSettings(): Promise<Settings>

  // Blob

  getStoreBlob(key: string): Promise<string | null>
  setStoreBlob(key: string, value: string): Promise<void>
  delStoreBlob(key: string): Promise<void>
  listStoreBlobKeys(): Promise<string[]>

  // (legacy comment removed)

  initTracking(): void
  trackingEvent(name: string, params: { [key: string]: string }): void

  // (legacy comment removed)
  shouldShowAboutDialogWhenStartUp(): Promise<boolean>

  appLog(level: string, message: string): Promise<void>

  // (legacy comment removed)
  exportLogs(): Promise<string> // (legacy)
  clearLogs(): Promise<void> // (legacy)

  ensureAutoLaunch(enable: boolean): Promise<void>

  parseFileLocally(file: File): Promise<{ key?: string; isSupported: boolean }>

  // Parse file using MinerU service (Desktop only)
  parseFileWithMineru?(
    file: File,
    apiToken: string
  ): Promise<{ success: boolean; content?: string; error?: string; cancelled?: boolean }>

  // Cancel MinerU parsing task (Desktop only)
  cancelMineruParse?(filePath: string): Promise<{ success: boolean; error?: string }>

  // parseUrl(url: string): Promise<{ key: string, title: string }>

  isFullscreen(): Promise<boolean>
  setFullscreen(enabled: boolean): Promise<void>
  installUpdate(): Promise<void>

  getKnowledgeBaseController(): KnowledgeBaseController

  getImageGenerationStorage(): ImageGenerationStorage

  // Filesystem operations (real filesystem, not blob storage)

  readFileByPath(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  deleteFile(path: string): Promise<void>

  // window controls
  minimize(): Promise<void>

  maximize(): Promise<void>

  unmaximize(): Promise<void>

  closeWindow(): Promise<void>

  isMaximized(): Promise<boolean>

  onMaximizedChange(callback: (isMaximized: boolean) => void): () => void

  // Desktop shell (tray / quick window / screenshot) — desktop only
  setKeepInTray?(enabled: boolean): Promise<void>
  setQuickWindowAlwaysOnTop?(enabled: boolean): Promise<void>
  showQuickWindow?(): Promise<void>
  showMainWindow?(): Promise<void>
  openSessionInMain?(sessionId: string): Promise<void>
  captureScreenshotRegion?(): Promise<ScreenshotImagePayload | null>
  readClipboardImage?(): Promise<ScreenshotImagePayload | null>
  notifyQuickRendererReady?(): Promise<void>
  notifyQuickRendererGone?(): Promise<void>
  getWindowLabel?(): Promise<string>
  onQuickShown?(callback: () => void): () => void
  onShellNavigate?(callback: (path: string) => void): () => void
  onScreenshotCaptured?(callback: (payload: ScreenshotImagePayload) => void): () => void
  onClipboardCaptured?(callback: (payload: ClipboardCapturePayload) => void): () => void
  onScreenshotError?(callback: (message: string) => void): () => void
  onHiddenToTray?(callback: () => void): () => void

  // Terminal command execution (Desktop only)
  executeCommand?(
    command: string,
    cwd?: string,
    timeoutMs?: number
  ): Promise<{ exitCode: number; stdout: string; stderr: string }>
}

export type ScreenshotImagePayload = {
  mimeType: string
  base64: string
  fileName: string
}
export type ClipboardCapturePayload = { type: 'text'; text: string } | ({ type: 'image' } & ScreenshotImagePayload)

export interface Exporter {
  exportBlob: (filename: string, blob: Blob, encoding?: 'utf8' | 'ascii' | 'utf16') => Promise<void>
  exportTextFile: (filename: string, content: string) => Promise<void>
  exportImageFile: (basename: string, base64: string) => Promise<void>
  exportByUrl: (filename: string, url: string) => Promise<void>
  exportStreamingJson: (filename: string, dataCallback: () => AsyncGenerator<string, void, unknown>) => Promise<void>
}
