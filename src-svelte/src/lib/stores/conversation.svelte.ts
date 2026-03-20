import { browser } from '$app/environment'
import { createMessage, type Message, type Session, type SessionMeta } from '$shared/types'
import { settingsStore } from './settings.svelte'

interface RendererChatModule {
	listSessionsMeta(): Promise<SessionMeta[]>
	getSession(sessionId: string): Promise<Session | null>
	createSession(newSession: Omit<Session, 'id'>, previousId?: string): Promise<Session>
	updateSession(sessionId: string, updater: Partial<Omit<Session, 'messages'>>): Promise<Session>
}

interface RendererHelpersModule {
	getAllMessageList(session: Session): Message[]
	initEmptyChatSession(): Omit<Session, 'id'>
}

interface RendererMessagesModule {
	submitNewUserMessage(
		sessionId: string,
		params: { newUserMsg: Message; needGenerating: boolean; onUserMessageReady?: () => void }
	): Promise<unknown>
	modifyMessage(sessionId: string, updated: Message, refreshCounting?: boolean, updateOnlyCache?: boolean): Promise<void>
}

interface RendererLastUsedState {
	setChatModel(provider: string, modelId: string): void
}

interface RendererLastUsedStore {
	getState(): RendererLastUsedState
}

interface RendererLastUsedModule {
	initLastUsedModelStore(): Promise<unknown>
	lastUsedModelStore: RendererLastUsedStore
}

interface RendererQueryClient {
	getQueryData(queryKey: unknown[]): unknown
	getQueryCache(): {
		subscribe(listener: () => void): () => void
	}
}

interface RendererQueryClientModule {
	queryClient: RendererQueryClient
}

interface RendererConversationModule {
	loadConversationRuntime(): Promise<{
		chatStore: RendererChatModule
		sessionHelpers: RendererHelpersModule
		sessionMessages: RendererMessagesModule
		initLastUsedModelStore(): Promise<unknown>
		lastUsedModelStore: RendererLastUsedStore
		queryClient: RendererQueryClient
	}>
}

interface RendererConversationRuntime {
	chatStore: RendererChatModule
	sessionHelpers: RendererHelpersModule
	sessionMessages: RendererMessagesModule
	initLastUsedModelStore(): Promise<unknown>
	lastUsedModelStore: RendererLastUsedStore
	queryClient: RendererQueryClient
}

export interface SelectedModel {
	provider: string
	modelId: string
}

class ConversationStore {
	ready = $state(false)
	sessions = $state<SessionMeta[]>([])
	currentSessionId = $state<string | null>(null)
	currentSession = $state<Session | null>(null)
	draftChatModel = $state<SelectedModel | null>(null)

	private chatModule: RendererChatModule | null = null
	private helpersModule: RendererHelpersModule | null = null
	private messagesModule: RendererMessagesModule | null = null
	private lastUsedModelModule: RendererLastUsedModule | null = null
	private queryClientModule: RendererQueryClientModule | null = null
	private initializing: Promise<void> | null = null
	private unsubscribeQueryCache: (() => void) | null = null

	constructor() {
		if (browser) {
			void this.init()
		}
	}

	get messages(): Message[] {
		if (!this.currentSession || !this.helpersModule) {
			return []
		}

		return this.helpersModule.getAllMessageList(this.currentSession)
	}

	get lastGeneratingMessage(): Message | null {
		const messages = this.messages

		for (let index = messages.length - 1; index >= 0; index -= 1) {
			if (messages[index]?.generating) {
				return messages[index]
			}
		}

		return null
	}

	get currentDisplayTitle(): string {
		if (!this.currentSession) {
			return 'New chat'
		}

		return this.currentSession.threadName || this.currentSession.name || 'Untitled'
	}

	get currentDisplaySubtitle(): string {
		if (!this.currentSession) {
			return this.sessions.length > 0 ? `${this.sessions.length} conversations available` : 'Start a real conversation'
		}

		if (this.currentSession.threadName && this.currentSession.threadName !== this.currentSession.name) {
			return this.currentSession.name
		}

		const messageCount = this.messages.length
		return messageCount === 0 ? 'No messages yet' : `${messageCount} message${messageCount === 1 ? '' : 's'}`
	}

	private syncSessionsFromCache() {
		if (!this.queryClientModule) {
			return
		}

		const cachedSessions = this.queryClientModule.queryClient.getQueryData(['chat-sessions-list']) as
			| SessionMeta[]
			| undefined

		if (cachedSessions) {
			this.sessions = cachedSessions.filter((session) => !session.hidden)
		}

		if (this.currentSessionId) {
			const cachedSession = this.queryClientModule.queryClient.getQueryData(['chat-session', this.currentSessionId]) as
				| Session
				| null
				| undefined

			if (cachedSession !== undefined) {
				this.currentSession = cachedSession
			}
		}
	}

	private syncDraftModelFromSession() {
		if (!this.helpersModule || !this.lastUsedModelModule) {
			return
		}

		const initialSession = this.helpersModule.initEmptyChatSession()
		const provider = initialSession.settings?.provider
		const modelId = initialSession.settings?.modelId

		if (provider && modelId) {
			this.draftChatModel = { provider, modelId }
			this.lastUsedModelModule.lastUsedModelStore.getState().setChatModel(provider, modelId)
		}
	}

