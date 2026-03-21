<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/stores'
	import type { SessionMeta } from '$shared/types'

	interface Props {
		sessions?: SessionMeta[]
		currentSessionId?: string | null
		open?: boolean
		width?: number
		chatMode?: boolean
		onSelectSession?: (id: string) => void
		onNewSession?: () => void
		onToggleSidebar?: () => void
		onResizeSidebar?: (width: number) => void
		class?: string
	}

	let {
		sessions = [],
		currentSessionId = null,
		open = true,
		width = 280,
		chatMode = true,
		onSelectSession,
		onNewSession,
		onToggleSidebar,
		onResizeSidebar,
		class: className = '',
	}: Props = $props()

	let isResizing = $state(false)
	let resizeStartX = 0
	let resizeStartWidth = 0

	const pathname = $derived($page.url.pathname)
	const navItems = [
		{ href: '/settings', label: 'Settings', badge: null, icon: 'settings' },
		{ href: '/image-creator', label: 'Image Creator', badge: null, icon: 'image' },
		{ href: '/about', label: 'About', badge: 'Partial', icon: 'about' },
	] as const

	function handleSelect(id: string) {
		if (onSelectSession) onSelectSession(id)
		else goto(`/session/${id}`)
	}

	function handleNewChat() {
		if (onNewSession) onNewSession()
		else goto('/')
	}

	function handleResizeStart(event: MouseEvent) {
		if (!onResizeSidebar) {
			return
		}

		event.preventDefault()
		isResizing = true
		resizeStartX = event.clientX
		resizeStartWidth = width

		const handleMouseMove = (moveEvent: MouseEvent) => {
			const nextWidth = Math.max(216, Math.min(360, resizeStartWidth + moveEvent.clientX - resizeStartX))
			onResizeSidebar?.(nextWidth)
		}

		const handleMouseUp = () => {
			isResizing = false
			window.removeEventListener('mousemove', handleMouseMove)
			window.removeEventListener('mouseup', handleMouseUp)
		}

		window.addEventListener('mousemove', handleMouseMove)
		window.addEventListener('mouseup', handleMouseUp)
	}
</script>

<aside
	class="sidebar {className}"
	class:collapsed={!open}
	class:non-chat={!chatMode}
	class:resizing={isResizing}
	style={`width: ${open ? `${width}px` : '0px'};`}
