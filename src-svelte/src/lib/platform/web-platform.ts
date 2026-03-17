// Web Platform for Svelte
import type { Platform, PlatformType, Exporter } from './interfaces'

class WebExporter implements Exporter {
	async exportBlob(filename: string, blob: Blob): Promise<void> {
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

export default class WebPlatform implements Platform {
	type: PlatformType = 'web'
	exporter = new WebExporter()

	getStorageType(): string {
		return 'LOCALSTORAGE'
	}

	async getVersion(): Promise<string> {
		return 'web'
	}

	async getPlatform(): Promise<string> {
		return 'web'
	}

	async getArch(): Promise<string> {
		return navigator.platform
	}

	async shouldUseDarkColors(): Promise<boolean> {
		return window.matchMedia('(prefers-color-scheme: dark)').matches
	}

	onSystemThemeChange(callback: () => void): () => void {
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
		mediaQuery.addEventListener('change', callback)
		return () => mediaQuery.removeEventListener('change', callback)
	}

	onWindowShow(callback: () => void): () => void {
		window.addEventListener('show', callback)
		return () => window.removeEventListener('show', callback)
	}

	onWindowFocused(callback: () => void): () => void {
		window.addEventListener('focus', callback)
		return () => window.removeEventListener('focus', callback)
	}

	onUpdateDownloaded(callback: () => void): () => void {
		return () => {}
	}

	async openLink(url: string): Promise<void> {
		window.open(url, '_blank')
	}

	async getDeviceName(): Promise<string> {
		return 'Web'
	}

	async getInstanceName(): Promise<string> {
		return `Web / ${navigator.platform}`
	}

	async getLocale(): Promise<string> {
		return navigator.language
	}

	async ensureShortcutConfig(): Promise<void> {}

	async ensureProxyConfig(): Promise<void> {}

	async relaunch(): Promise<void> {
		window.location.reload()
	}

	async getConfig(): Promise<unknown> {
		return null
	}

	async getSettings(): Promise<unknown> {
		return null
	}

	async setStoreValue(key: string, value: unknown): Promise<void> {
		localStorage.setItem(key, JSON.stringify(value))
	}

	async getStoreValue(key: string): Promise<unknown> {
		const item = localStorage.getItem(key)
		return item ? JSON.parse(item) : null
	}

	async delStoreValue(key: string): Promise<void> {
		localStorage.removeItem(key)
	}

	async getAllStoreValues(): Promise<Record<string, unknown>> {
		const result: Record<string, unknown> = {}
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i)
			if (key) {
				result[key] = JSON.parse(localStorage.getItem(key) || 'null')
			}
		}
		return result
	}

	async getAllStoreKeys(): Promise<string[]> {
		return Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i) || '')
	}

	async setAllStoreValues(data: Record<string, unknown>): Promise<void> {
		for (const [key, value] of Object.entries(data)) {
			localStorage.setItem(key, JSON.stringify(value))
		}
	}

	async getStoreBlob(): Promise<string | null> {
		return null
	}

	async setStoreBlob(): Promise<void> {}

	async delStoreBlob(): Promise<void> {}

	async listStoreBlobKeys(): Promise<string[]> {
		return []
	}

	initTracking(): void {}

	trackingEvent(name: string, params: Record<string, string>): void {
		console.log('[tracking]', name, params)
	}

	async shouldShowAboutDialogWhenStartUp(): Promise<boolean> {
		return false
	}

	async appLog(): Promise<void> {}

	async exportLogs(): Promise<string> {
		return ''
	}

	async clearLogs(): Promise<void> {}

	async ensureAutoLaunch(): Promise<void> {}

	async parseFileLocally(file: File): Promise<{ key?: string; isSupported: boolean }> {
		const supportedExtensions = ['.txt', '.md', '.json', '.html', '.css', '.js', '.ts']
		const ext = '.' + file.name.split('.').pop()?.toLowerCase()
		return { isSupported: supportedExtensions.includes(ext) }
	}

	async isFullscreen(): Promise<boolean> {
		return Boolean(document.fullscreenElement)
	}

	async setFullscreen(enabled: boolean): Promise<void> {
		if (enabled) {
			await document.documentElement.requestFullscreen()
		} else {
			await document.exitFullscreen()
		}
	}

	async installUpdate(): Promise<void> {}

	getKnowledgeBaseController(): unknown {
		return null
	}

	getImageGenerationStorage(): unknown {
		return null
	}

	async minimize(): Promise<void> {}

	async maximize(): Promise<void> {}

	async unmaximize(): Promise<void> {}

	async closeWindow(): Promise<void> {}

	async isMaximized(): Promise<boolean> {
		return false
	}

	onMaximizedChange(): () => void {
		return () => {}
	}
}
