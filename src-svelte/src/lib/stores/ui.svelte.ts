import { browser } from '$app/environment'
import type { KnowledgeBase } from '$shared/types'

interface UIState {
	showSidebar: boolean
	widthFull: boolean
	showCopilotsInNewSession: boolean
	sidebarWidth: number | null
	realTheme: 'light' | 'dark'
	sessionWebBrowsingMap: Record<string, boolean | undefined>
	newSessionState: {
		knowledgeBase?: Pick<KnowledgeBase, 'id' | 'name'>
		webBrowsing?: boolean
	}
}

interface RendererUIState extends UIState {
	setShowSidebar(showSidebar: boolean): void
	setWidthFull(widthFull: boolean): void
	setShowCopilotsInNewSession(showCopilotsInNewSession: boolean): void
	setSidebarWidth(sidebarWidth: number | null): void
}

interface RendererUIStore {
	getState(): RendererUIState
	subscribe(listener: () => void): () => void
	setState(partial: Partial<UIState>): void
}

interface RendererUIModule {
	loadUIRuntime(): Promise<{
		uiStore: RendererUIStore
	}>
}

interface RendererUIRuntime {
	uiStore: RendererUIStore
}

class UIStore {
	state = $state<UIState>({
		showSidebar: true,
		widthFull: false,
		showCopilotsInNewSession: false,
		sidebarWidth: null,
		realTheme: 'light',
		sessionWebBrowsingMap: {},
		newSessionState: {},
	})
	initialized = $state(false)
	private rendererModule: RendererUIRuntime | null = null
	private initializing: Promise<UIState> | null = null
	private unsubscribeRenderer: (() => void) | null = null

	constructor() {
		if (browser) {
			void this.init()
		}
	}

	private syncFromRenderer() {
		if (!this.rendererModule) {
			return
		}

		const state = this.rendererModule.uiStore.getState()
		this.state.showSidebar = state.showSidebar
		this.state.widthFull = state.widthFull
		this.state.showCopilotsInNewSession = state.showCopilotsInNewSession
		this.state.sidebarWidth = state.sidebarWidth
		this.state.realTheme = state.realTheme
		this.state.sessionWebBrowsingMap = { ...state.sessionWebBrowsingMap }
		this.state.newSessionState = { ...state.newSessionState }
		this.initialized = true
	}

	async init(): Promise<UIState> {
		if (!browser) {
			return this.state
		}

		if (this.initialized && this.rendererModule) {
			return this.state
		}

		if (!this.initializing) {
			this.initializing = (async () => {
				const rendererLoader = (await import('$lib/runtime/renderer-ui.js')) as RendererUIModule
				const rendererModule = await rendererLoader.loadUIRuntime()
				this.rendererModule = rendererModule
				this.syncFromRenderer()

				if (!this.unsubscribeRenderer) {
					this.unsubscribeRenderer = rendererModule.uiStore.subscribe(() => {
						this.syncFromRenderer()
					})
				}

				return this.state
			})()
		}

		return this.initializing
	}

	setShowSidebar(showSidebar: boolean) {
		if (this.rendererModule) {
			this.rendererModule.uiStore.getState().setShowSidebar(showSidebar)
			return
		}
		this.state.showSidebar = showSidebar
	}

	toggleSidebar() {
		this.setShowSidebar(!this.state.showSidebar)
	}

	setWidthFull(widthFull: boolean) {
		if (this.rendererModule) {
			this.rendererModule.uiStore.getState().setWidthFull(widthFull)
			return
		}
		this.state.widthFull = widthFull
	}

	setShowCopilotsInNewSession(show: boolean) {
		if (this.rendererModule) {
			this.rendererModule.uiStore.getState().setShowCopilotsInNewSession(show)
			return
		}
		this.state.showCopilotsInNewSession = show
	}

	setSidebarWidth(width: number | null) {
		if (this.rendererModule) {
			this.rendererModule.uiStore.getState().setSidebarWidth(width)
			return
		}
		this.state.sidebarWidth = width
	}

	setRealTheme(theme: 'light' | 'dark') {
		if (this.rendererModule) {
			this.rendererModule.uiStore.setState({ realTheme: theme })
		}
		this.state.realTheme = theme
	}
}

export const uiStore = new UIStore()
