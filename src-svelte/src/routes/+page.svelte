<script lang="ts">
	import { goto } from '$app/navigation'
	import { onMount } from 'svelte'
	import { InputBox } from '$lib/components/chat'
	import { conversationStore } from '$lib/stores/conversation.svelte'
	import { providerCatalogStore } from '$lib/stores/provider-catalog.svelte'
	import { settingsStore } from '$lib/stores/settings.svelte'
	import { getAvailableProviders } from '$lib/utils/providers'

	let ready = $state(false)
	let isSubmitting = $state(false)

	onMount(async () => {
		await Promise.all([settingsStore.init(), conversationStore.init(), providerCatalogStore.init()])
		ready = true
	})

	const providers = $derived(getAvailableProviders(settingsStore.settings, providerCatalogStore.systemProviders))
	const hasProviders = $derived(providers.length > 0)

	async function handleSubmit(message: string) {
		if (!hasProviders || isSubmitting) {
			return
		}

		isSubmitting = true
		try {
			const session = await conversationStore.createSessionAndSubmit(message, conversationStore.draftChatModel)
			if (session) {
				goto(`/session/${session.id}`)
			}
		} finally {
			isSubmitting = false
		}
	}
</script>

<div class="chat-page">
	<div class="welcome-area">
		<div class="welcome-icon">
			<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
				<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
			</svg>
		</div>
		<p class="welcome-text">What can I help you with today?</p>
	</div>

	{#if ready && !hasProviders}
		<div class="provider-warning">
			<div class="provider-warning-title">Select and configure an AI model provider</div>
			<p>
				To start a conversation, configure at least one provider first. The Svelte rescue pass keeps this route
				real, so there is no fake fallback model.
			</p>
			<a class="provider-link" href="/settings/provider">Setup Provider</a>
		</div>
	{/if}

	<div class="input-area">
		<InputBox onSubmit={handleSubmit} disabled={!hasProviders || isSubmitting} placeholder="Type your question here..." />
	</div>
</div>

<style>
	.chat-page {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--chatbox-background-primary);
	}

	.welcome-area {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 1.5rem;
		color: var(--chatbox-tint-secondary);
	}

	.welcome-icon {
		width: 52px;
		height: 52px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--chatbox-tint-tertiary);
	}

	.welcome-text {
		font-size: 1rem;
		font-weight: 600;
		color: var(--chatbox-tint-secondary);
		margin: 0;
	}

	.provider-warning {
		max-width: 56rem;
		margin: 0 auto 0.875rem;
		width: calc(100% - 1.5rem);
		padding: 0.875rem 1rem;
		border: 1px solid var(--chatbox-border-primary);
		border-radius: 16px;
		background: var(--chatbox-background-secondary);
		color: var(--chatbox-tint-secondary);
	}

	.provider-warning-title {
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--chatbox-tint-primary);
		margin-bottom: 0.375rem;
	}

	.provider-warning p {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.5;
	}

	.provider-link {
		display: inline-flex;
		align-items: center;
		margin-top: 0.75rem;
		padding: 0.45rem 0.8rem;
		border-radius: 999px;
		background: var(--chatbox-background-brand-primary);
		color: white;
		text-decoration: none;
		font-size: 0.825rem;
		font-weight: 600;
	}

	.input-area {
		flex-shrink: 0;
	}
</style>
