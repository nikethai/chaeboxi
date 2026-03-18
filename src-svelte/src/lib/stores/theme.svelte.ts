import { browser } from '$app/environment'
import { Theme } from '$shared/types'
import platform from '$lib/platform'
import { settingsStore } from './settings.svelte'
import { uiStore } from './ui.svelte'

class ThemeStore {
	theme = $state<Theme>(Theme.System)
	resolvedTheme = $state<'light' | 'dark'>('light')
	private initialized = false
	private unsubscribeSettings: (() => void) | null = null
	private unsubscribeSystemTheme: (() => void) | null = null

	constructor() {
		if (browser) {
			void this.init()
		}
	}

	async init() {
		if (!browser || this.initialized) {
			return
		}

		await Promise.all([settingsStore.init(), uiStore.init()])
		this.theme = settingsStore.settings.theme
		await this.updateResolvedTheme()

		if (!this.unsubscribeSettings) {
			this.unsubscribeSettings = settingsStore.subscribe(() => {
				this.theme = settingsStore.settings.theme
				void this.updateResolvedTheme()
			})
		}

		if (!this.unsubscribeSystemTheme) {
			this.unsubscribeSystemTheme = platform.onSystemThemeChange(() => {
				if (this.theme === Theme.System) {
					void this.updateResolvedTheme()
				}
			})
		}

		this.initialized = true
	}

	private async updateResolvedTheme() {
		if (this.theme === Theme.Dark) {
			this.resolvedTheme = 'dark'
		} else if (this.theme === Theme.Light) {
			this.resolvedTheme = 'light'
		} else {
			this.resolvedTheme = (await platform.shouldUseDarkColors()) ? 'dark' : 'light'
		}

		this.applyTheme()
	}

	private applyTheme() {
		if (!browser) return
		document.documentElement.setAttribute('data-theme', this.resolvedTheme)
		document.documentElement.classList.toggle('dark', this.resolvedTheme === 'dark')
		uiStore.setRealTheme(this.resolvedTheme)
	}

	setTheme(newTheme: Theme) {
		this.theme = newTheme
		settingsStore.update({ theme: newTheme })
		void this.updateResolvedTheme()
	}

	toggle() {
		this.setTheme(this.resolvedTheme === 'dark' ? Theme.Light : Theme.Dark)
	}
}

export const themeStore = new ThemeStore()
