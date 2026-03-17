<script lang="ts">
	interface Model {
		id: string
		name: string
		provider: string
	}

	interface Props {
		models?: Model[]
		currentModel?: string
		onSelect?: (modelId: string) => void
		class?: string
	}

	let { models = [], currentModel = '', onSelect, class: className = '' }: Props = $props()

	let isOpen = $state(false)
	let searchQuery = $state('')

	// Demo models
	const defaultModels: Model[] = [
		{ id: 'gpt-4', name: 'GPT-4', provider: 'OpenAI' },
		{ id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
		{ id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
		{ id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
		{ id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic' },
		{ id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Google' },
		{ id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'Google' },
		{ id: 'llama-3.1-70b', name: 'Llama 3.1 70B', provider: 'Meta' },
		{ id: 'mistral-large', name: 'Mistral Large', provider: 'Mistral' },
	]

	const allModels = $derived(models.length > 0 ? models : defaultModels)

	const filteredModels = $derived(
		searchQuery
			? allModels.filter(
					(m) =>
						m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
						m.provider.toLowerCase().includes(searchQuery.toLowerCase())
				)
			: allModels
	)

	const selectedModel = $derived(allModels.find((m) => m.id === currentModel))

	function toggleDropdown() {
		isOpen = !isOpen
		if (!isOpen) {
			searchQuery = ''
		}
	}

	function selectModel(modelId: string) {
		onSelect?.(modelId)
		isOpen = false
		searchQuery = ''
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement
		if (!target.closest('.model-selector')) {
			isOpen = false
		}
	}
</script>

<svelte:window onClick={handleClickOutside} />

<div class="model-selector {className}">
	<button class="selector-trigger" onclick={toggleDropdown}>
		<span class="model-name">{selectedModel?.name || 'Select Model'}</span>
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
				<input
					type="text"
					placeholder="Search models..."
					bind:value={searchQuery}
				/>
			</div>

			<div class="models-list">
				{#each filteredModels as model (model.id)}
					<button
						class="model-item"
						class:selected={model.id === currentModel}
						onclick={() => selectModel(model.id)}
					>
						<span class="model-name">{model.name}</span>
						<span class="model-provider">{model.provider}</span>
					</button>
				{/each}

				{#if filteredModels.length === 0}
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
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: var(--chatbox-background-tertiary);
		border: 1px solid var(--chatbox-border-primary);
		border-radius: var(--chatbox-radius-md);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.selector-trigger:hover {
		background: var(--chatbox-background-secondary);
	}

	.model-name {
		font-size: 0.875rem;
		color: var(--chatbox-tint-primary);
	}

	.chevron {
		transition: transform 0.2s ease;
		color: var(--chatbox-tint-secondary);
	}

	.chevron.open {
		transform: rotate(180deg);
	}

	.dropdown {
		position: absolute;
		top: calc(100% + 0.5rem);
		left: 0;
		min-width: 280px;
		background: var(--chatbox-background-primary);
		border: 1px solid var(--chatbox-border-primary);
		border-radius: var(--chatbox-radius-lg);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		z-index: 100;
		overflow: hidden;
	}

	.search-input {
		padding: 0.75rem;
		border-bottom: 1px solid var(--chatbox-border-primary);
	}

	.search-input input {
		width: 100%;
		padding: 0.5rem 0.75rem;
		background: var(--chatbox-background-secondary);
		border: 1px solid var(--chatbox-border-primary);
		border-radius: var(--chatbox-radius-md);
		font-size: 0.875rem;
		color: var(--chatbox-tint-primary);
		outline: none;
	}

	.search-input input:focus {
		border-color: var(--chatbox-border-brand);
	}

	.models-list {
		max-height: 300px;
		overflow-y: auto;
		padding: 0.5rem;
	}

	.model-item {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem;
		background: transparent;
		border: none;
		border-radius: var(--chatbox-radius-md);
		cursor: pointer;
		transition: background 0.2s ease;
	}

	.model-item:hover {
		background: var(--chatbox-background-secondary);
	}

	.model-item.selected {
		background: var(--chatbox-background-brand-secondary);
	}

	.model-item .model-name {
		font-size: 0.875rem;
		color: var(--chatbox-tint-primary);
	}

	.model-item .model-provider {
		font-size: 0.75rem;
		color: var(--chatbox-tint-tertiary);
	}

	.no-results {
		padding: 1rem;
		text-align: center;
		color: var(--chatbox-tint-secondary);
		font-size: 0.875rem;
	}
</style>
