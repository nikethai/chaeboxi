<script lang="ts">
	import { page } from '$app/stores'
	import { onMount } from 'svelte'
	import ProviderList from '$lib/components/settings/provider/ProviderList.svelte'
	import {
		getProviderBaseInfos,
	} from '$lib/stores/provider-settings'
	import { providerCatalogStore } from '$lib/stores/provider-catalog.svelte'
	import { settingsStore } from '$lib/stores/settings.svelte'

	let { children } = $props()

	let compactLayout = $state(false)

	const providers = $derived(getProviderBaseInfos(settingsStore.settings, providerCatalogStore.systemProviders))
	const selectedProviderId = $derived($page.params.providerId ?? null)
	const showingListOnly = $derived(compactLayout && $page.url.pathname === '/settings/provider')

	onMount(() => {
		let cleanup = () => {}

		void (async () => {
			await Promise.all([settingsStore.init(), providerCatalogStore.init()])

			const mediaQuery = window.matchMedia('(max-width: 920px)')
			const syncLayout = () => {
				compactLayout = mediaQuery.matches
			}

			syncLayout()
			mediaQuery.addEventListener('change', syncLayout)
			cleanup = () => {
				mediaQuery.removeEventListener('change', syncLayout)
			}
		})()

		return () => {
			cleanup()
		}
	})
</script>

<div class="provider-layout">
	{#if !compactLayout || showingListOnly}
		<aside class="list-pane">
			<ProviderList
				{providers}
				settings={settingsStore.settings}
				{selectedProviderId}
				mobile={compactLayout}
			/>
		</aside>
	{/if}

	{#if !compactLayout || !showingListOnly}
		<section class="detail-pane">
			{@render children()}
		</section>
	{/if}
</div>

<style>
	.provider-layout {
		display: flex;
		flex: 1;
		min-height: 0;
		height: 100%;
		background: var(--chatbox-background-primary);
	}

	.list-pane {
		width: min(300px, 30vw);
		min-width: 264px;
		max-width: 332px;
		border-right: 1px solid var(--chatbox-border-primary);
		background: var(--chatbox-background-primary);
	}

	.detail-pane {
		flex: 1;
		min-width: 0;
		min-height: 0;
		background: var(--chatbox-background-primary);
	}

	@media (max-width: 920px) {
		.provider-layout {
			display: block;
			height: 100%;
		}

		.list-pane {
			width: 100%;
			min-width: 0;
			max-width: none;
			height: 100%;
			border-right: 0;
		}

		.detail-pane {
			height: 100%;
		}
	}
</style>
