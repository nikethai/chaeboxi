<script lang="ts">
	import { goto } from '$app/navigation'
	import { ModelProviderType, type ProviderBaseInfo, type Settings } from '$shared/types'
	import SelectMenu from '$lib/components/common/SelectMenu.svelte'
	import {
		createCustomProvider,
		customProviderTypeOptions,
		isProviderConfigured,
	} from '$lib/stores/provider-settings'

	interface Props {
		providers?: ProviderBaseInfo[]
		settings: Settings
		selectedProviderId?: string | null
		mobile?: boolean
	}

	let { providers = [], settings, selectedProviderId = null, mobile = false }: Props = $props()

	let showCreateForm = $state(false)
	let newProviderName = $state('')
	let newProviderType = $state<ModelProviderType>(ModelProviderType.OpenAI)

	function openProvider(providerId: string) {
		void goto(`/settings/provider/${providerId}`)
	}

	function cancelCreate() {
		showCreateForm = false
		newProviderName = ''
		newProviderType = ModelProviderType.OpenAI
	}

	function handleCreateProvider(event: SubmitEvent) {
		event.preventDefault()

		if (!newProviderName.trim()) {
			return
		}

		const providerId = createCustomProvider(newProviderName, newProviderType)
		cancelCreate()
		void goto(`/settings/provider/${providerId}`)
	}

	function getProviderTone(providerId: string) {
		const palette = [
			['#0f766e', '#99f6e4'],
			['#1d4ed8', '#bfdbfe'],
			['#7c3aed', '#ddd6fe'],
			['#b45309', '#fde68a'],
			['#be123c', '#fecdd3'],
			['#166534', '#bbf7d0'],
			['#4338ca', '#c7d2fe'],
			['#374151', '#d1d5db'],
		] as const

		const index = providerId.split('').reduce((total, char) => total + char.charCodeAt(0), 0) % palette.length
		return palette[index]
	}
</script>

