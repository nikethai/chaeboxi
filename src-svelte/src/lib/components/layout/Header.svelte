<script lang="ts">
	import type { ProviderInfo } from '$shared/types'
	import WindowControls from '$lib/components/layout/WindowControls.svelte'
	import ModelSelector from '$lib/components/model-selector/ModelSelector.svelte'
	import type { SelectedModel } from '$lib/utils/providers'

	interface Props {
		providers?: ProviderInfo[]
		selectedModel?: SelectedModel | null
		title?: string
		subtitle?: string
		sessionId?: string | null
		currentTheme?: 'light' | 'dark'
		showSidebarToggle?: boolean
		sidebarOpen?: boolean
		onRenameSession?: (name: string) => Promise<void> | void
		onToggleSidebar?: () => void
		onToggleTheme?: () => void
		onSelectModel?: (provider: string, modelId: string) => void
		class?: string
	}

	let {
		providers = [],
		selectedModel = null,
		title = 'New chat',
		subtitle = 'Start a real conversation',
		sessionId = null,
		currentTheme = 'light',
		showSidebarToggle = true,
		sidebarOpen = true,
		onRenameSession,
		onToggleSidebar,
		onToggleTheme,
		onSelectModel,
		class: className = '',
	}: Props = $props()

	let editingTitle = $state(false)
	let draftTitle = $state('')

	const canRename = $derived(Boolean(sessionId && onRenameSession))

	$effect(() => {
		if (!editingTitle) {
			draftTitle = title
		}
	})

	function startEditing() {
		if (!canRename) {
			return
		}

		draftTitle = title
		editingTitle = true
	}

	function cancelEditing() {
		editingTitle = false
		draftTitle = title
	}

	async function saveTitle() {
		if (!sessionId) {
			cancelEditing()
			return
		}

		const nextTitle = draftTitle.trim()
		if (!nextTitle) {
			cancelEditing()
			return
		}

		await onRenameSession?.(nextTitle)
		editingTitle = false
	}
</script>

<header class="header title-bar {className}">
	<div class="header-left">
		{#if showSidebarToggle}
			<button class="icon-btn" type="button" onclick={onToggleSidebar} title="Toggle Sidebar" aria-label="Toggle Sidebar">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					{#if sidebarOpen}
						<path d="M4 7h16"></path>
						<path d="M4 12h16"></path>
						<path d="M4 17h16"></path>
					{:else}
						<path d="M7 4v16"></path>
						<path d="M11 7l-3 5 3 5"></path>
						<path d="M18 7h-3"></path>
						<path d="M18 12h-5"></path>
						<path d="M18 17h-3"></path>
					{/if}
				</svg>
			</button>
		{/if}

		<ModelSelector providers={providers} selected={selectedModel} onSelect={onSelectModel} />
	</div>

	<div class="header-center">
		{#if editingTitle}
			<div class="title-editor">
				<input
					bind:value={draftTitle}
					aria-label="Session title"
					onkeydown={(event) => {
						if (event.key === 'Enter') {
							event.preventDefault()
							void saveTitle()
						}
						if (event.key === 'Escape') {
							cancelEditing()
						}
					}}
				/>
				<button class="action-btn save-btn" type="button" onclick={() => void saveTitle()}>Save</button>
				<button class="action-btn" type="button" onclick={cancelEditing}>Cancel</button>
			</div>
		{:else}
			<div class="title-stack">
				<div class="title-eyebrow">{sessionId ? 'Conversation' : 'New chat'}</div>
				<div class="title-text" title={title}>{title}</div>
				<div class="title-subtitle" title={subtitle}>{subtitle}</div>
			</div>
		{/if}
	</div>

	<div class="header-right">
		{#if canRename && !editingTitle}
			<button class="icon-btn" type="button" onclick={startEditing} title="Rename conversation" aria-label="Rename conversation">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M12 20h9" />
					<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
				</svg>
			</button>
		{/if}

		<button class="icon-btn" type="button" onclick={onToggleTheme} title="Toggle Theme" aria-label="Toggle Theme">
			{#if currentTheme === 'dark'}
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="5"></circle>
					<line x1="12" y1="1" x2="12" y2="3"></line>
					<line x1="12" y1="21" x2="12" y2="23"></line>
					<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
					<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
					<line x1="1" y1="12" x2="3" y2="12"></line>
					<line x1="21" y1="12" x2="23" y2="12"></line>
					<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
					<line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
				</svg>
			{:else}
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
				</svg>
			{/if}
		</button>

		<WindowControls />
	</div>
</header>

<style>
	.header {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0.75rem 0.5rem 0.625rem;
		min-height: 58px;
		background: var(--chatbox-background-primary);
		border-bottom: 1px solid var(--chatbox-border-primary);
		position: relative;
		flex-shrink: 0;
		-webkit-app-region: drag;
	}

	.header-left,
	.header-right {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		min-width: 0;
		-webkit-app-region: no-drag;
	}

	.header-right {
		justify-content: flex-end;
	}

	.header-center {
		min-width: 0;
		-webkit-app-region: no-drag;
	}

	.icon-btn {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		color: var(--chatbox-tint-tertiary);
		transition: all 0.15s ease;
	}

	.icon-btn:hover {
		background: var(--chatbox-background-secondary);
		color: var(--chatbox-tint-primary);
	}

	.title-stack {
		width: min(100%, 34rem);
		text-align: center;
	}

	.title-eyebrow {
		font-size: 0.64rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--chatbox-tint-tertiary);
	}

	.title-text {
		margin-top: 0.1rem;
		font-size: 0.98rem;
		font-weight: 700;
		line-height: 1.2;
		color: var(--chatbox-tint-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.title-subtitle {
		margin-top: 0.12rem;
		font-size: 0.75rem;
		line-height: 1.2;
		color: var(--chatbox-tint-tertiary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.title-editor {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: min(100%, 34rem);
	}

	.title-editor input {
		flex: 1;
		min-width: 0;
		height: 2.2rem;
		padding: 0 0.8rem;
		border-radius: 999px;
		border: 1px solid var(--chatbox-border-brand);
		background: var(--chatbox-background-primary);
		color: var(--chatbox-tint-primary);
		font-size: 0.9rem;
	}

	.action-btn {
		height: 2.2rem;
		padding: 0 0.8rem;
		border-radius: 999px;
		border: 1px solid var(--chatbox-border-primary);
		background: var(--chatbox-background-secondary);
		color: var(--chatbox-tint-secondary);
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
	}

	.action-btn.save-btn {
		background: var(--chatbox-background-brand-primary);
		border-color: var(--chatbox-background-brand-primary);
		color: var(--chatbox-tint-white);
	}

	@media (max-width: 900px) {
		.header {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr) minmax(0, 1fr);
		}
	}

	@media (max-width: 760px) {
		.title-subtitle {
			display: none;
		}
	}
</style>
