// Desktop Platform for Svelte - uses @tauri-apps/api
import type { DesktopAPI } from './desktop-api'
import type { Platform, PlatformType, Exporter } from './interfaces'
import { createTauriIPCAdapter, isTauriRuntime } from './tauri-ipc-adapter'

// Simple web exporter for desktop
class DesktopExporter implements Exporter {
	async exportBlob(filename: string, blob: Blob, encoding?: 'utf8' | 'ascii' | 'utf16'): Promise<void> {
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = filename
		a.click()
		URL.revokeObjectURL(url)
	}

	async exportTextFile(filename: string, content: string): Promise<void> {
		const blob = new Blob([content], { type: 'text/plain' })
		await this.exportBlob(filename, blob)
	}

	async exportImageFile(basename: string, base64: string): Promise<void> {
		const byteCharacters = atob(base64)
		const byteNumbers = new Array(byteCharacters.length)
		for (let i = 0; i < byteCharacters.length; i++) {
			byteNumbers[i] = byteCharacters.charCodeAt(i)
		}
		const byteArray = new Uint8Array(byteNumbers)
		const blob = new Blob([byteArray], { type: 'image/png' })
		await this.exportBlob(basename, blob)
	}

	async exportByUrl(filename: string, url: string): Promise<void> {
		const a = document.createElement('a')
		a.href = url
		a.download = filename
		a.click()
	}

	async exportStreamingJson(
		filename: string,
		dataCallback: () => AsyncGenerator<string, void, unknown>
	): Promise<void> {
		let content = ''
		for await (const chunk of dataCallback()) {
			content += chunk
		}
		await this.exportTextFile(filename, content)
	}
}

export default class DesktopPlatform implements Platform {
	type: PlatformType = 'desktop'
	exporter = new DesktopExporter()
	private ipc: DesktopAPI

	constructor(ipc?: DesktopAPI) {
		this.ipc = ipc || (isTauriRuntime() ? createTauriIPCAdapter() : createTauriIPCAdapter())
	}

	async invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
		return this.ipc.invoke(channel, ...args) as Promise<T>
	}

	getStorageType(): string {
		return 'INDEXEDDB'
	}

	async getVersion(): Promise<string> {
		return this.invoke('getVersion')
	}

	async getPlatform(): Promise<string> {
		return this.invoke('getPlatform')
	}

	async getArch(): Promise<string> {
		return this.invoke('getArch')
	}

	async shouldUseDarkColors(): Promise<boolean> {
		return this.invoke('shouldUseDarkColors')
	}

	onSystemThemeChange(callback: () => void): () => void {
		// @ts-expect-error - Tauri runtime check
		if (window.__TAURI__) {
			// @ts-expect-error - Tauri event listener
			return window.__TAURI__.event.listen('system-theme-changed', callback) as unknown as () => void
		}
		return () => {}
	}

	onWindowShow(callback: () => void): () => void {
		return this.ipc.onWindowShow(callback)
	}

	onWindowFocused(callback: () => void): () => void {
		return this.ipc.onWindowFocused(callback)
	}

	onUpdateDownloaded(callback: () => void): () => void {
		return this.ipc.onUpdateDownloaded(callback)
	}

	onNavigate(callback: (path: string) => void): () => void {
		return this.ipc.onNavigate(callback)
	}

	async openLink(url: string): Promise<void> {
		return this.invoke('openLink', url)
	}

	async getDeviceName(): Promise<string> {
		return this.invoke('getDeviceName')
	}

	async getInstanceName(): Promise<string> {
		const deviceName = await this.getDeviceName()
		return `${deviceName} / ${navigator.platform}`
	}

	async getLocale(): Promise<string> {
		return this.invoke('getLocale')
	}

	async ensureShortcutConfig(config: unknown): Promise<void> {
		return this.invoke('ensureShortcutConfig', JSON.stringify(config))
	}

	async ensureProxyConfig(config: { proxy?: string }): Promise<void> {
		return this.invoke('ensureProxy', JSON.stringify(config))
	}

	async relaunch(): Promise<void> {
		return this.invoke('relaunch')
	}

	async getConfig(): Promise<unknown> {
		return this.invoke('getConfig')
	}

	async getSettings(): Promise<unknown> {
		return this.invoke('getSettings')
	}

	async setStoreValue(key: string, value: unknown): Promise<void> {
		return this.invoke('setStoreValue', key, JSON.stringify(value))
	}

	async getStoreValue(key: string): Promise<unknown> {
		return this.invoke('getStoreValue', key)
	}

	async delStoreValue(key: string): Promise<void> {
		return this.invoke('delStoreValue', key)
	}

	async getAllStoreValues(): Promise<Record<string, unknown>> {
		return this.invoke('getAllStoreValues')
	}

	async getAllStoreKeys(): Promise<string[]> {
		return this.invoke('getAllStoreKeys')
	}

	async setAllStoreValues(data: Record<string, unknown>): Promise<void> {
		return this.invoke('setAllStoreValues', JSON.stringify(data))
	}

	async getStoreBlob(key: string): Promise<string | null> {
		return this.invoke('getStoreBlob', key)
	}

	async setStoreBlob(key: string, value: string): Promise<void> {
		return this.invoke('setStoreBlob', key, value)
	}

	async delStoreBlob(key: string): Promise<void> {
		return this.invoke('delStoreBlob', key)
	}

	async listStoreBlobKeys(): Promise<string[]> {
		return this.invoke('listStoreBlobKeys')
	}

	initTracking(): void {
		// Tracking implementation
	}

	trackingEvent(name: string, params: Record<string, string>): void {
		console.log('[tracking]', name, params)
	}

	async shouldShowAboutDialogWhenStartUp(): Promise<boolean> {
		return this.invoke('shouldShowAboutDialogWhenStartUp')
	}

	async appLog(level: string, message: string): Promise<void> {
		return this.invoke('appLog', level, message)
	}

	async exportLogs(): Promise<string> {
		return this.invoke('exportLogs')
	}

	async clearLogs(): Promise<void> {
		return this.invoke('clearLogs')
	}

	async ensureAutoLaunch(enable: boolean): Promise<void> {
		return this.invoke('ensureAutoLaunch', enable)
	}

	async parseFileLocally(file: File): Promise<{ key?: string; isSupported: boolean }> {
		// Basic file parsing
		const supportedExtensions = ['.txt', '.md', '.json', '.html', '.css', '.js', '.ts']
		const ext = '.' + file.name.split('.').pop()?.toLowerCase()
		return {
			isSupported: supportedExtensions.includes(ext),
		}
	}

	async isFullscreen(): Promise<boolean> {
		return this.invoke('isFullscreen')
	}

	async setFullscreen(enabled: boolean): Promise<void> {
		return this.invoke('setFullscreen', enabled)
	}

	async installUpdate(): Promise<void> {
		return this.invoke('installUpdate')
	}

	getKnowledgeBaseController(): unknown {
		return null
	}

	getImageGenerationStorage(): unknown {
		return null
	}

	async minimize(): Promise<void> {
		return this.invoke('minimize')
	}

	async maximize(): Promise<void> {
		return this.invoke('maximize')
	}

	async unmaximize(): Promise<void> {
		return this.invoke('unmaximize')
	}

	async closeWindow(): Promise<void> {
		return this.invoke('closeWindow')
	}

	async isMaximized(): Promise<boolean> {
		return this.invoke('isMaximized')
	}

	onMaximizedChange(callback: (isMaximized: boolean) => void): () => void {
		return this.ipc.onWindowMaximizedChanged((_event, isMaximized) => callback(isMaximized))
	}
}