>
	<div class="sidebar-header">
		<div class="brand">
			<div class="brand-icon">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
				</svg>
			</div>
			<div class="brand-copy">
				<span class="brand-name">Chaeboxi</span>
				<span class="brand-subtitle">Svelte revamp shell</span>
			</div>
		</div>

		<button class="icon-btn" type="button" onclick={onToggleSidebar} title="Collapse Sidebar" aria-label="Collapse Sidebar">
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M11 19l-7-7 7-7" /><path d="M21 12H4" />
			</svg>
		</button>
	</div>

	<div class="primary-action">
		<button class="action-btn-light" type="button" onclick={handleNewChat}>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="12" r="10" />
				<line x1="12" y1="8" x2="12" y2="16" />
				<line x1="8" y1="12" x2="16" y2="12" />
			</svg>
			New Chat
		</button>
	</div>

	{#if chatMode}
		<div class="section-heading">
			<span>Conversations</span>
			<span class="section-count">{sessions.length}</span>
		</div>

		<div class="sessions-list">
			{#if sessions.length === 0}
				<div class="empty-sessions">
					<p class="empty-title">No conversations yet</p>
					<p class="empty-copy">Start from the real `/` route and new sessions will appear here.</p>
				</div>
			{:else}
				{#each sessions as session (session.id)}
					<button
						class="session-item"
						class:active={session.id === currentSessionId}
						type="button"
						onclick={() => handleSelect(session.id)}
					>
						<svg class="session-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
						</svg>

						<div class="session-info">
							<span class="session-title">{session.name || 'Untitled'}</span>
							<span class="session-subtitle">{session.id === currentSessionId ? 'Current conversation' : 'Open conversation'}</span>
						</div>
					</button>
				{/each}
			{/if}
		</div>
	{/if}

	<div class="sidebar-footer">
		<div class="section-heading section-heading-footer">
			<span>Explore</span>
			<span class="section-tag">Route status</span>
		</div>

		<div class="nav-links">
			{#each navItems as item (item.href)}
				<a href={item.href} class="nav-item" class:active={pathname === item.href}>
					{#if item.icon === 'settings'}
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="12" cy="12" r="3" />
							<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
						</svg>
					{:else if item.icon === 'image'}
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<rect x="3" y="3" width="18" height="18" rx="2" />
							<circle cx="8.5" cy="8.5" r="1.5" />
							<path d="m21 15-5-5L5 21" />
						</svg>
					{:else}
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="12" cy="12" r="10" />
							<path d="M12 16v-4" />
							<path d="M12 8h.01" />
						</svg>
					{/if}

					<span>{item.label}</span>
					{#if item.badge}
						<span class="nav-tag">{item.badge}</span>
					{/if}
				</a>
			{/each}
		</div>
	</div>

	{#if onResizeSidebar}
		<div class="sidebar-resizer" role="presentation" onmousedown={handleResizeStart}></div>
	{/if}
</aside>

<style>
	.sidebar {
		height: 100%;
		background: var(--chatbox-background-primary);
		border-right: 1px solid var(--chatbox-border-primary);
		display: flex;
		flex-direction: column;
		transition: width 0.2s ease, opacity 0.2s ease, transform 0.2s ease;
		flex-shrink: 0;
		overflow: hidden;
		position: relative;
	}

	.sidebar.collapsed {
		opacity: 0;
		transform: translateX(-8px);
		border-right-color: transparent;
	}

	.sidebar.resizing {
		user-select: none;
	}

	.sidebar.non-chat {
		background: color-mix(in srgb, var(--chatbox-background-secondary), transparent 88%);
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.8rem 0.78rem 0.58rem;
		flex-shrink: 0;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		min-width: 0;
	}

	.brand-icon {
		width: 28px;
		height: 28px;
		border-radius: 8px;
		background: var(--chatbox-background-brand-primary);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.brand-copy {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.brand-name {
		font-size: 0.9rem;
		font-weight: 700;
		color: var(--chatbox-tint-primary);
		white-space: nowrap;
	}

	.brand-subtitle {
		font-size: 0.66rem;
		color: var(--chatbox-tint-tertiary);
		white-space: nowrap;
	}

	.icon-btn {
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		color: var(--chatbox-tint-tertiary);
		transition: all 0.15s ease;
		padding: 0;
	}

	.icon-btn:hover {
		background: var(--chatbox-background-secondary);
		color: var(--chatbox-tint-primary);
	}

	.primary-action,
	.section-heading,
	.sidebar-footer {
		padding-inline: 0.55rem;
	}

	.primary-action {
		padding-bottom: 0.4rem;
	}

	.action-btn-light {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.56rem 0.78rem;
		background: var(--chatbox-background-secondary);
		color: var(--chatbox-tint-primary);
		border: 1px solid var(--chatbox-border-primary);
		border-radius: 11px;
		cursor: pointer;
		font-size: 0.82rem;
		font-weight: 600;
		transition: background 0.15s ease, border-color 0.15s ease;
		text-align: left;
	}

	.action-btn-light:hover {
		background: var(--chatbox-background-secondary-hover);
		border-color: var(--chatbox-border-secondary);
	}

	.section-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 0.28rem;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--chatbox-tint-tertiary);
	}

	.section-heading-footer {
		padding-inline: 0;
	}

	.section-count,
	.section-tag {
		display: inline-flex;
		align-items: center;
		padding: 0.2rem 0.45rem;
		border-radius: 999px;
		border: 1px solid var(--chatbox-border-primary);
		background: var(--chatbox-background-secondary);
		font-size: 0.64rem;
	}

	.sessions-list {
		flex: 1;
		overflow-y: auto;
		padding: 0 0.45rem 0.62rem;
	}

	.session-item {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.48rem 0.62rem;
		background: transparent;
		border: 1px solid transparent;
		border-radius: 11px;
		cursor: pointer;
		text-align: left;
		transition: background 0.15s ease, border-color 0.15s ease;
		color: var(--chatbox-tint-secondary);
	}

	.session-item:hover {
		background: var(--chatbox-background-secondary);
		border-color: var(--chatbox-border-primary);
	}

	.session-item.active {
		background: var(--chatbox-background-brand-secondary);
		color: var(--chatbox-tint-brand);
		border-color: color-mix(in srgb, var(--chatbox-border-brand), transparent 20%);
	}

	.session-icon {
		flex-shrink: 0;
		opacity: 0.6;
	}

	.session-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.session-title {
		font-size: 0.8rem;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.session-subtitle {
		font-size: 0.66rem;
		color: var(--chatbox-tint-tertiary);
		margin-top: 0.12rem;
	}

	.empty-sessions {
		padding: 1rem 0.68rem;
		border-radius: 14px;
		border: 1px dashed var(--chatbox-border-primary);
		background: color-mix(in srgb, var(--chatbox-background-secondary), transparent 30%);
		text-align: left;
	}

	.empty-title {
		margin: 0;
		font-size: 0.82rem;
		font-weight: 700;
		color: var(--chatbox-tint-primary);
	}

	.empty-copy {
		margin: 0.28rem 0 0;
		color: var(--chatbox-tint-tertiary);
		font-size: 0.72rem;
		line-height: 1.4;
	}

	.sidebar-footer {
		flex-shrink: 0;
		padding-top: 0.62rem;
		padding-bottom: 0.68rem;
		border-top: 1px solid var(--chatbox-border-primary);
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		margin-top: auto;
	}

	.sidebar.non-chat .sidebar-footer {
		border-top: 0;
		padding-top: 0.25rem;
	}

	.nav-links {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.nav-item {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.52rem 0.64rem;
		color: var(--chatbox-tint-secondary);
		text-decoration: none;
		border-radius: 11px;
		font-size: 0.78rem;
		transition: all 0.15s ease;
		border: 1px solid transparent;
	}

	.nav-item:hover {
		background: var(--chatbox-background-secondary);
		color: var(--chatbox-tint-primary);
		border-color: var(--chatbox-border-primary);
	}

	.nav-item.active {
		background: var(--chatbox-background-brand-secondary);
		color: var(--chatbox-tint-brand);
		border-color: color-mix(in srgb, var(--chatbox-border-brand), transparent 25%);
	}

	.nav-item span:first-of-type {
		flex: 1;
	}

	.nav-tag {
		font-size: 0.68rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--chatbox-tint-tertiary);
	}

	.sidebar-resizer {
		position: absolute;
		top: 0;
		right: -3px;
		bottom: 0;
		width: 6px;
		cursor: col-resize;
	}
</style>
