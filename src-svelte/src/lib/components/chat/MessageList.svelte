<script lang="ts">
	import { onMount } from 'svelte'
	import MessageComponent from './Message.svelte'
	import type { Message } from '$shared/types'

	interface Props {
		messages?: Message[]
		class?: string
	}

	let { messages = [], class: className = '' }: Props = $props()

	let container: HTMLDivElement
	let showScrollToBottom = $state(false)
	let isAtBottom = $state(true)

	// Scroll handling
	function handleScroll() {
		if (!container) return
		const { scrollTop, scrollHeight, clientHeight } = container
		const distanceFromBottom = scrollHeight - scrollTop - clientHeight

		// Show button if not at bottom
		showScrollToBottom = distanceFromBottom > 100
		isAtBottom = distanceFromBottom < 50
	}

	function scrollToBottom() {
		if (!container) return
		container.scrollTop = container.scrollHeight
	}

	// Auto-scroll on new messages
	$effect(() => {
		// When messages change and we're at bottom, scroll to bottom
		if (messages.length && isAtBottom && container) {
			scrollToBottom()
		}
	})

	onMount(() => {
		// Initial scroll to bottom
		scrollToBottom()
	})
</script>

<div
	class="message-list {className}"
	bind:this={container}
	onScroll={handleScroll}
>
	{#if messages.length === 0}
		<div class="empty-state">
			<div class="empty-icon">💬</div>
			<p>No messages yet</p>
			<p class="empty-hint">Start a conversation to see messages here</p>
		</div>
	{:else}
		<div class="messages">
			{#each messages as message, index (message.id)}
				<div class="message-wrapper" data-index={index}>
					<MessageComponent
						{message}
						showAvatar={index === 0 || messages[index - 1]?.role !== message.role}
					/>
				</div>
			{/each}
		</div>
	{/if}

	{#if showScrollToBottom}
		<button class="scroll-to-bottom" onclick={scrollToBottom}>
			<span>↓</span>
		</button>
	{/if}
</div>

<style>
	.message-list {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 1rem;
		position: relative;
	}

	.messages {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.message-wrapper {
		animation: fadeIn 0.2s ease;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--chatbox-tint-secondary);
		text-align: center;
	}

	.empty-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
		opacity: 0.5;
	}

	.empty-hint {
		font-size: 0.875rem;
		opacity: 0.7;
	}

	.scroll-to-bottom {
		position: absolute;
		bottom: 1rem;
		right: 1rem;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 50%;
		background: var(--chatbox-background-brand-primary);
		color: white;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
		transition: all 0.2s ease;
	}

	.scroll-to-bottom:hover {
		background: var(--chatbox-background-brand-primary-hover);
		transform: scale(1.1);
	}
</style>
