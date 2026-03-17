// UI Store using Svelte 5 runes
import { browser } from '$app/environment'

interface Toast {
	id: string
	content: string
	duration?: number
}

interface UIState {
	toasts: Toast[]
	showSidebar: boolean
	openSearchDialog: boolean
	openAboutDialog: boolean
	widthFull: boolean
	showCopilotsInNewSession: boolean
	sidebarWidth: number | null
	realTheme: 'light' | 'dark'
}

class UIStore {
	state = $state<UIState>({
		toasts: [],
		showSidebar: true,
		openSearchDialog: false,
		openAboutDialog: false,
		widthFull: false,
		showCopilotsInNewSession: false,
		sidebarWidth: null,
		realTheme: 'light',
	})

	constructor() {
		if (browser) {
			// Load persisted state
			const saved = localStorage.getItem('ui-store')
			if (saved) {
				try {
					const parsed = JSON.parse(saved)
					this.state = { ...this.state, ...parsed }
				} catch (e) {
					console.error('Failed to parse UI store:', e)
				}
			}
			// Detect system theme
			this.state.realTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
			const savedTheme = localStorage.getItem('initial-theme')
			if (savedTheme === 'dark' || savedTheme === 'light') {
				this.state.realTheme = savedTheme
			}
		}
	}

	private save() {
		if (browser) {
			localStorage.setItem(
				'ui-store',
				JSON.stringify({
					widthFull: this.state.widthFull,
					showCopilotsInNewSession: this.state.showCopilotsInNewSession,
					sidebarWidth: this.state.sidebarWidth,
				})
			)
		}
	}

	// Toast management
	addToast(content: string, duration = 3000) {
		const id = `toast:${Date.now()}:${Math.random().toString(36).slice(2)}`
		this.state.toasts = [...this.state.toasts, { id, content, duration }]
		if (duration > 0) {
			setTimeout(() => this.removeToast(id), duration)
		}
	}

	removeToast(id: string) {
		this.state.toasts = this.state.toasts.filter((t) => t.id !== id)
	}

	// Sidebar
	setShowSidebar(show: boolean) {
		this.state.showSidebar = show
	}

	toggleSidebar() {
		this.state.showSidebar = !this.state.showSidebar
	}

	// Search dialog
	setOpenSearchDialog(open: boolean) {
		this.state.openSearchDialog = open
	}

	// About dialog
	setOpenAboutDialog(open: boolean) {
		this.state.openAboutDialog = open
	}

	// Width
	setWidthFull(full: boolean) {
		this.state.widthFull = full
		this.save()
	}

	// Copilots
	setShowCopilotsInNewSession(show: boolean) {
		this.state.showCopilotsInNewSession = show
		this.save()
	}

	// Sidebar width
	setSidebarWidth(width: number | null) {
		this.state.sidebarWidth = width
		this.save()
	}

	// Theme
	setRealTheme(theme: 'light' | 'dark') {
		this.state.realTheme = theme
	}
}

export const uiStore = new UIStore()