<section class="provider-list">
	<div class="provider-list-header">
		<div>
			<p class="eyebrow">Provider Setup</p>
			<h2>Providers</h2>
			<p class="copy">Built-ins and custom providers now write to the real settings store used by chat.</p>
		</div>

		<button class="primary-btn" type="button" onclick={() => (showCreateForm = !showCreateForm)}>
			{showCreateForm ? 'Close' : 'Add provider'}
		</button>
	</div>

	{#if showCreateForm}
		<form class="create-panel" onsubmit={handleCreateProvider}>
			<div class="field-grid">
				<label class="field">
					<span>Name</span>
					<input bind:value={newProviderName} placeholder="My provider" maxlength="48" />
				</label>

				<label class="field">
					<span>API Mode</span>
					<SelectMenu
						options={customProviderTypeOptions}
						value={newProviderType}
						onChange={(value) => (newProviderType = value as ModelProviderType)}
					/>
				</label>
			</div>

			<div class="panel-actions">
				<button class="ghost-btn" type="button" onclick={cancelCreate}>Cancel</button>
				<button class="primary-btn" type="submit" disabled={!newProviderName.trim()}>Create provider</button>
			</div>
		</form>
	{/if}

	<div class="provider-rows">
		{#each providers as provider (provider.id)}
			{@const configured = isProviderConfigured(provider, settings)}
			{@const tone = getProviderTone(provider.id)}

			<button
				class="provider-row"
				class:active={provider.id === selectedProviderId}
				type="button"
				onclick={() => openProvider(provider.id)}
			>
				<div class="provider-avatar" style={`--provider-accent:${tone[0]}; --provider-tint:${tone[1]};`}>
					{provider.name.slice(0, 1).toUpperCase()}
				</div>

				<div class="provider-body">
					<div class="provider-headline">
						<span class="provider-name">{provider.name}</span>
						<span class="provider-kind">{provider.isCustom ? 'Custom' : 'Built-in'}</span>
					</div>

					<div class="provider-meta">
						<span class:configured class="status-pill">
							{configured ? 'Configured' : 'Needs setup'}
						</span>
						{#if provider.description}
							<span class="description">{provider.description}</span>
						{:else if provider.isCustom}
							<span class="description">Editable OpenAI-style provider profile.</span>
						{:else}
							<span class="description">{provider.type} transport</span>
						{/if}
					</div>
				</div>

				{#if mobile}
					<span class="row-chevron" aria-hidden="true">›</span>
				{/if}
			</button>
		{/each}
	</div>

	<div class="scope-note">
		<div class="scope-badge">Out of scope</div>
		<p>Import, deep-link setup, and capability testing stay hidden until their Svelte paths are genuinely complete.</p>
	</div>
</section>

<style>
	.provider-list {
		display: flex;
		flex-direction: column;
		min-height: 0;
		height: 100%;
		padding: 0.72rem;
		gap: 0.65rem;
		background: var(--chatbox-background-primary);
	}

	.provider-list-header {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: start;
		gap: 0.6rem;
	}

	.eyebrow {
		margin: 0 0 0.18rem;
		font-size: 0.66rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--chatbox-tint-tertiary);
	}

	h2 {
		margin: 0;
		font-size: 0.9rem;
		line-height: 1.2;
		color: var(--chatbox-tint-primary);
	}

	.copy {
		margin: 0.22rem 0 0;
		font-size: 0.72rem;
		line-height: 1.35;
		color: var(--chatbox-tint-secondary);
		max-width: 18rem;
	}

	.create-panel,
	.scope-note {
		padding: 0.68rem;
		border: 1px solid var(--chatbox-border-primary);
		border-radius: 13px;
		background: color-mix(in srgb, var(--chatbox-background-secondary), transparent 10%);
	}

	.field-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.65rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.74rem;
		font-weight: 600;
		color: var(--chatbox-tint-secondary);
	}

	.field input {
		width: 100%;
		min-height: 2.2rem;
		padding: 0.48rem 0.7rem;
		border-radius: 12px;
		border: 1px solid var(--chatbox-border-primary);
		background: var(--chatbox-background-primary);
		color: var(--chatbox-tint-primary);
		box-sizing: border-box;
	}

	.panel-actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}

	.provider-rows {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		overflow-y: auto;
		min-height: 0;
		padding-right: 0.1rem;
	}

	.provider-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.64rem 0.7rem;
		border-radius: 13px;
		border: 1px solid transparent;
		background: transparent;
		color: inherit;
		text-align: left;
		cursor: pointer;
		transition:
			background 0.15s ease,
			border-color 0.15s ease,
			transform 0.15s ease;
	}

	.provider-row:hover {
		background: var(--chatbox-background-secondary);
		border-color: var(--chatbox-border-primary);
		transform: translateY(-1px);
	}

	.provider-row.active {
		background: color-mix(in srgb, var(--chatbox-background-brand-secondary), var(--chatbox-background-primary) 35%);
		border-color: color-mix(in srgb, var(--chatbox-border-brand), transparent 30%);
	}

	.provider-avatar {
		width: 1.95rem;
		height: 1.95rem;
		border-radius: 11px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.86rem;
		font-weight: 700;
		flex-shrink: 0;
		color: var(--provider-accent);
		background: color-mix(in srgb, var(--provider-tint), white 18%);
		border: 1px solid color-mix(in srgb, var(--provider-accent), white 55%);
	}

	.provider-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.provider-headline,
	.provider-meta {
		display: flex;
		align-items: center;
		gap: 0.42rem;
		min-width: 0;
	}

	.provider-name {
		font-size: 0.8rem;
		font-weight: 700;
		line-height: 1.2;
		color: var(--chatbox-tint-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.provider-kind,
	.status-pill,
	.scope-badge {
		display: inline-flex;
		align-items: center;
		padding: 0.14rem 0.4rem;
		border-radius: 999px;
		font-size: 0.64rem;
		font-weight: 700;
		letter-spacing: 0.02em;
	}

	.provider-kind {
		background: var(--chatbox-background-secondary);
		color: var(--chatbox-tint-tertiary);
	}

	.status-pill {
		background: var(--chatbox-background-warning-secondary);
		color: var(--chatbox-tint-warning);
		flex-shrink: 0;
	}

	.status-pill.configured {
		background: var(--chatbox-background-success-secondary);
		color: var(--chatbox-tint-success);
	}

	.description {
		font-size: 0.68rem;
		color: var(--chatbox-tint-tertiary);
		line-height: 1.3;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.row-chevron {
		font-size: 1rem;
		color: var(--chatbox-tint-tertiary);
		flex-shrink: 0;
	}

	.scope-note {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.scope-badge {
		width: fit-content;
		background: var(--chatbox-background-warning-secondary);
		color: var(--chatbox-tint-warning);
	}

	.scope-note p {
		margin: 0;
		font-size: 0.7rem;
		line-height: 1.35;
		color: var(--chatbox-tint-secondary);
	}

	.primary-btn,
	.ghost-btn {
		min-height: 1.95rem;
		padding: 0.34rem 0.72rem;
		border-radius: 999px;
		font-size: 0.72rem;
		font-weight: 700;
		cursor: pointer;
		border: 1px solid transparent;
		transition:
			background 0.15s ease,
			border-color 0.15s ease,
			color 0.15s ease;
	}

	.primary-btn {
		background: var(--chatbox-background-brand-primary);
		color: var(--chatbox-tint-white);
	}

	.primary-btn:hover:enabled {
		background: var(--chatbox-background-brand-primary-hover);
	}

	.primary-btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.ghost-btn {
		background: var(--chatbox-background-primary);
		border-color: var(--chatbox-border-primary);
		color: var(--chatbox-tint-secondary);
	}

	.ghost-btn:hover {
		background: var(--chatbox-background-secondary);
	}

	@media (max-width: 960px) {
		.provider-list {
			padding: 0.7rem;
		}

		.field-grid {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
