<script lang="ts">
	import { onMount } from 'svelte'
	import type { Message } from '$shared/types'
	import MessageComponent from './Message.svelte'

	interface Props {
		messages?: Message[]
		class?: string
	}

	let { messages = [], class: className = '' }: Props = $props()

	let container: HTMLDivElement
	let showScrollToBottom = $state(false)
	let isAtBottom = $state(true)

	function handleScroll() {
		if (!container) return
		const { scrollTop, scrollHeight, clientHeight } = container
		const distanceFromBottom = scrollHeight - scrollTop - clientHeight
		showScrollToBottom = distanceFromBottom > 140
		isAtBottom = distanceFromBottom < 60
	}

	function scrollToBottom(smooth = false) {
		if (!container) return
		container.scrollTo({ top: container.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
	}

	$effect(() => {
		if (messages.length && isAtBottom && container) {
			scrollToBottom()
		}
	})

	onMount(() => {
		scrollToBottom()
	})
</script>

<div class="message-list {className}" bind:this={container} onscroll={handleScroll}>
	{#if messages.length > 0}
		<div class="messages-shell">
			<div class="messages">
				{#each messages as message, index (message.id)}
					<div class="message-wrapper">
						<MessageComponent
							{message}
							showAvatar={index === 0 || messages[index - 1]?.role !== message.role}
						/>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if showScrollToBottom}
		<button
			aria-label="Scroll to bottom"
			class="scroll-to-bottom"
			type="button"
			onclick={() => scrollToBottom(true)}
		>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
				<line x1="12" y1="5" x2="12" y2="19"></line>
				<polyline points="19 12 12 19 5 12"></polyline>
			</svg>
		</button>
	{/if}
</div>

<style>
	.message-list {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		position: relative;
		padding: 0.9rem 0 1rem;
	}

	.messages-shell {
		display: flex;
		justify-content: center;
		padding: 0 0.85rem;
	}

	.messages {
		display: flex;
		flex-direction: column;
		width: min(100%, 56rem);
		gap: 0.42rem;
	}

	.message-wrapper {
		animation: fadeSlideIn 0.18s ease;
	}

	@keyframes fadeSlideIn {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.scroll-to-bottom {
		position: sticky;
		bottom: 1rem;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: var(--chatbox-background-primary);
		color: var(--chatbox-tint-secondary);
		border: 1px solid var(--chatbox-border-primary);
		cursor: pointer;
		box-shadow: 0 8px 24px rgba(15, 23, 42, 0.16);
		transition: all 0.15s ease;
		margin: 0 auto;
	}

	.scroll-to-bottom:hover {
		background: var(--chatbox-background-secondary);
		color: var(--chatbox-tint-primary);
		box-shadow: 0 10px 28px rgba(15, 23, 42, 0.2);
	}
</style>
