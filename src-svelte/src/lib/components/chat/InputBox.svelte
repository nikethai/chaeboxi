<script lang="ts">
	interface Props {
		placeholder?: string
		disabled?: boolean
		generating?: boolean
		class?: string
		onSubmit?: (message: string) => void
		onStopGenerating?: () => void
	}

	let {
		placeholder = 'Type your question here...',
		disabled = false,
		generating = false,
		class: className = '',
		onSubmit,
		onStopGenerating,
	}: Props = $props()

	let value = $state('')
	let textarea: HTMLTextAreaElement

	function handleInput() {
		if (textarea) {
			textarea.style.height = 'auto'
			textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
		}
	}

	function handleSubmit() {
		const trimmed = value.trim()
		if (!trimmed || disabled || generating) return
		onSubmit?.(trimmed)
		value = ''
		if (textarea) {
			textarea.style.height = 'auto'
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault()
			handleSubmit()
		}
	}

	const canSubmit = $derived(value.trim().length > 0 && !disabled && !generating)
</script>

<div class="input-container {className}">
	<div class="input-box-outer">
		<div class="input-box">
			<textarea
				bind:this={textarea}
				bind:value
				{placeholder}
				{disabled}
				rows="1"
				oninput={handleInput}
				onkeydown={handleKeyDown}
			></textarea>

			{#if generating}
				<button
					class="send-btn stop-btn"
					type="button"
					onclick={onStopGenerating}
					aria-label="Stop generating"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
						<rect x="6" y="6" width="12" height="12" rx="2"></rect>
					</svg>
				</button>
			{:else}
				<button
					class="send-btn"
					class:active={canSubmit}
					type="button"
					onclick={handleSubmit}
					disabled={!canSubmit}
					aria-label="Send message"
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<line x1="12" y1="19" x2="12" y2="5"></line>
						<polyline points="5 12 12 5 19 12"></polyline>
					</svg>
				</button>
			{/if}
		</div>

		<p class="disclaimer">AI can make mistakes. Double-check important information.</p>
	</div>
</div>

<style>
	.input-container {
		padding: 0 0.75rem 0.75rem;
	}

	.input-box-outer {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		max-width: 56rem;
		margin: 0 auto;
		width: 100%;
	}

	.input-box {
		display: flex;
		align-items: flex-end;
		gap: 0.5rem;
		background: var(--chatbox-background-primary);
		border: 1px solid var(--chatbox-border-primary);
		border-radius: 18px;
		padding: 0.625rem 0.75rem;
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
		min-height: 64px;
	}

	.input-box:focus-within {
		border-color: var(--chatbox-border-brand);
		box-shadow: 0 0 0 2px var(--chatbox-background-brand-secondary);
	}

	textarea {
		flex: 1;
		background: transparent;
		border: none;
		outline: none;
		resize: none;
		font-size: 0.9375rem;
		line-height: 1.45;
		color: var(--chatbox-tint-primary);
		padding: 0.25rem 0.375rem;
		max-height: 200px;
		overflow-y: auto;
		font-family: inherit;
	}

	textarea::placeholder {
		color: var(--chatbox-tint-tertiary);
	}

	.send-btn {
		flex-shrink: 0;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.15s ease, opacity 0.15s ease;
		background: var(--chatbox-background-secondary);
		color: white;
		margin-bottom: 2px;
	}

	.send-btn.active {
		background: var(--chatbox-background-brand-primary);
	}

	.send-btn:disabled {
		cursor: default;
		opacity: 1;
	}

	.stop-btn {
		background: var(--chatbox-background-error-primary);
	}

	.stop-btn:hover {
		background: var(--chatbox-background-error-primary-hover);
	}

	.disclaimer {
		font-size: 0.7rem;
		color: var(--chatbox-tint-tertiary);
		text-align: center;
		margin: 0;
	}
</style>
