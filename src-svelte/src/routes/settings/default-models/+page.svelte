<script lang="ts">
	import { onMount } from 'svelte'
	import SettingsModelSelect from '$lib/components/settings/SettingsModelSelect.svelte'
	import { providerCatalogStore } from '$lib/stores/provider-catalog.svelte'
	import { settingsStore } from '$lib/stores/settings.svelte'
	import { getAvailableProviders } from '$lib/utils/providers'

	onMount(async () => {
		await Promise.all([settingsStore.init(), providerCatalogStore.init()])
	})

	const providers = $derived(getAvailableProviders(settingsStore.settings, providerCatalogStore.systemProviders))
</script>

<section class="settings-page">
	<header class="page-header">
		<p class="eyebrow">Default Models</p>
		<h1>Choose the default model paths</h1>
		<p>These selectors write to the same provider/model metadata already consumed by chat and image flows.</p>
	</header>

	<div class="card-grid">
		<section class="card">
			<h2>Default chat model</h2>
			<p>Used for new chats unless the draft session overrides it.</p>
			<SettingsModelSelect
				providers={providers}
				selected={settingsStore.settings.defaultChatModel
					? { provider: settingsStore.settings.defaultChatModel.provider, model: settingsStore.settings.defaultChatModel.model }
					: null}
				autoLabel="Auto (use last used)"
				onSelect={(selection) =>
					settingsStore.update({
						defaultChatModel: selection
							? { provider: selection.provider, model: selection.model }
							: undefined,
					})}
			/>
		</section>

		<section class="card">
			<h2>Default thread naming model</h2>
			<p>Falls back to the current chat model when left on auto.</p>
			<SettingsModelSelect
				providers={providers}
				selected={settingsStore.settings.threadNamingModel
					? { provider: settingsStore.settings.threadNamingModel.provider, model: settingsStore.settings.threadNamingModel.model }
					: null}
				autoLabel="Auto (use chat model)"
				onSelect={(selection) =>
					settingsStore.update({
						threadNamingModel: selection
							? { provider: selection.provider, model: selection.model }
							: undefined,
					})}
			/>
		</section>

		<section class="card">
			<h2>Search term construction model</h2>
			<p>Used when search-enabled chats need a separate search-term model.</p>
			<SettingsModelSelect
				providers={providers}
				selected={settingsStore.settings.searchTermConstructionModel
					? {
							provider: settingsStore.settings.searchTermConstructionModel.provider,
							model: settingsStore.settings.searchTermConstructionModel.model,
						}
					: null}
				autoLabel="Auto (use chat model)"
				onSelect={(selection) =>
					settingsStore.update({
						searchTermConstructionModel: selection
							? { provider: selection.provider, model: selection.model }
							: undefined,
					})}
			/>
		</section>

		<section class="card">
			<h2>OCR model</h2>
			<p>Only vision-capable chat models are shown here. Leave it empty to disable OCR fallback.</p>
			<SettingsModelSelect
				providers={providers}
				selected={settingsStore.settings.ocrModel
					? { provider: settingsStore.settings.ocrModel.provider, model: settingsStore.settings.ocrModel.model }
					: null}
				autoLabel="None"
				modelFilter={(model) => model.capabilities?.includes('vision') ?? false}
				onSelect={(selection) =>
					settingsStore.update({
						ocrModel: selection ? { provider: selection.provider, model: selection.model } : undefined,
					})}
			/>
		</section>
	</div>
</section>

<style>
	.settings-page {
		height: 100%;
		overflow-y: auto;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.page-header,
	.card {
		border: 1px solid var(--chatbox-border-primary);
		border-radius: 18px;
		background: color-mix(in srgb, var(--chatbox-background-secondary), transparent 10%);
		padding: 1rem;
	}

	.eyebrow {
		margin: 0 0 0.22rem;
		font-size: 0.66rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--chatbox-tint-tertiary);
	}

	h1,
	h2 {
		margin: 0;
		color: var(--chatbox-tint-primary);
	}

	h1 {
		font-size: 1.1rem;
		line-height: 1.16;
	}

	h2 {
		font-size: 0.94rem;
	}

	.page-header p:last-child,
	.card p {
		margin: 0.38rem 0 0;
		font-size: 0.8rem;
		line-height: 1.45;
		color: var(--chatbox-tint-secondary);
	}

	.card-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
	}

	.card :global(.select-menu) {
		margin-top: 0.8rem;
	}

	@media (max-width: 960px) {
		.card-grid {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	@media (max-width: 720px) {
		.settings-page {
			padding: 0.85rem;
		}
	}
</style>
