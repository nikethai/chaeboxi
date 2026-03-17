// Settings store using Svelte 5 runes - simplified version
import { browser } from '$app/environment'

// Default settings (simplified - port from defaults.ts as needed)
export interface Settings {
	theme: 'light' | 'dark' | 'system'
	language: string
	fontSize: number
	showWordCount: boolean
	showTokenCount: boolean
	showTokenUsed: boolean
	showModelName: boolean
	showMessageTimestamp: boolean
	showFirstTokenLatency: boolean
	userAvatarKey: string
	defaultAssistantAvatarKey: string
	defaultPrompt: string
	allowReportingAndTracking: boolean
	enableMarkdownRendering: boolean
	enableLaTeXRendering: boolean
	enableMermaidRendering: boolean
	injectDefaultMetadata: boolean
	autoPreviewArtifacts: boolean
	autoCollapseCodeBlock: boolean
	pasteLongTextAsAFile: boolean
	autoGenerateTitle: boolean
	autoCompaction: boolean
	compactionThreshold: number
	autoLaunch: boolean
	autoUpdate: boolean
	betaUpdate: boolean
	spellCheck: boolean
	shortcuts: {
		quickToggle: string
		inputBoxFocus: string
		inputBoxWebBrowsingMode: string
		newChat: string
		newPictureChat: string
		sessionListNavNext: string
		sessionListNavPrev: string
		sessionListNavTargetIndex: string
		messageListRefreshContext: string
		dialogOpenSearch: string
		inputBoxSendMessage: string
		inputBoxSendMessageWithoutResponse: string
		optionNavUp: string
		optionNavDown: string
		optionSelect: string
	}
	extension: {
		webSearch: {
			provider: string
			serperApiKey: string
			googleApiKey: string
			googleCseId: string
			tavilyApiKey: string
		}
		knowledgeBase: {
			models: {
				embedding?: string
				rerank?: string
			}
		}
		historySync: {
			enabled: boolean
			endpoint: string
			token: string
			autoSync: boolean
			intervalSeconds: number
		}
		documentParser: {
			type: 'none' | 'local' | 'chatbox-ai' | 'mineru'
			mineru?: {
				apiToken: string
			}
		}
	}
	mcp: {
		servers: unknown[]
		enabledBuiltinServers: string[]
	}
}

const defaultSettings: Settings = {
	theme: 'system',
	language: 'en',
	fontSize: 14,
	showWordCount: false,
	showTokenCount: false,
	showTokenUsed: true,
	showModelName: true,
	showMessageTimestamp: false,
	showFirstTokenLatency: false,
	userAvatarKey: '',
	defaultAssistantAvatarKey: '',
	defaultPrompt: 'You are a helpful assistant.',
	allowReportingAndTracking: true,
	enableMarkdownRendering: true,
	enableLaTeXRendering: true,
	enableMermaidRendering: true,
	injectDefaultMetadata: true,
	autoPreviewArtifacts: false,
	autoCollapseCodeBlock: true,
	pasteLongTextAsAFile: true,
	autoGenerateTitle: true,
	autoCompaction: true,
	compactionThreshold: 0.6,
	autoLaunch: false,
	autoUpdate: true,
	betaUpdate: false,
	spellCheck: true,
	shortcuts: {
		quickToggle: 'Alt+`',
		inputBoxFocus: 'mod+i',
		inputBoxWebBrowsingMode: 'mod+e',
		newChat: 'mod+n',
		newPictureChat: 'mod+shift+n',
		sessionListNavNext: 'mod+tab',
		sessionListNavPrev: 'mod+shift+tab',
		sessionListNavTargetIndex: 'mod',
		messageListRefreshContext: 'mod+r',
		dialogOpenSearch: 'mod+k',
		inputBoxSendMessage: 'Enter',
		inputBoxSendMessageWithoutResponse: 'Ctrl+Enter',
		optionNavUp: 'up',
		optionNavDown: 'down',
		optionSelect: 'enter',
	},
	extension: {
		webSearch: {
			provider: 'bing',
			serperApiKey: '',
			googleApiKey: '',
			googleCseId: '',
			tavilyApiKey: '',
		},
		knowledgeBase: {
			models: {
				embedding: undefined,
				rerank: undefined,
			},
		},
		historySync: {
			enabled: false,
			endpoint: '',
			token: '',
			autoSync: false,
			intervalSeconds: 60,
		},
		documentParser: {
			type: 'local',
		},
	},
	mcp: {
		servers: [],
		enabledBuiltinServers: [],
	},
}

class SettingsStore {
	settings = $state<Settings>(defaultSettings)
	initialized = $state(false)

	constructor() {
		if (browser) {
			this.load()
		}
	}

	private load() {
		const saved = localStorage.getItem('settings')
		if (saved) {
			try {
				this.settings = { ...defaultSettings, ...JSON.parse(saved) }
			} catch (e) {
				console.error('Failed to parse settings:', e)
			}
		}
		this.initialized = true
	}

	private save() {
		if (browser) {
			localStorage.setItem('settings', JSON.stringify(this.settings))
		}
	}

	update(partial: Partial<Settings>) {
		this.settings = { ...this.settings, ...partial }
		this.save()
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
