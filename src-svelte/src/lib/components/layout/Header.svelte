<script lang="ts">
	import { uiStore } from '$lib/stores/ui.svelte'
	import { themeStore } from '$lib/stores/theme.svelte'

	interface Props {
		title?: string
		showSidebarToggle?: boolean
		class?: string
	}

	let { title = 'Chaeboxi', showSidebarToggle = true, class: className = '' }: Props = $props()

	function toggleSidebar() {
		uiStore.toggleSidebar()
	}

	function toggleTheme() {
		themeStore.toggle()
	}

	const currentTheme = $derived(themeStore.resolvedTheme)
</script>

<header class="header {className}">
	<div class="header-left">
		{#if showSidebarToggle}
			<button class="icon-btn" onclick={toggleSidebar} title="Toggle Sidebar">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M3 12h18M3 6h18M3 18h18" />
				</svg>
			</button>
		{/if}
		<h1 class="title">{title}</h1>
	</div>

	<div class="header-right">
		<button class="icon-btn" onclick={toggleTheme} title="Toggle Theme">
			{#if currentTheme === 'dark'}
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="5" />
					<path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
				</svg>
			{:else}
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
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
		padding: 0.75rem 1rem;
		background: var(--chatbox-background-secondary);
		border-bottom: 1px solid var(--chatbox-border-primary);
		-webkit-app-region: drag;
	}

	.header-left,
	.header-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		-webkit-app-region: no-drag;
	}

	.title {
		font-size: 1rem;
		font-weight: 600;
		margin: 0;
		color: var(--chatbox-tint-primary);
	}

	.icon-btn {
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: var(--chatbox-radius-md);
		cursor: pointer;
		color: var(--chatbox-tint-secondary);
		transition: all 0.2s ease;
	}

	.icon-btn:hover {
		background: var(--chatbox-background-tertiary);
		color: var(--chatbox-tint-primary);
	}
</style>
