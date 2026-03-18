<script lang="ts">
	import '../app.css'
	import { goto } from '$app/navigation'
	import { page } from '$app/stores'
	import { onMount } from 'svelte'
	import Header from '$lib/components/layout/Header.svelte'
	import Sidebar from '$lib/components/layout/Sidebar.svelte'
	import { conversationStore } from '$lib/stores/conversation.svelte'
	import { providerCatalogStore } from '$lib/stores/provider-catalog.svelte'
	import { settingsStore } from '$lib/stores/settings.svelte'
	import { themeStore } from '$lib/stores/theme.svelte'
	import { uiStore } from '$lib/stores/ui.svelte'
	import { getAvailableProviders } from '$lib/utils/providers'

	let { children } = $props()
	let bootstrapped = $state(false)

	const pathname = $derived($page.url.pathname)
	const currentSessionId = $derived(pathname.startsWith('/session/') ? $page.params.id : null)
	const isChatRoute = $derived(pathname === '/' || pathname.startsWith('/session/'))
	const providers = $derived(getAvailableProviders(settingsStore.settings, providerCatalogStore.systemProviders))
	const selectedModel = $derived(
		currentSessionId && conversationStore.currentSession?.id === currentSessionId
			? conversationStore.currentSession?.settings?.provider && conversationStore.currentSession?.settings?.modelId
				? {
						provider: conversationStore.currentSession.settings.provider,
						modelId: conversationStore.currentSession.settings.modelId,
					}
				: null
			: conversationStore.draftChatModel
	)

	onMount(async () => {
		await Promise.all([
			settingsStore.init(),
			uiStore.init(),
			themeStore.init(),
			conversationStore.init(),
			providerCatalogStore.init(),
		])
		bootstrapped = true
	})

	$effect(() => {
		if (!bootstrapped) {
			return
		}

		if (currentSessionId) {
			void conversationStore.loadSession(currentSessionId)
			return
		}

		conversationStore.clearCurrentSession()
	})

	function handleSelectModel(provider: string, modelId: string) {
		if (currentSessionId) {
			void conversationStore.updateSessionModel(currentSessionId, { provider, modelId })
			return
		}

		conversationStore.setDraftChatModel({ provider, modelId })
	}
</script>

<div class="app-shell app-container">
	<Sidebar
		open={uiStore.state.showSidebar}
		width={uiStore.state.sidebarWidth ?? 280}
		sessions={conversationStore.sessions}
		{currentSessionId}
		onToggleSidebar={() => uiStore.toggleSidebar()}
		onResizeSidebar={(width) => uiStore.setSidebarWidth(width)}
		onNewSession={() => goto('/')}
		onSelectSession={(id) => goto(`/session/${id}`)}
	/>

	<div class="main-content">
		{#if isChatRoute}
			<Header
				providers={providers}
				selectedModel={selectedModel}
				currentTheme={themeStore.resolvedTheme}
				sidebarOpen={uiStore.state.showSidebar}
				onToggleSidebar={() => uiStore.toggleSidebar()}
				onToggleTheme={() => themeStore.toggle()}
				onSelectModel={handleSelectModel}
			/>
		{/if}

		<main class="page-content">
			{@render children()}
		</main>
	</div>
</div>

<style>
	.app-container {
		display: flex;
		height: 100%;
		width: 100%;
		background: var(--chatbox-background-primary);
		overflow: hidden;
	}

	.main-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
		height: 100%;
	}

	.page-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: hidden;
	}
</style>
