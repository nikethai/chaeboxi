<script lang="ts">
	import { settingsStore } from '$lib/stores/settings.svelte'
	import { Markdown } from '$lib/components/markdown'
	import type { Message } from '$shared/types'

	interface Props {
		message: Message
		showAvatar?: boolean
		showActions?: boolean
		compact?: boolean
		class?: string
	}

	let { message, showAvatar = true, showActions = true, compact = false, class: className = '' }: Props = $props()

	// Message type derived from role
	const role = $derived(message.role)
	const isUser = $derived(role === 'user')
	const isSystem = $derived(role === 'system')
	const isAssistant = $derived(role === 'assistant')

	// Get message content
	const content = $derived(
		typeof message.content === 'string'
			? message.content
			: message.content?.text || ''
	)

	// Check if streaming
	const isGenerating = $derived(message.status === 'generating')

	// Actions
	let copied = $state(false)

	async function copyMessage() {
		await navigator.clipboard.writeText(content)
		copied = true
		setTimeout(() => (copied = false), 2000)
	}

	// Get avatar based on role
	function getAvatarIcon(): string {
		switch (role) {
			case 'user':
				return '👤'
			case 'assistant':
				return '🤖'
			case 'system':
				return '⚙️'
			default:
				return '💬'
		}
	}
</script>

<div
	class="message {className}"
	class:message-user={isUser}
	class:message-assistant={isAssistant}
	class:message-system={isSystem}
	class:message-generating={isGenerating}
	class:compact
>
	{#if showAvatar}
		<div class="message-avatar">
			<span class="avatar-icon">{getAvatarIcon()}</span>
		</div>
	{/if}

	<div class="message-content">
		{#if !compact && message.modelId}
			<div class="message-model">
				{message.modelId}
			</div>
		{/if}

		<div class="message-body">
			{#if isUser}
				<div class="user-message">
					{content}
				</div>
			{:else}
				<Markdown content={content} streaming={isGenerating} />
			{/if}
		</div>

		{#if !isUser && showActions}
			<div class="message-actions">
				<button class="action-btn" onclick={copyMessage} title="Copy">
					{copied ? '✓' : '📋'}
				</button>
				{#if isGenerating}
					<span class="generating-indicator">●</span>
				{/if}
			</div>
		{/if}

		{#if !compact && message.createdAt}
			<div class="message-timestamp">
				{new Date(message.createdAt).toLocaleTimeString()}
			</div>
		{/if}
	</div>
</div>

<style>
	.message {
		display: flex;
		gap: 0.75rem;
		padding: 1rem;
		border-radius: var(--chatbox-radius-md);
		transition: background-color 0.2s ease;
	}

	.message:hover {
		background: var(--chatbox-background-secondary);
	}

	.message-user {
		background: var(--chatbox-background-brand-secondary);
	}

	.message-assistant {
		background: transparent;
	}

	.message-system {
		background: var(--chatbox-background-tertiary);
		font-style: italic;
	}

	.message-generating {
		position: relative;
	}

	.message-generating::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 3px;
		background: var(--chatbox-tint-brand);
		border-radius: var(--chatbox-radius-xs);
	}

	.message-avatar {
		flex-shrink: 0;
		width: 2.5rem;
		height: 2.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--chatbox-radius-lg);
		background: var(--chatbox-background-tertiary);
	}

	.avatar-icon {
		font-size: 1.25rem;
	}

	.message-content {
		flex: 1;
		min-width: 0;
	}

	.message-model {
		font-size: 0.75rem;
		color: var(--chatbox-tint-secondary);
		margin-bottom: 0.25rem;
		font-weight: 500;
	}

	.message-body {
		line-height: 1.6;
		word-wrap: break-word;
	}

	.user-message {
		white-space: pre-wrap;
	}

	.message-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.5rem;
		opacity: 0;
		transition: opacity 0.2s ease;
	}

	.message:hover .message-actions {
		opacity: 1;
	}

	.action-btn {
		background: transparent;
		border: 1px solid var(--chatbox-border-primary);
		padding: 0.25rem 0.5rem;
		border-radius: var(--chatbox-radius-sm);
		cursor: pointer;
		font-size: 0.75rem;
	}

	.action-btn:hover {
		background: var(--chatbox-background-secondary);
	}

	.generating-indicator {
		color: var(--chatbox-tint-brand);
		animation: pulse 1s infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	.message-timestamp {
		font-size: 0.7rem;
		color: var(--chatbox-tint-tertiary);
		margin-top: 0.5rem;
	}

	.compact {
		padding: 0.5rem;
	}

	.compact .message-avatar {
		width: 1.5rem;
		height: 1.5rem;
	}

	.compact .avatar-icon {
		font-size: 0.875rem;
	}
</style>
