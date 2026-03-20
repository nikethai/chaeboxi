import { browser } from '$app/environment'
import { settings as createDefaultSettings } from '$shared/defaults'
import type { Settings } from '$shared/types'

type SettingsListener = () => void

interface RendererSettingsState {
	getSettings(): Settings
	setSettings(nextStateOrUpdater: Partial<Settings> | ((state: Settings) => void)): void
}

interface RendererSettingsStore {
	getState(): RendererSettingsState
	subscribe(listener: () => void): () => void
}

interface RendererSettingsModule {
	loadSettingsRuntime(): Promise<{
		initSettingsStore: () => Promise<Settings>
		settingsStore: RendererSettingsStore
	}>
}

interface RendererSettingsRuntime {
	initSettingsStore(): Promise<Settings>
	settingsStore: RendererSettingsStore
}

class SettingsStore {
	settings = $state<Settings>(createDefaultSettings())
	initialized = $state(false)
	private rendererModule: RendererSettingsRuntime | null = null
	private initializing: Promise<Settings> | null = null
	private unsubscribeRenderer: (() => void) | null = null
	private listeners = new Set<SettingsListener>()

	constructor() {
		if (browser) {
			void this.init()
		}
	}

	subscribe(listener: SettingsListener) {
		this.listeners.add(listener)
		return () => {
			this.listeners.delete(listener)
		}
	}

	private notify() {
		for (const listener of this.listeners) {
			listener()
		}
	}

	private syncFromRenderer() {
		if (!this.rendererModule) {
			return
		}

		this.settings = this.rendererModule.settingsStore.getState().getSettings()
		this.initialized = true
		this.notify()
	}

	async init(): Promise<Settings> {
		if (!browser) {
			return this.settings
		}

		if (this.initialized && this.rendererModule) {
			return this.settings
		}

		if (!this.initializing) {
			this.initializing = (async () => {
				const rendererLoader = (await import('$lib/runtime/renderer-settings.js')) as RendererSettingsModule
				const rendererModule = await rendererLoader.loadSettingsRuntime()
				this.rendererModule = rendererModule
				await rendererModule.initSettingsStore()
				this.syncFromRenderer()

				if (!this.unsubscribeRenderer) {
					this.unsubscribeRenderer = rendererModule.settingsStore.subscribe(() => {
						this.syncFromRenderer()
					})
				}

				return this.settings
			})()
		}

		return this.initializing
	}

	update(nextStateOrUpdater: Partial<Settings> | ((state: Settings) => void)) {
		if (this.rendererModule) {
			this.rendererModule.settingsStore.getState().setSettings(nextStateOrUpdater)
			return
		}

		if (typeof nextStateOrUpdater === 'function') {
			const draft = structuredClone(this.settings)
			nextStateOrUpdater(draft)
			this.settings = draft
			this.notify()
			return
		}

		this.settings = { ...this.settings, ...nextStateOrUpdater }
		this.notify()
	}

	get() {
		return this.settings
	}

	// Helper getters
	get theme() {
		return this.settings.theme
	}

	get language() {
		return this.settings.language
	}

	get shortcuts() {
		return this.settings.shortcuts
	}
}

export const settingsStore = new SettingsStore()
