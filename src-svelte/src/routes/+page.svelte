<script lang="ts">
	import { onMount } from 'svelte'
	import { MessageList, InputBox } from '$lib/components/chat'
	import { chatStore } from '$lib/stores/chat.svelte'
	import { settingsStore } from '$lib/stores/settings.svelte'
	import type { Message } from '$shared/types'

	// Demo messages for testing
	let messages = $state<Message[]>([
		{
			id: '1',
			role: 'user',
			contentParts: [{ type: 'text', text: 'Hello! How are you?' }],
			status: [],
			tokenCalculatedAt: null,
		},
		{
			id: '2',
			role: 'assistant',
			contentParts: [
				{
					type: 'text',
					text: "I'm doing great, thank you! I'm a helpful AI assistant. Here's some code:\n\n```javascript\nconsole.log('Hello, World!');\n```\n\nAnd here's some math: $E = mc^2$",
				},
			],
			modelId: 'gpt-4',
			status: [],
			tokenCalculatedAt: null,
		},
	])

	function handleSubmit(message: string) {
		// Add user message
		const userMessage: Message = {
			id: `msg-${Date.now()}`,
			role: 'user',
			contentParts: [{ type: 'text', text: message }],
			status: [],
			tokenCalculatedAt: null,
		}
		messages = [...messages, userMessage]

		// Simulate assistant response
		setTimeout(() => {
			const assistantMessage: Message = {
				id: `msg-${Date.now()}`,
				role: 'assistant',
				contentParts: [
					{
						type: 'text',
						text: `You said: "${message}". This is a demo response from the Svelte 5 chat interface!`,
					},
				],
				modelId: 'gpt-4',
				status: [],
				tokenCalculatedAt: null,
			}
			messages = [...messages, assistantMessage]
		}, 500)
	}
</script>

<div class="chat-page">
	<div class="chat-header">
		<h1>Chaeboxi</h1>
		<p class="subtitle">Svelte 5 Chat Interface</p>
	</div>

	<MessageList {messages} />

	<InputBox onSubmit={handleSubmit} placeholder="Type a message..." />
</div>

<style>
	.chat-page {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background: var(--chatbox-background-primary);
	}

	.chat-header {
		padding: 1rem;
		border-bottom: 1px solid var(--chatbox-border-primary);
		background: var(--chatbox-background-secondary);
	}

	.chat-header h1 {
		font-size: 1.25rem;
		font-weight: 600;
		margin: 0;
		color: var(--chatbox-tint-primary);
	}

	.chat-header .subtitle {
		font-size: 0.75rem;
		color: var(--chatbox-tint-secondary);
		margin: 0.25rem 0 0;
	}
</style>
