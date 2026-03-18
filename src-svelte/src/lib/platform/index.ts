import { settings as createDefaultSettings, newConfigs } from '$shared/defaults'
import type { Config, Language, Settings, ShortcutSetting } from '$shared/types'
import type { ImageGenerationStorage } from '../../../../src/renderer/storage/ImageGenerationStorage'
import type { KnowledgeBaseController } from '../../../../src/renderer/platform/knowledge-base/interface'
import type { Exporter, Platform } from './interfaces'

type DesktopWindow = Window & {
	desktopAPI?: unknown
	__TAURI__?: unknown
	__TAURI_INTERNALS__?: unknown
}

function canUseDOM() {
	return typeof window !== 'undefined' && typeof document !== 'undefined'
}

function getRuntimeType(): Platform['type'] {
	if (!canUseDOM()) {
		return 'web'
	}

	const runtimeWindow = window as DesktopWindow
	return runtimeWindow.desktopAPI || runtimeWindow.__TAURI__ || runtimeWindow.__TAURI_INTERNALS__ ? 'desktop' : 'web'
}

function createDownload(filename: string, blob: Blob) {
	if (!canUseDOM()) {
		return
	}

	const link = document.createElement('a')
	link.download = filename
	link.style.display = 'none'
	link.href = URL.createObjectURL(blob)
	document.body.appendChild(link)
	link.click()
	document.body.removeChild(link)
}

const exporter: Exporter = {
	async exportBlob(filename, blob) {
		createDownload(filename, blob)
	},
	async exportTextFile(filename, content) {
		createDownload(filename, new Blob([content]))
	},
	async exportImageFile() {
		throw new Error('Image export is not implemented in the Svelte rescue shell.')
	},
	async exportByUrl(filename, url) {
		if (!canUseDOM()) {
			return
		}

		const link = document.createElement('a')
		link.download = filename
		link.style.display = 'none'
		link.href = url
		document.body.appendChild(link)
		link.click()
		document.body.removeChild(link)
	},
	async exportStreamingJson(filename, dataCallback) {
		let content = ''
		const generator = dataCallback()

		for await (const chunk of generator) {
			content += chunk
		}

		createDownload(filename, new Blob([content]))
	},
}

const knowledgeBaseController: KnowledgeBaseController = {
	async list() {
		throw new Error('Knowledge base is not implemented in the Svelte rescue shell.')
	},
	async create() {
		throw new Error('Knowledge base is not implemented in the Svelte rescue shell.')
	},
	async delete() {
		throw new Error('Knowledge base is not implemented in the Svelte rescue shell.')
	},
	async listFiles() {
		throw new Error('Knowledge base is not implemented in the Svelte rescue shell.')
	},
	async countFiles() {
		throw new Error('Knowledge base is not implemented in the Svelte rescue shell.')
	},
	async listFilesPaginated() {
		throw new Error('Knowledge base is not implemented in the Svelte rescue shell.')
	},
	async uploadFile() {
		throw new Error('Knowledge base is not implemented in the Svelte rescue shell.')
	},
	async deleteFile() {
		throw new Error('Knowledge base is not implemented in the Svelte rescue shell.')
	},
	async retryFile() {
		throw new Error('Knowledge base is not implemented in the Svelte rescue shell.')
	},
	async pauseFile() {
		throw new Error('Knowledge base is not implemented in the Svelte rescue shell.')
	},
	async resumeFile() {
		throw new Error('Knowledge base is not implemented in the Svelte rescue shell.')
	},
	async search() {
		throw new Error('Knowledge base is not implemented in the Svelte rescue shell.')
	},
	async update() {
		throw new Error('Knowledge base is not implemented in the Svelte rescue shell.')
	},
	async getFilesMeta() {
		throw new Error('Knowledge base is not implemented in the Svelte rescue shell.')
	},
	async readFileChunks() {
		throw new Error('Knowledge base is not implemented in the Svelte rescue shell.')
	},
	async testMineruConnection() {
		throw new Error('Knowledge base is not implemented in the Svelte rescue shell.')
	},
}

const imageGenerationStorage: ImageGenerationStorage = {
	async initialize() {},
	async create() {
		throw new Error('Image generation storage is not implemented in the Svelte rescue shell.')
	},
	async update() {
		throw new Error('Image generation storage is not implemented in the Svelte rescue shell.')
	},
	async getById() {
		throw new Error('Image generation storage is not implemented in the Svelte rescue shell.')
	},
	async delete() {
		throw new Error('Image generation storage is not implemented in the Svelte rescue shell.')
	},
	async getPage() {
		throw new Error('Image generation storage is not implemented in the Svelte rescue shell.')
	},
	async getTotal() {
		throw new Error('Image generation storage is not implemented in the Svelte rescue shell.')
	},
}

