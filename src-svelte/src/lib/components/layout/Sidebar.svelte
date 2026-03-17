<script lang="ts">
	import { uiStore } from '$lib/stores/ui.svelte'
	import { goto } from '$app/navigation'

	interface Session {
		id: string
		title: string
		updatedAt: number
	}

	interface Props {
		sessions?: Session[]
		currentSessionId?: string | null
		onSelectSession?: (id: string) => void
		onNewSession?: () => void
		class?: string
	}

	let { sessions = [], currentSessionId = null, onSelectSession, onNewSession, class: className = '' }: Props = $props()

	// Use UI store for sidebar state
	const showSidebar = $derived(uiStore.state.showSidebar)

	function formatDate(timestamp: number): string {
		const date = new Date(timestamp)
		const now = new Date()
		const diff = now.getTime() - date.getTime()
		const days = Math.floor(diff / (1000 * 60 * 60 * 24))

		if (days === 0) return 'Today'
		if (days === 1) return 'Yesterday'
		if (days < 7) return `${days} days ago`
		return date.toLocaleDateString()
	}

	function handleSelect(id: string) {
		if (onSelectSession) {
			onSelectSession(id)
		} else {
			goto(`/session/${id}`)
		}
	}

	function handleNewChat() {
		if (onNewSession) {
			onNewSession()
		} else {
			goto('/')
		}
	}
</script>

<aside class="sidebar {className}" class:collapsed={!showSidebar}>
	<div class="sidebar-header">
		<h2>Chats</h2>
		<button class="new-chat-btn" onclick={handleNewChat} title="New Chat">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M12 5v14M5 12h14" />
			</svg>
		</button>
	</div>

	<div class="nav-links">
		<a href="/" class="nav-item">
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
				<polyline points="9,22 9,12 15,12 15,22" />
			</svg>
			<span>Home</span>
		</a>
		<a href="/settings" class="nav-item">
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="12" cy="12" r="3" />
				<path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
			</svg>
			<span>Settings</span>
		</a>
	</div>

	<div class="sessions-list">
		{#if sessions.length === 0}
			<div class="empty-sessions">
				<p>No chats yet</p>
				<button onclick={handleNewChat}>Start a conversation</button>
			</div>
		{:else}
			{#each sessions as session (session.id)}
				<button
					class="session-item"
					class:active={session.id === currentSessionId}
					onclick={() => handleSelect(session.id)}
				>
					<span class="session-icon">💬</span>
					<div class="session-info">
						<span class="session-title">{session.title || 'New Chat'}</span>
						<span class="session-date">{formatDate(session.updatedAt)}</span>
					</div>
				</button>
			{/each}
		{/if}
	</div>
</aside>

<style>
	.sidebar {
		width: 280px;
		height: 100vh;
		background: var(--chatbox-background-secondary);
		border-right: 1px solid var(--chatbox-border-primary);
		display: flex;
		flex-direction: column;
		transition: width 0.2s ease, transform 0.2s ease;
	}

	.sidebar.collapsed {
		width: 0;
		overflow: hidden;
		transform: translateX(-100%);
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem;
		border-bottom: 1px solid var(--chatbox-border-primary);
	}

	.sidebar-header h2 {
		font-size: 1rem;
		font-weight: 600;
		margin: 0;
		color: var(--chatbox-tint-primary);
	}

	.new-chat-btn {
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--chatbox-background-brand-primary);
		color: white;
		border: none;
		border-radius: var(--chatbox-radius-md);
		cursor: pointer;
		transition: background 0.2s ease;
	}

	.new-chat-btn:hover {
		background: var(--chatbox-background-brand-primary-hover);
	}

	.nav-links {
		display: flex;
		flex-direction: column;
		padding: 0.5rem;
		gap: 0.25rem;
		border-bottom: 1px solid var(--chatbox-border-primary);
	}

	.nav-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		color: var(--chatbox-tint-secondary);
		text-decoration: none;
		border-radius: var(--chatbox-radius-md);
		font-size: 0.875rem;
		transition: all 0.2s ease;
	}

	.nav-item:hover {
		background: var(--chatbox-background-tertiary);
		color: var(--chatbox-tint-primary);
	}

	.sessions-list {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem;
	}

	.session-item {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		background: transparent;
		border: none;
		border-radius: var(--chatbox-radius-md);
		cursor: pointer;
		text-align: left;
		transition: background 0.2s ease;
	}

	.session-item:hover {
		background: var(--chatbox-background-tertiary);
	}

	.session-item.active {
		background: var(--chatbox-background-brand-secondary);
	}

	.session-icon {
		font-size: 1.25rem;
	}

	.session-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.session-title {
		font-size: 0.875rem;
		color: var(--chatbox-tint-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.session-date {
		font-size: 0.7rem;
		color: var(--chatbox-tint-tertiary);
	}

	.empty-sessions {
		padding: 2rem 1rem;
		text-align: center;
		color: var(--chatbox-tint-secondary);
	}

	.empty-sessions p {
		margin-bottom: 1rem;
		font-size: 0.875rem;
	}

	.empty-sessions button {
		background: var(--chatbox-background-brand-primary);
		color: white;
		border: none;
		padding: 0.5rem 1rem;
		border-radius: var(--chatbox-radius-md);
		cursor: pointer;
		font-size: 0.875rem;
	}

	.empty-sessions button:hover {
		background: var(--chatbox-background-brand-primary-hover);
	}
</style>
