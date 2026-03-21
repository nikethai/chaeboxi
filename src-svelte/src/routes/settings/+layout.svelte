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
				<h1>Settings</h1>
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
			width: clamp(184px, 18vw, 216px);
			min-width: 184px;
			max-width: 216px;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		padding: 0.75rem;
		border-right: 1px solid var(--chatbox-border-primary);
		background: color-mix(in srgb, var(--chatbox-background-secondary), transparent 82%);
		overflow-y: auto;
	}

		.settings-nav-header {
			padding: 0.2rem 0.1rem 0.35rem;
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
			font-size: 0.88rem;
			line-height: 1.1;
			color: var(--chatbox-tint-primary);
		}

		.settings-nav {
			display: flex;
			flex-direction: column;
			gap: 0.24rem;
		}

	.settings-nav-item {
		display: flex;
		align-items: center;
			gap: 0.5rem;
			padding: 0.54rem 0.62rem;
			border: 1px solid transparent;
			border-radius: 12px;
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
			font-size: 0.78rem;
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
			display: none;
		}

		.item-chevron {
			font-size: 0.88rem;
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
				border: 1px solid var(--chatbox-border-primary);
				border-radius: 16px;
				background: color-mix(in srgb, var(--chatbox-background-secondary), transparent 8%);
			}

			.item-copy p {
				display: block;
				margin: 0.24rem 0 0;
				font-size: 0.72rem;
				line-height: 1.35;
				color: var(--chatbox-tint-secondary);
			}
		}
</style>
