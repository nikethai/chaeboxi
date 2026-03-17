// Chat store using Svelte 5 runes - basic message handling
import type { Message } from '$shared/types'

interface ChatState {
	messages: Message[]
	currentSessionId: string | null
	streamingContent: string
	isStreaming: boolean
}

class ChatStore {
	state = $state<ChatState>({
		messages: [],
		currentSessionId: null,
		streamingContent: '',
		isStreaming: false,
	})

	// Get messages for current session
	get messages() {
		return this.state.messages
	}

	// Set current session
	setSession(sessionId: string) {
		this.state.currentSessionId = sessionId
	}

	// Add a message
	addMessage(message: Message) {
		this.state.messages = [...this.state.messages, message]
	}

	// Update a message by ID
	updateMessage(id: string, updates: Partial<Message>) {
		this.state.messages = this.state.messages.map((m) =>
			m.id === id ? { ...m, ...updates } : m
		)
	}

	// Remove a message
	removeMessage(id: string) {
		this.state.messages = this.state.messages.filter((m) => m.id !== id)
	}

	// Clear all messages
	clearMessages() {
		this.state.messages = []
	}

	// Streaming helpers
	startStreaming() {
		this.state.isStreaming = true
		this.state.streamingContent = ''
	}

	updateStreamingContent(content: string) {
		this.state.streamingContent = content
	}

	finishStreaming() {
		this.state.isStreaming = false
		// Add the final streaming message if there's content
		if (this.state.streamingContent) {
			this.addMessage({
				id: `msg-${Date.now()}`,
				role: 'assistant',
				contentParts: [{ type: 'text', text: this.state.streamingContent }],
				status: [],
				tokenCalculatedAt: null,
			})
			this.state.streamingContent = ''
		}
	}

	// Get message by ID
	getMessage(id: string): Message | undefined {
		return this.state.messages.find((m) => m.id === id)
	}
}

export const chatStore = new ChatStore()
