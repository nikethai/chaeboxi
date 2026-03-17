// Theme store using Svelte 5 runes
import { browser } from '$app/environment'

type Theme = 'light' | 'dark' | 'system'

class ThemeStore {
	theme = $state<Theme>('system')
	resolvedTheme = $state<'light' | 'dark'>('light')

	constructor() {
		if (browser) {
			const saved = localStorage.getItem('initial-theme') as Theme | null
			if (saved === 'light' || saved === 'dark') {
				this.theme = saved
			} else if (saved === 'system') {
				this.theme = 'system'
			}
			this.updateResolvedTheme()
		}
	}

	private updateResolvedTheme() {
		if (this.theme === 'system') {
			this.resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
		} else {
			this.resolvedTheme = this.theme
		}
		this.applyTheme()
	}

	private applyTheme() {
		if (!browser) return
		document.documentElement.setAttribute('data-theme', this.resolvedTheme)
		if (this.resolvedTheme === 'dark') {
			document.documentElement.classList.add('dark')
		} else {
			document.documentElement.classList.remove('dark')
		}
	}

	setTheme(newTheme: Theme) {
		this.theme = newTheme
		if (browser) {
			localStorage.setItem('initial-theme', newTheme)
		}
		this.updateResolvedTheme()
	}

	toggle() {
		this.setTheme(this.resolvedTheme === 'dark' ? 'light' : 'dark')
	}
}

export const themeStore = new ThemeStore()
