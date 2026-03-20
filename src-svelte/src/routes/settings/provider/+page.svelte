<script lang="ts">
	import { goto } from '$app/navigation'
	import { onMount } from 'svelte'
	import { getPreferredProviderId } from '$lib/stores/provider-settings'
	import { providerCatalogStore } from '$lib/stores/provider-catalog.svelte'
	import { settingsStore } from '$lib/stores/settings.svelte'

	let redirecting = $state(false)

	onMount(async () => {
		await Promise.all([settingsStore.init(), providerCatalogStore.init()])

		const isCompact = window.matchMedia('(max-width: 920px)').matches
		if (isCompact) {
			return
		}

		const providerId = getPreferredProviderId(settingsStore.settings, providerCatalogStore.systemProviders)
		if (!providerId) {
			return
		}

		redirecting = true
		await goto(`/settings/provider/${providerId}`, { replaceState: true })
	})
</script>

<section class="provider-entry">
	<div class="entry-card">
		<p class="eyebrow">Provider Setup</p>
		<h1>{redirecting ? 'Opening your provider editor…' : 'Choose a provider to start setup'}</h1>
		<p>
			On desktop this route opens the first useful provider editor automatically. On smaller screens the provider list stays
			as the entrypoint and drills into detail routes.
		</p>
	</div>
</section>

<style>
	.provider-entry {
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}

	.entry-card {
		max-width: 28rem;
		padding: 1.15rem 1.2rem;
		border: 1px solid var(--chatbox-border-primary);
		border-radius: 22px;
		background: color-mix(in srgb, var(--chatbox-background-secondary), transparent 10%);
	}

	.eyebrow {
		margin: 0 0 0.25rem;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--chatbox-tint-tertiary);
	}

	h1 {
		margin: 0;
		font-size: 1.15rem;
		line-height: 1.2;
		color: var(--chatbox-tint-primary);
	}

	p:last-child {
		margin: 0.55rem 0 0;
		font-size: 0.86rem;
		line-height: 1.55;
		color: var(--chatbox-tint-secondary);
	}
</style>
