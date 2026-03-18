<script lang="ts">
	import type { ProviderInfo } from '$shared/types'
	import ModelSelector from '$lib/components/model-selector/ModelSelector.svelte'
	import type { SelectedModel } from '$lib/utils/providers'

	interface Props {
		providers?: ProviderInfo[]
		selectedModel?: SelectedModel | null
		currentTheme?: 'light' | 'dark'
		showSidebarToggle?: boolean
		sidebarOpen?: boolean
		onToggleSidebar?: () => void
		onToggleTheme?: () => void
		onSelectModel?: (provider: string, modelId: string) => void
		class?: string
	}

	let {
		providers = [],
		selectedModel = null,
		currentTheme = 'light',
		showSidebarToggle = true,
		sidebarOpen = true,
		onToggleSidebar,
		onToggleTheme,
		onSelectModel,
		class: className = '',
	}: Props = $props()
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
	</div>

	<div class="header-center">
		<ModelSelector providers={providers} selected={selectedModel} onSelect={onSelectModel} />
	</div>

	<div class="header-right">
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
	</div>
</header>

<style>
	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 0.75rem;
		min-height: 54px;
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
		gap: 0.25rem;
		width: 60px;
		-webkit-app-region: no-drag;
	}

	.header-right {
		justify-content: flex-end;
	}

	.header-center {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
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
</style>
