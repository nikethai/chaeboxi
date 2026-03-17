<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { uiStore } from '$lib/stores/ui.svelte';
	import Header from '$lib/components/layout/Header.svelte';
	import Sidebar from '$lib/components/layout/Sidebar.svelte';

	let { children } = $props();

	const showSidebar = $derived(uiStore.state.showSidebar);

	onMount(() => {
		// Apply theme class to document
		const savedTheme = localStorage.getItem('initial-theme');
		if (savedTheme === 'dark') {
			document.documentElement.classList.add('dark');
		}
	});

	function handleNewSession() {
		// TODO: Implement new session creation
		console.log('New session');
	}

	function handleSelectSession(id: string) {
		// TODO: Implement session selection
		console.log('Select session:', id);
	}
</script>

<div class="app-container">
	{#if $page.url.pathname !== '/settings'}
		<Sidebar
			onNewSession={handleNewSession}
			onSelectSession={handleSelectSession}
		/>
	{/if}

	<div class="main-content" class:sidebar-open={showSidebar && $page.url.pathname !== '/settings'}>
		<Header />
		<main class="page-content">
			{@render children()}
		</main>
	</div>
</div>

<style>
	.app-container {
		display: flex;
		min-height: 100vh;
		background: var(--chatbox-background-primary);
	}

	.main-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
		transition: margin-left 0.2s ease;
	}

	.main-content.sidebar-open {
		margin-left: 0;
	}

	.page-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
</style>
