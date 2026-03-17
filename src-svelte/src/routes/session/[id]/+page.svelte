<script lang="ts">
	import { page } from '$app/stores';
	import { MessageList, InputBox } from '$lib/components/chat';
	import type { Message } from '$shared/types';

	const sessionId = $derived($page.params.id);

	// Demo messages - in production, load from session store
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
					text: "I'm doing great, thank you! I'm a helpful AI assistant.",
				},
			],
			modelId: 'gpt-4',
			status: [],
			tokenCalculatedAt: null,
		},
	]);

	function handleSubmit(message: string) {
		// Add user message
		const userMessage: Message = {
			id: `msg-${Date.now()}`,
			role: 'user',
			contentParts: [{ type: 'text', text: message }],
			status: [],
			tokenCalculatedAt: null,
		};
		messages = [...messages, userMessage];

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
			};
			messages = [...messages, assistantMessage];
		}, 500);
	}
</script>

<div class="session-page">
	<div class="session-header">
		<h1>Session: {sessionId}</h1>
	</div>

	<MessageList {messages} />

	<InputBox onSubmit={handleSubmit} placeholder="Type a message..." />
</div>

<style>
	.session-page {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--chatbox-background-primary);
	}

	.session-header {
		padding: 1rem;
		border-bottom: 1px solid var(--chatbox-border-primary);
		background: var(--chatbox-background-secondary);
	}

	.session-header h1 {
		font-size: 1.25rem;
		font-weight: 600;
		margin: 0;
		color: var(--chatbox-tint-primary);
	}
</style>
