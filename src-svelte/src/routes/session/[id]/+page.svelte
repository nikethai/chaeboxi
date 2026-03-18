<script lang="ts">
	import { page } from '$app/stores'
	import { onMount } from 'svelte'
	import { InputBox, MessageList } from '$lib/components/chat'
	import { conversationStore } from '$lib/stores/conversation.svelte'

	let ready = $state(false)

	const sessionId = $derived($page.params.id)
	const session = $derived(
		sessionId && conversationStore.currentSession?.id === sessionId ? conversationStore.currentSession : null
	)
	const messages = $derived(session ? conversationStore.messages : [])
	const generating = $derived(Boolean(sessionId && conversationStore.lastGeneratingMessage))

	onMount(async () => {
		await conversationStore.init()
		ready = true
	})

	$effect(() => {
		if (!ready || !sessionId) {
			return
		}

		void conversationStore.loadSession(sessionId)
	})

	async function handleSubmit(message: string) {
		if (!sessionId) {
			return
		}

		await conversationStore.submitToSession(sessionId, message)
	}

	async function handleStopGenerating() {
		if (!sessionId) {
			return
		}

		await conversationStore.stopGenerating(sessionId)
	}
</script>

{#if session}
	<div class="session-page">
		<MessageList messages={messages} />

		<InputBox
			onSubmit={handleSubmit}
			generating={generating}
			onStopGenerating={handleStopGenerating}
			placeholder="Type a message..."
		/>
	</div>
{:else if ready}
	<div class="missing-session">
		<h1>Conversation not found</h1>
		<p>This session could not be loaded from the real store.</p>
		<a href="/">Back to Home</a>
	</div>
{/if}

<style>
	.session-page {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--chatbox-background-primary);
	}

	.missing-session {
		display: flex;
		flex: 1;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 2rem;
		text-align: center;
		color: var(--chatbox-tint-secondary);
	}

	.missing-session h1 {
		margin: 0;
		font-size: 1.5rem;
		color: var(--chatbox-tint-primary);
	}

	.missing-session p {
		margin: 0;
	}

	.missing-session a {
		margin-top: 0.5rem;
		color: var(--chatbox-tint-brand);
		text-decoration: none;
		font-weight: 600;
	}
</style>