function createMediaQueryListener(callback: () => void) {
	if (!canUseDOM() || !window.matchMedia) {
		return () => undefined
	}

	const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
	const listener = () => callback()
	mediaQuery.addEventListener('change', listener)

	return () => {
		mediaQuery.removeEventListener('change', listener)
	}
}

const platform: Platform = {
	get type() {
		return getRuntimeType()
	},
	exporter,
	getStorageType() {
		return 'LOCAL_STORAGE'
	},
	async setStoreValue(key: string, value: unknown) {
		if (canUseDOM()) {
			localStorage.setItem(key, JSON.stringify(value))
		}
	},
	async getStoreValue(key: string) {
		if (!canUseDOM()) {
			return null
		}

		const value = localStorage.getItem(key)
		return value ? JSON.parse(value) : null
	},
	async delStoreValue(key: string) {
		if (canUseDOM()) {
			localStorage.removeItem(key)
		}
	},
	async getAllStoreValues() {
		if (!canUseDOM()) {
			return {}
		}

		return Object.fromEntries(Object.keys(localStorage).map((key) => [key, JSON.parse(localStorage.getItem(key) || 'null')]))
	},
	async getAllStoreKeys() {
		return canUseDOM() ? Object.keys(localStorage) : []
	},
	async setAllStoreValues(data: { [key: string]: unknown }) {
		for (const [key, value] of Object.entries(data)) {
			await this.setStoreValue(key, value)
		}
	},
	async getVersion() {
		return 'svelte'
	},
	async getPlatform() {
		return this.type
	},
	async getArch() {
		return 'unknown'
	},
	async shouldUseDarkColors() {
		return canUseDOM() && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : false
	},
	onSystemThemeChange(callback: () => void) {
		return createMediaQueryListener(callback)
	},
	onWindowShow() {
		return () => undefined
	},
	onWindowFocused() {
		return () => undefined
	},
	onUpdateDownloaded() {
		return () => undefined
	},
	onNavigate() {
		return () => undefined
	},
	async openLink(url: string) {
		if (canUseDOM()) {
			window.open(url, '_blank', 'noopener,noreferrer')
		}
	},
	async getDeviceName() {
		return 'browser'
	},
	async getInstanceName() {
		return 'svelte-shell'
	},
	async getLocale() {
		if (!canUseDOM()) {
			return 'en'
		}

		return (window.navigator.language || 'en') as Language
	},
	async ensureShortcutConfig(_config: ShortcutSetting) {},
	async ensureProxyConfig(_config: { proxy?: string }) {},
	async relaunch() {
		if (canUseDOM()) {
			window.location.reload()
		}
	},
	async getConfig(): Promise<Config> {
		return newConfigs()
	},
	async getSettings(): Promise<Settings> {
		return createDefaultSettings()
	},
	async getStoreBlob(key: string) {
		return (await this.getStoreValue(`blob:${key}`)) as string | null
	},
	async setStoreBlob(key: string, value: string) {
		await this.setStoreValue(`blob:${key}`, value)
	},
	async delStoreBlob(key: string) {
		await this.delStoreValue(`blob:${key}`)
	},
	async listStoreBlobKeys() {
		const keys = await this.getAllStoreKeys()
		return keys.filter((key) => key.startsWith('blob:'))
	},
	initTracking() {},
	trackingEvent() {},
	async shouldShowAboutDialogWhenStartUp() {
		return false
	},
	async appLog() {},
	async exportLogs() {
		return ''
	},
	async clearLogs() {},
	async ensureAutoLaunch() {},
	async parseFileLocally() {
		return { isSupported: false }
	},
	async parseFileWithMineru() {
		return { success: false, error: 'Not implemented' }
	},
	async cancelMineruParse() {
		return { success: false, error: 'Not implemented' }
	},
	async isFullscreen() {
		return canUseDOM() ? Boolean(document.fullscreenElement) : false
	},
	async setFullscreen(enabled: boolean) {
		if (!canUseDOM()) {
			return
		}

		if (enabled) {
			await document.documentElement.requestFullscreen?.()
		} else {
			await document.exitFullscreen?.()
		}
	},
	async installUpdate() {
		throw new Error('App update install is not implemented in the Svelte rescue shell.')
	},
	getKnowledgeBaseController() {
		return knowledgeBaseController
	},
	getImageGenerationStorage() {
		return imageGenerationStorage
	},
	async minimize() {},
	async maximize() {},
	async unmaximize() {},
	async closeWindow() {
		if (canUseDOM()) {
			window.close()
		}
	},
	async isMaximized() {
		return false
	},
	onMaximizedChange() {
		return () => undefined
	},
}

export default platform
