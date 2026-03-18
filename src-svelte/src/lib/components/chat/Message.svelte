<script lang="ts">
	import { Markdown } from '$lib/components/markdown'
	import { settingsStore } from '$lib/stores/settings.svelte'
	import type { Message } from '$shared/types'
	import { getMessageText } from '$shared/utils/message'

	interface Props {
		message: Message
		showAvatar?: boolean
		showActions?: boolean
		compact?: boolean
		class?: string
	}

	let { message, showAvatar = true, showActions = true, compact = false, class: className = '' }: Props = $props()

	const role = $derived(message.role)
	const isUser = $derived(role === 'user')
	const isSystem = $derived(role === 'system')
	const isAssistant = $derived(role === 'assistant')
	const isGenerating = $derived(Boolean(message.generating))
	const showModelLabel = $derived(
		Boolean(settingsStore.settings.showModelName && isAssistant && message.model)
	)
	const copyText = $derived(getMessageText(message, true, true) || '[non-text content]')

	let copied = $state(false)

	function formatPayload(value: unknown): string {
		try {
			return JSON.stringify(value, null, 2)
		} catch {
			return String(value)
		}
	}

	async function copyMessage() {
		await navigator.clipboard.writeText(copyText)
		copied = true
		setTimeout(() => {
			copied = false
		}, 1500)
	}
</script>

<div class="message-row {className}" class:user={isUser} class:assistant={isAssistant} class:system={isSystem}>
	{#if showAvatar}
		<div class="avatar" class:user-avatar={isUser} class:assistant-avatar={isAssistant}>
			{#if isUser}
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
				</svg>
			{:else if isSystem}
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.74 9a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
				</svg>
			{:else}
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
				</svg>
			{/if}
		</div>
	{:else}
		<div class="avatar-spacer"></div>
	{/if}

	<div class="message-content">
		{#if showModelLabel || isGenerating}
			<div class="message-meta">
				{#if showModelLabel}
					<div class="model-label">{message.model}</div>
				{/if}
				{#if isGenerating}
					<div class="status-pill">Generating</div>
				{/if}
			</div>
		{/if}

		<div class="message-bubble" class:user-bubble={isUser} class:system-bubble={isSystem} class:compact={compact}>
			{#if message.contentParts?.length}
				{#each message.contentParts as part, index (part.type + ':' + index)}
					<div class="content-part">
						{#if part.type === 'text'}
							{#if isUser}
								<div class="user-text">{part.text}</div>
							{:else if settingsStore.settings.enableMarkdownRendering}
								<Markdown content={part.text} streaming={isGenerating && index === message.contentParts.length - 1} />
							{:else}
								<div class="assistant-text">{part.text}</div>
							{/if}
						{:else if part.type === 'reasoning'}
							<div class="part-card">
								<div class="part-label">Reasoning</div>
								<div class="part-body">{part.text || 'Reasoning is streaming.'}</div>
							</div>
						{:else if part.type === 'info'}
							<div class="part-card">
								<div class="part-label">Info</div>
								<div class="part-body">{part.text}</div>
							</div>
						{:else if part.type === 'tool-call'}
							<div class="part-card">
								<div class="part-label">Tool {part.state}</div>
								<div class="part-body">{part.toolName}</div>
								<pre>{formatPayload(part.result ?? part.args)}</pre>
							</div>
						{:else if part.type === 'image'}
							<div class="part-card">
								<div class="part-label">Image</div>
								<div class="part-body">Image content is not rendered in this rescue pass.</div>
							</div>
						{/if}
					</div>
				{/each}
			{:else if isGenerating}
				<div class="generating-placeholder">
					<span class="dot"></span>
					Generating response…
				</div>
			{/if}

			{#if message.error}
				<div class="error-note">{message.error}</div>
			{/if}
		</div>

		{#if !isUser && showActions}
			<div class="message-actions" class:visible={isGenerating}>
				<button class="action-btn" type="button" onclick={copyMessage} title={copied ? 'Copied!' : 'Copy'} aria-label="Copy message">
					{#if copied}
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="20 6 9 17 4 12"></polyline>
						</svg>
					{:else}
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
						</svg>
					{/if}
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.message-row {
		display: flex;
		gap: 0.75rem;
		padding: 0.5rem 1rem;
		width: 100%;
	}

	.avatar,
	.avatar-spacer {
		flex-shrink: 0;
		width: 28px;
		height: 28px;
	}

	.avatar {
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-top: 2px;
	}

	.user-avatar {
		background: var(--chatbox-background-gray-secondary);
		color: var(--chatbox-tint-secondary);
	}

	.assistant-avatar {
		background: var(--chatbox-background-brand-secondary);
		color: var(--chatbox-tint-brand);
	}

	.message-content {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.message-meta {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex-wrap: wrap;
	}

	.model-label,
	.status-pill {
		display: inline-flex;
		align-items: center;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--chatbox-tint-tertiary);
	}

	.status-pill {
		color: var(--chatbox-tint-brand);
	}

	.message-bubble {
		line-height: 1.6;
		word-break: break-word;
	}

	.message-bubble.compact {
		line-height: 1.5;
	}

	.user-bubble {
		display: inline-block;
		background: var(--chatbox-background-secondary);
		padding: 0.625rem 0.875rem;
		border-radius: 14px;
		max-width: min(90%, 44rem);
	}

	.system-bubble {
		background: var(--chatbox-background-secondary);
		padding: 0.625rem 0.875rem;
		border-radius: 14px;
		font-style: italic;
		color: var(--chatbox-tint-secondary);
	}

	.content-part + .content-part {
		margin-top: 0.625rem;
	}

	.user-text,
	.assistant-text {
		white-space: pre-wrap;
		font-size: 0.9375rem;
		color: var(--chatbox-tint-primary);
	}

	.part-card {
		border: 1px solid var(--chatbox-border-primary);
		border-radius: 12px;
		background: var(--chatbox-background-secondary);
		padding: 0.75rem;
	}

	.part-label {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--chatbox-tint-tertiary);
		margin-bottom: 0.35rem;
	}

	.part-body {
		font-size: 0.875rem;
		color: var(--chatbox-tint-primary);
		white-space: pre-wrap;
	}

	.part-card pre {
		margin: 0.625rem 0 0;
		padding: 0.625rem;
		background: var(--chatbox-background-primary);
		border-radius: 10px;
		overflow-x: auto;
		font-size: 0.75rem;
	}

	.generating-placeholder {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--chatbox-tint-secondary);
		font-size: 0.9rem;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 999px;
		background: var(--chatbox-background-brand-primary);
		animation: pulse 1s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 0.4;
			transform: scale(0.9);
		}
		50% {
			opacity: 1;
			transform: scale(1);
		}
	}

	.error-note {
		margin-top: 0.625rem;
		padding: 0.625rem 0.75rem;
		border-radius: 12px;
		background: var(--chatbox-background-error-secondary);
		color: var(--chatbox-tint-error);
		font-size: 0.875rem;
	}

	.message-actions {
		display: flex;
		gap: 0.25rem;
		opacity: 0;
		transition: opacity 0.15s ease;
		margin-top: 0.125rem;
	}

	.message-actions.visible,
	.message-row:hover .message-actions {
		opacity: 1;
	}

	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		background: transparent;
		border: 1px solid var(--chatbox-border-primary);
		border-radius: 8px;
		cursor: pointer;
		color: var(--chatbox-tint-secondary);
		transition: all 0.15s ease;
	}

	.action-btn:hover {
		background: var(--chatbox-background-secondary);
		color: var(--chatbox-tint-primary);
	}
</style>
