<script lang="ts">
	import { goto } from '$app/navigation'
	import { onMount } from 'svelte'
	import { InputBox } from '$lib/components/chat'
	import { conversationStore } from '$lib/stores/conversation.svelte'
	import { providerCatalogStore } from '$lib/stores/provider-catalog.svelte'
	import { settingsStore } from '$lib/stores/settings.svelte'
	import { getAvailableProviders, getSelectedModelLabel } from '$lib/utils/providers'

	let ready = $state(false)
	let isSubmitting = $state(false)

	onMount(async () => {
		await Promise.all([settingsStore.init(), conversationStore.init(), providerCatalogStore.init()])
		ready = true
	})

	const providers = $derived(getAvailableProviders(settingsStore.settings, providerCatalogStore.systemProviders))
	const hasProviders = $derived(providers.length > 0)
	const selectedModelLabel = $derived(getSelectedModelLabel(providers, conversationStore.draftChatModel))

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
	<div class="welcome-shell">
		<div class="welcome-area">
			<div class="welcome-icon">
				<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
					<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
				</svg>
			</div>
			<div class="welcome-copy">
				<p class="welcome-kicker">Real new-session route</p>
				<h1 class="welcome-text">What can I help you with today?</h1>
				<p class="welcome-subtitle">
					{#if hasProviders}
						Ready to start with {selectedModelLabel}.
					{:else}
						Configure a provider first. This route stays honest and does not fall back to a fake demo model.
					{/if}
				</p>
			</div>
		</div>

		{#if ready && !hasProviders}
			<div class="provider-warning">
				<div>
					<div class="provider-warning-title">Select and configure an AI model provider</div>
					<p>
						To start a conversation, configure at least one provider first. The Svelte app now sends you into the
						real provider settings flow instead of faking a starter model.
					</p>
				</div>
				<a class="provider-link" href="/settings/provider">Provider settings</a>
			</div>
		{/if}
	</div>

	<div class="input-area">
		<InputBox
			label="New conversation"
			helperText={hasProviders ? `Using ${selectedModelLabel}` : 'Provider setup required before sending'}
			onSubmit={handleSubmit}
			disabled={!hasProviders || isSubmitting}
			placeholder="Type your question here..."
		/>
	</div>
</div>

<style>
	.chat-page {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--chatbox-background-primary);
	}

	.welcome-shell {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: 1.2rem 0.85rem 0.4rem;
	}

	.welcome-area {
		display: flex;
		align-items: center;
		gap: 1rem;
		max-width: 56rem;
		width: 100%;
		margin: 0 auto;
		padding: 1.2rem 0;
	}

	.welcome-copy {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}

	.welcome-kicker {
		margin: 0 0 0.4rem;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--chatbox-tint-tertiary);
	}

	.welcome-text {
		margin: 0;
		font-size: clamp(1.9rem, 5vw, 2.9rem);
		line-height: 1.02;
		letter-spacing: -0.04em;
		color: var(--chatbox-tint-primary);
	}

	.welcome-subtitle {
		max-width: 36rem;
		margin: 0.7rem 0 0;
		font-size: 0.95rem;
		line-height: 1.6;
		color: var(--chatbox-tint-secondary);
	}

	.welcome-icon {
		width: 58px;
		height: 58px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 18px;
		background: var(--chatbox-background-brand-secondary);
		color: var(--chatbox-tint-brand);
		flex-shrink: 0;
	}

	.provider-warning {
		max-width: 56rem;
		margin: 0 auto 0.85rem;
		width: 100%;
		box-sizing: border-box;
		padding: 0.95rem 1rem;
		border: 1px solid var(--chatbox-border-primary);
		border-radius: 18px;
		background: color-mix(in srgb, var(--chatbox-background-secondary), transparent 12%);
		color: var(--chatbox-tint-secondary);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
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
		justify-content: center;
		padding: 0.55rem 0.9rem;
		border-radius: 999px;
		background: var(--chatbox-background-brand-primary);
		color: white;
		text-decoration: none;
		font-size: 0.825rem;
		font-weight: 600;
		flex-shrink: 0;
	}

	.input-area {
		flex-shrink: 0;
	}

	@media (max-width: 720px) {
		.welcome-area,
		.provider-warning {
			flex-direction: column;
			align-items: flex-start;
			text-align: left;
		}

		.welcome-copy {
			align-items: flex-start;
			text-align: left;
		}
	}
</style>
