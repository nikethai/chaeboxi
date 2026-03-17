// Platform interfaces - ported from src/renderer/platform/interfaces.ts
import type { Config, Language, Settings, ShortcutSetting } from '$shared/types'

export type PlatformType = 'web' | 'desktop' | 'mobile'

export interface Storage {
	getStorageType(): string
	setStoreValue(key: string, value: unknown): Promise<void>
	getStoreValue(key: string): Promise<unknown>
	delStoreValue(key: string): Promise<void>
	getAllStoreValues(): Promise<Record<string, unknown>>
	getAllStoreKeys(): Promise<string[]>
	setAllStoreValues(data: Record<string, unknown>): Promise<void>
}

export interface Platform extends Storage {
	type: PlatformType
	exporter: Exporter
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
	getConfig(): Promise<Config>
	getSettings(): Promise<Settings>
	getStoreBlob(key: string): Promise<string | null>
	setStoreBlob(key: string, value: string): Promise<void>
	delStoreBlob(key: string): Promise<void>
	listStoreBlobKeys(): Promise<string[]>
	initTracking(): void
	trackingEvent(name: string, params: Record<string, string>): void
	shouldShowAboutDialogWhenStartUp(): Promise<boolean>
	appLog(level: string, message: string): Promise<void>
	exportLogs(): Promise<string>
	clearLogs(): Promise<void>
	ensureAutoLaunch(enable: boolean): Promise<void>
	parseFileLocally(file: File): Promise<{ key?: string; isSupported: boolean }>
	parseFileWithMineru?(
		file: File,
		apiToken: string
	): Promise<{ success: boolean; content?: string; error?: string; cancelled?: boolean }>
	cancelMineruParse?(filePath: string): Promise<{ success: boolean; error?: string }>
	isFullscreen(): Promise<boolean>
	setFullscreen(enabled: boolean): Promise<void>
	installUpdate(): Promise<void>
	getKnowledgeBaseController(): unknown
	getImageGenerationStorage(): unknown
	minimize(): Promise<void>
	maximize(): Promise<void>
	unmaximize(): Promise<void>
	closeWindow(): Promise<void>
	isMaximized(): Promise<boolean>
	onMaximizedChange(callback: (isMaximized: boolean) => void): () => void
}

export interface Exporter {
	exportBlob: (filename: string, blob: Blob, encoding?: 'utf8' | 'ascii' | 'utf16') => Promise<void>
	exportTextFile: (filename: string, content: string) => Promise<void>
	exportImageFile: (basename: string, base64: string) => Promise<void>
	exportByUrl: (filename: string, url: string) => Promise<void>
	exportStreamingJson: (
		filename: string,
		dataCallback: () => AsyncGenerator<string, void, unknown>
	) => Promise<void>
}
