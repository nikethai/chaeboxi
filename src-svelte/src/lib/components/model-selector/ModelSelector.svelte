<script lang="ts">
	import type { ProviderInfo } from '$shared/types'
	import { getChatModels, getSelectedModelLabel } from '$lib/utils/providers'

	interface Props {
		providers?: ProviderInfo[]
		selected?: {
			provider: string
			modelId: string
		} | null
		disabled?: boolean
		onSelect?: (provider: string, modelId: string) => void
		class?: string
	}

	let { providers = [], selected = null, disabled = false, onSelect, class: className = '' }: Props = $props()

	let isOpen = $state(false)
	let searchQuery = $state('')
	let rootElement = $state<HTMLDivElement | null>(null)

	const filteredProviders = $derived(
		providers
			.map((provider) => {
				const normalizedQuery = searchQuery.toLowerCase()
				const models = getChatModels(provider)
					.filter((model) => {
						if (!searchQuery) {
							return true
						}

						return (
							(model.nickname || model.modelId).toLowerCase().includes(normalizedQuery) ||
							provider.name.toLowerCase().includes(normalizedQuery)
						)
					})
					.map((model) => ({
						modelId: model.modelId,
						label: model.nickname || model.modelId,
					}))

				return {
					id: provider.id,
					name: provider.name,
					models,
				}
			})
			.filter((provider) => provider.models.length > 0)
	)

	const selectedLabel = $derived(
		providers.length ? getSelectedModelLabel(providers, selected) : 'No models configured'
	)

	function toggleDropdown() {
		if (disabled || !providers.length) {
			return
		}

		isOpen = !isOpen
		if (!isOpen) {
			searchQuery = ''
		}
	}

	function selectModel(provider: string, modelId: string) {
		onSelect?.(provider, modelId)
		isOpen = false
		searchQuery = ''
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as Node | null
		if (rootElement && target && !rootElement.contains(target)) {
			isOpen = false
		}
	}
</script>

<svelte:window onclick={handleClickOutside} />

<div bind:this={rootElement} class="model-selector {className}">
	<button
		class="selector-trigger"
		type="button"
		onclick={toggleDropdown}
		disabled={disabled || !providers.length}
		aria-label="Select model"
	>
		<span class="model-name">{selectedLabel}</span>
		<svg
			class="chevron"
			class:open={isOpen}
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<path d="M6 9l6 6 6-6" />
		</svg>
	</button>

	{#if isOpen}
		<div class="dropdown">
			<div class="search-input">
				<input type="text" placeholder="Search models..." bind:value={searchQuery} />
			</div>

			<div class="models-list">
				{#each filteredProviders as provider (provider.id)}
					<section class="provider-group">
						<div class="provider-title">{provider.name}</div>
						{#each provider.models as model (model.modelId)}
							<button
								class="model-item"
								class:selected={selected?.provider === provider.id && selected?.modelId === model.modelId}
								type="button"
								onclick={() => selectModel(provider.id, model.modelId)}
							>
								<span class="model-name">{model.label}</span>
								<span class="model-provider">{provider.name}</span>
							</button>
						{/each}
					</section>
				{/each}

				{#if filteredProviders.length === 0}
					<div class="no-results">No models found</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.model-selector {
		position: relative;
	}

	.selector-trigger {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.625rem;
		background: transparent;
		border: 1px solid var(--chatbox-border-primary);
		border-radius: 999px;
		cursor: pointer;
		transition: all 0.2s ease;
		max-width: min(32rem, calc(100vw - 10rem));
	}

	.selector-trigger:hover {
		background: var(--chatbox-background-secondary);
	}

	.selector-trigger:disabled {
		cursor: default;
		opacity: 0.72;
	}

	.model-name {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--chatbox-tint-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.chevron {
		transition: transform 0.2s ease;
		color: var(--chatbox-tint-secondary);
		flex-shrink: 0;
	}

	.chevron.open {
		transform: rotate(180deg);
	}

	.dropdown {
		position: absolute;
		top: calc(100% + 0.375rem);
		left: 50%;
		transform: translateX(-50%);
		min-width: min(20rem, calc(100vw - 2rem));
		max-width: min(26rem, calc(100vw - 2rem));
		background: var(--chatbox-background-primary);
		border: 1px solid var(--chatbox-border-primary);
		border-radius: 14px;
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.16);
		z-index: 100;
		overflow: hidden;
	}

	.search-input {
		padding: 0.625rem;
		border-bottom: 1px solid var(--chatbox-border-primary);
	}

	.search-input input {
		width: 100%;
		padding: 0.5rem 0.75rem;
		background: var(--chatbox-background-secondary);
		border: 1px solid var(--chatbox-border-primary);
		border-radius: 10px;
		font-size: 0.875rem;
		color: var(--chatbox-tint-primary);
		outline: none;
	}

	.search-input input:focus {
		border-color: var(--chatbox-border-brand);
	}

	.models-list {
		max-height: 22rem;
		overflow-y: auto;
		padding: 0.5rem;
	}

	.provider-group + .provider-group {
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--chatbox-border-primary);
	}

	.provider-title {
		padding: 0.25rem 0.5rem;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--chatbox-tint-tertiary);
	}

	.model-item {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.625rem 0.75rem;
		background: transparent;
		border: none;
		border-radius: 10px;
		cursor: pointer;
		transition: background 0.2s ease;
		text-align: left;
	}

	.model-item:hover {
		background: var(--chatbox-background-secondary);
	}

	.model-item.selected {
		background: var(--chatbox-background-brand-secondary);
	}

	.model-item .model-provider {
		font-size: 0.75rem;
		color: var(--chatbox-tint-tertiary);
		margin-left: 1rem;
	}

	.no-results {
		padding: 1rem;
		text-align: center;
		color: var(--chatbox-tint-secondary);
		font-size: 0.875rem;
	}
</style>
