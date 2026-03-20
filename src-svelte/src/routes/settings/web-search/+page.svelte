<script lang="ts">
	import SelectMenu from '$lib/components/common/SelectMenu.svelte'
	import { settingsStore } from '$lib/stores/settings.svelte'

	const providerOptions = [
		{ value: 'bing', label: 'Bing Search', hint: 'Free built-in search path' },
		{ value: 'duckduckgo', label: 'DuckDuckGo Search', hint: 'Free built-in search path' },
		{ value: 'serper', label: 'Serper', hint: 'Google Search API wrapper' },
		{ value: 'google', label: 'Google Custom Search', hint: 'Google programmable search' },
		{ value: 'tavily', label: 'Tavily', hint: 'Dedicated search API' },
	]

	const webSearch = $derived(settingsStore.settings.extension.webSearch)

	function updateWebSearch(patch: Partial<typeof settingsStore.settings.extension.webSearch>) {
		settingsStore.update({
			extension: {
				...settingsStore.settings.extension,
				webSearch: {
					...settingsStore.settings.extension.webSearch,
					...patch,
				},
			},
		})
	}
</script>

<section class="settings-page">
	<header class="page-header">
		<p class="eyebrow">Web Search</p>
		<h1>Search provider configuration</h1>
		<p>Keep this route limited to the real persisted web-search settings path. No fake connection tests.</p>
	</header>

	<section class="card">
		<div class="card-header">
			<h2>Search backend</h2>
			<p>Choose the provider used for web-enabled chat flows.</p>
		</div>

		<label class="field">
			<span>Search provider</span>
			<SelectMenu options={providerOptions} value={webSearch.provider === 'build-in' ? 'bing' : webSearch.provider} onChange={(value) => updateWebSearch({ provider: value as typeof webSearch.provider })} />
		</label>

		{#if webSearch.provider === 'bing'}
			<p class="note">Bing remains the default built-in option in the current Svelte shell.</p>
		{:else if webSearch.provider === 'duckduckgo'}
			<p class="note">DuckDuckGo uses the existing built-in path and may be rate-limited by region.</p>
		{:else if webSearch.provider === 'serper'}
			<div class="field-stack">
				<label class="field">
					<span>Serper API key</span>
					<input
						type="password"
						value={webSearch.serperApiKey ?? ''}
						oninput={(event) => updateWebSearch({ serperApiKey: event.currentTarget.value })}
					/>
				</label>
				<p class="note">Only the real stored credential field is exposed in this pass.</p>
			</div>
		{:else if webSearch.provider === 'google'}
			<div class="field-stack">
				<label class="field">
					<span>Google API key</span>
					<input
						type="password"
						value={webSearch.googleApiKey ?? ''}
						oninput={(event) => updateWebSearch({ googleApiKey: event.currentTarget.value })}
					/>
				</label>

				<label class="field">
					<span>Search engine ID (cx)</span>
					<input
						type="text"
						value={webSearch.googleCseId ?? ''}
						oninput={(event) => updateWebSearch({ googleCseId: event.currentTarget.value })}
					/>
				</label>
			</div>
		{:else if webSearch.provider === 'tavily'}
			<div class="field-stack">
				<label class="field">
					<span>Tavily API key</span>
					<input
						type="password"
						value={webSearch.tavilyApiKey ?? ''}
						oninput={(event) => updateWebSearch({ tavilyApiKey: event.currentTarget.value })}
					/>
				</label>
				<p class="note">Depth, result limits, and capability testing stay out of scope for this pass.</p>
			</div>
		{/if}
	</section>
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
		font-size: 0.95rem;
	}

	.page-header p:last-child,
	.card-header p,
	.note {
		margin: 0.38rem 0 0;
		font-size: 0.8rem;
		line-height: 1.45;
		color: var(--chatbox-tint-secondary);
	}

	.card-header {
		margin-bottom: 0.85rem;
	}

	.field-stack {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		margin-top: 0.85rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.field span {
		font-size: 0.76rem;
		font-weight: 700;
		color: var(--chatbox-tint-secondary);
	}

	.field input {
		width: 100%;
		min-height: 2.5rem;
		padding: 0.55rem 0.75rem;
		border-radius: 12px;
		border: 1px solid var(--chatbox-border-primary);
		background: var(--chatbox-background-primary);
		color: var(--chatbox-tint-primary);
		font: inherit;
		box-sizing: border-box;
	}

	.note {
		margin-top: 0.75rem;
	}

	@media (max-width: 720px) {
		.settings-page {
			padding: 0.85rem;
		}
	}
</style>