	async init() {
		if (!browser || this.ready) {
			return
		}

		if (!this.initializing) {
			this.initializing = (async () => {
				await settingsStore.init()

				const runtimeLoader = (await import('$lib/runtime/renderer-conversation.js')) as RendererConversationModule
				const runtime = (await runtimeLoader.loadConversationRuntime()) as RendererConversationRuntime

				this.chatModule = runtime.chatStore
				this.helpersModule = runtime.sessionHelpers
				this.messagesModule = runtime.sessionMessages
				this.lastUsedModelModule = {
					initLastUsedModelStore: runtime.initLastUsedModelStore,
					lastUsedModelStore: runtime.lastUsedModelStore,
				}
				this.queryClientModule = {
					queryClient: runtime.queryClient,
				}

				await runtime.initLastUsedModelStore()
				this.sessions = (await runtime.chatStore.listSessionsMeta()).filter((session) => !session.hidden)
				this.syncDraftModelFromSession()

				if (!this.unsubscribeQueryCache) {
					this.unsubscribeQueryCache = runtime.queryClient.getQueryCache().subscribe(() => {
						this.syncSessionsFromCache()
					})
				}

				this.ready = true
			})()
		}

		await this.initializing
	}

	async loadSession(sessionId: string) {
		await this.init()
		if (!this.chatModule) {
			return null
		}

		this.currentSessionId = sessionId
		this.currentSession = await this.chatModule.getSession(sessionId)

		const provider = this.currentSession?.settings?.provider
		const modelId = this.currentSession?.settings?.modelId

		if (provider && modelId && this.lastUsedModelModule) {
			this.lastUsedModelModule.lastUsedModelStore.getState().setChatModel(provider, modelId)
		}

		return this.currentSession
	}

	clearCurrentSession() {
		this.currentSessionId = null
		this.currentSession = null
	}

	setDraftChatModel(model: SelectedModel) {
		this.draftChatModel = model
		if (this.lastUsedModelModule) {
			this.lastUsedModelModule.lastUsedModelStore.getState().setChatModel(model.provider, model.modelId)
		}
	}

	async updateSessionModel(sessionId: string, model: SelectedModel) {
		await this.init()
		if (!this.chatModule) {
			return
		}

		const session = this.currentSessionId === sessionId ? this.currentSession : await this.chatModule.getSession(sessionId)
		if (!session) {
			return
		}

		await this.chatModule.updateSession(sessionId, {
			settings: {
				...(session.settings || {}),
				provider: model.provider,
				modelId: model.modelId,
			},
		})

		this.lastUsedModelModule?.lastUsedModelStore.getState().setChatModel(model.provider, model.modelId)
	}

	async renameSession(sessionId: string, name: string) {
		await this.init()
		if (!this.chatModule) {
			return
		}

		const trimmedName = name.trim() || 'Untitled'
		await this.chatModule.updateSession(sessionId, { name: trimmedName, threadName: trimmedName })

		this.sessions = this.sessions.map((session) =>
			session.id === sessionId ? { ...session, name: trimmedName } : session
		)

		if (this.currentSession?.id === sessionId) {
			this.currentSession = {
				...this.currentSession,
				name: trimmedName,
				threadName: trimmedName,
			}
		}
	}

	async createSessionAndSubmit(messageText: string, model?: SelectedModel | null) {
		await this.init()
		if (!this.chatModule || !this.helpersModule || !this.messagesModule) {
			return null
		}

		const newSession = this.helpersModule.initEmptyChatSession()
		const selectedModel = model || this.draftChatModel

		if (selectedModel) {
			newSession.settings = {
				...(newSession.settings || {}),
				provider: selectedModel.provider,
				modelId: selectedModel.modelId,
			}
			this.lastUsedModelModule?.lastUsedModelStore.getState().setChatModel(selectedModel.provider, selectedModel.modelId)
		}

		const createdSession = await this.chatModule.createSession(newSession)
		this.currentSessionId = createdSession.id
		this.currentSession = createdSession

		void this.messagesModule.submitNewUserMessage(createdSession.id, {
			newUserMsg: createMessage('user', messageText),
			needGenerating: true,
		})

		return createdSession
	}

	async submitToSession(sessionId: string, messageText: string) {
		await this.init()
		if (!this.messagesModule) {
			return
		}

		void this.messagesModule.submitNewUserMessage(sessionId, {
			newUserMsg: createMessage('user', messageText),
			needGenerating: true,
		})
	}

	async stopGenerating(sessionId: string) {
		await this.init()
		if (!this.messagesModule) {
			return false
		}

		const session = this.currentSessionId === sessionId ? this.currentSession : await this.loadSession(sessionId)
		if (!session || !this.helpersModule) {
			return false
		}

		const messageList = this.helpersModule.getAllMessageList(session)
		let generatingMessage: Message | undefined

		for (let index = messageList.length - 1; index >= 0; index -= 1) {
			if (messageList[index]?.generating) {
				generatingMessage = messageList[index]
				break
			}
		}

		if (!generatingMessage) {
			return false
		}

		generatingMessage.cancel?.()
		await this.messagesModule.modifyMessage(sessionId, { ...generatingMessage, generating: false }, true)
		return true
	}
}

export const conversationStore = new ConversationStore()
