<script lang="ts">
	import { page } from '$app/stores'
	import { onMount } from 'svelte'
	import platform from '$lib/platform'
	import { providerCatalogStore } from '$lib/stores/provider-catalog.svelte'
	import { settingsStore } from '$lib/stores/settings.svelte'

	let { children } = $props()
	let compactLayout = $state(false)

	type SettingsNavItem = {
		key: string
		href: string
		label: string
		description: string
		badge?: string
	}

	const pathname = $derived($page.url.pathname)

	const navItems = $derived.by(() => {
		const items: SettingsNavItem[] = [
			{
				key: 'provider',
				href: '/settings/provider',
				label: 'Model Provider',
				description: 'Credentials, endpoints, model lists, and custom providers.',
			},
			{
				key: 'default-models',
				href: '/settings/default-models',
				label: 'Default Models',
				description: 'Pick the default chat, title, search, and OCR models.',
			},
			{
				key: 'web-search',
				href: '/settings/web-search',
				label: 'Web Search',
				description: 'Select the search backend and persist provider credentials.',
			},
			{
				key: 'document-parser',
				href: '/settings/document-parser',
				label: 'Document Parser',
				description: 'Still partial in Svelte.',
				badge: 'Partial',
			},
			{
				key: 'chat',
				href: '/settings/chat',
				label: 'Chat Settings',
				description: 'Conversation defaults, rendering, and context behavior.',
			},
			{
				key: 'general',
				href: '/settings/general',
				label: 'General Settings',
				description: 'Theme, language, font size, startup, proxy, and reporting.',
			},
		]

		if (platform.type === 'desktop') {
			items.splice(3, 0, {
				key: 'mcp',
				href: '/settings/mcp',
				label: 'MCP',
				description: 'Still partial in Svelte.',
				badge: 'Partial',
			})
			items.splice(4, 0, {
				key: 'knowledge-base',
				href: '/settings/knowledge-base',
				label: 'Knowledge Base',
				description: 'Still partial in Svelte.',
				badge: 'Partial',
			})
			items.splice(items.length - 1, 0, {
				key: 'hotkeys',
				href: '/settings/hotkeys',
				label: 'Keyboard Shortcuts',
				description: 'Still partial in Svelte.',
				badge: 'Partial',
			})
		}

		return items
	})

	const showingNavOnly = $derived(compactLayout && pathname === '/settings')

	onMount(() => {
		let cleanup = () => {}

		void (async () => {
			await Promise.all([settingsStore.init(), providerCatalogStore.init()])

			const mediaQuery = window.matchMedia('(max-width: 960px)')
			const syncLayout = () => {
				compactLayout = mediaQuery.matches
			}

			syncLayout()
			mediaQuery.addEventListener('change', syncLayout)
			cleanup = () => {
				mediaQuery.removeEventListener('change', syncLayout)
			}
		})()

		return () => {
			cleanup()
		}
	})

	function isActive(item: SettingsNavItem) {
		return pathname === item.href || pathname.startsWith(`${item.href}/`)
	}
</script>

<div class="settings-layout">
	{#if !compactLayout || showingNavOnly}
		<aside class="settings-nav-pane">
			<div class="settings-nav-header">
				<p class="eyebrow">Settings</p>
				<h1>Core settings now live in the Svelte shell.</h1>
				<p>
					Provider, general, chat, default-model, and web-search settings now use the real shared store. Remaining areas stay
					explicitly partial until they are actually ported.
				</p>
			</div>

			<nav class="settings-nav">
				{#each navItems as item (item.key)}
					<a href={item.href} class:active={isActive(item)} class="settings-nav-item">
						<div class="item-copy">
							<div class="item-title-row">
								<span class="item-title">{item.label}</span>
								{#if item.badge}
									<span class="item-badge">{item.badge}</span>
								{/if}
							</div>
							<p>{item.description}</p>
						</div>
						<span class="item-chevron" aria-hidden="true">›</span>
					</a>
				{/each}
			</nav>
		</aside>
	{/if}

	{#if !compactLayout || !showingNavOnly}
		<section class="settings-detail-pane">
			{@render children()}
		</section>
	{/if}
</div>

<style>
	.settings-layout {
		display: flex;
		flex: 1;
		min-height: 0;
		height: 100%;
		background: var(--chatbox-background-primary);
	}

	.settings-nav-pane {
		width: min(312px, 32vw);
		min-width: 264px;
		max-width: 344px;
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		padding: 0.9rem;
		border-right: 1px solid var(--chatbox-border-primary);
		background: color-mix(in srgb, var(--chatbox-background-secondary), transparent 82%);
		overflow-y: auto;
	}

	.settings-nav-header {
		padding: 0.95rem 1rem;
		border: 1px solid var(--chatbox-border-primary);
		border-radius: 18px;
		background: color-mix(in srgb, var(--chatbox-background-secondary), transparent 8%);
	}

	.eyebrow {
		margin: 0 0 0.22rem;
		font-size: 0.66rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--chatbox-tint-tertiary);
	}

	h1 {
		margin: 0;
		font-size: 1.06rem;
		line-height: 1.16;
		color: var(--chatbox-tint-primary);
	}

	.settings-nav-header p:last-child {
		margin: 0.45rem 0 0;
		font-size: 0.8rem;
		line-height: 1.45;
		color: var(--chatbox-tint-secondary);
	}

	.settings-nav {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.settings-nav-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.8rem 0.9rem;
		border: 1px solid transparent;
		border-radius: 16px;
		text-decoration: none;
		color: inherit;
		transition:
			background 0.15s ease,
			border-color 0.15s ease,
			transform 0.15s ease;
	}

	.settings-nav-item:hover {
		background: var(--chatbox-background-secondary);
		border-color: var(--chatbox-border-primary);
		transform: translateY(-1px);
	}

	.settings-nav-item.active {
		background: var(--chatbox-background-brand-secondary);
		border-color: color-mix(in srgb, var(--chatbox-border-brand), transparent 24%);
	}

	.item-copy {
		flex: 1;
		min-width: 0;
	}

	.item-title-row {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		min-width: 0;
	}

	.item-title {
		font-size: 0.88rem;
		font-weight: 700;
		line-height: 1.2;
		color: var(--chatbox-tint-primary);
	}

	.item-badge {
		display: inline-flex;
		align-items: center;
		padding: 0.14rem 0.42rem;
		border-radius: 999px;
		background: var(--chatbox-background-warning-secondary);
		color: var(--chatbox-tint-warning);
		font-size: 0.66rem;
		font-weight: 700;
		flex-shrink: 0;
	}

	.item-copy p {
		margin: 0.3rem 0 0;
		font-size: 0.76rem;
		line-height: 1.4;
		color: var(--chatbox-tint-secondary);
	}

	.item-chevron {
		font-size: 1rem;
		color: var(--chatbox-tint-tertiary);
		flex-shrink: 0;
	}

	.settings-detail-pane {
		flex: 1;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		background: var(--chatbox-background-primary);
	}

	@media (max-width: 960px) {
		.settings-layout {
			display: block;
		}

		.settings-nav-pane,
		.settings-detail-pane {
			width: 100%;
			min-width: 0;
			max-width: none;
			height: 100%;
		}

		.settings-nav-pane {
			padding: 0.85rem;
			border-right: 0;
		}

		.settings-nav-header {
			padding: 0.9rem;
		}
	}
</style>
