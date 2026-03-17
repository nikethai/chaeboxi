<script lang="ts">
	import { onMount } from 'svelte'

	interface Props {
		placeholder?: string
		onSubmit?: (message: string) => void
		disabled?: boolean
		class?: string
	}

	let { placeholder = 'Type a message...', onSubmit, disabled = false, class: className = '' }: Props = $props()

	let input = $state('')
	let textarea: HTMLTextAreaElement
	let isFocused = $state(false)

	// Auto-resize textarea
	function resize() {
		if (!textarea) return
		textarea.style.height = 'auto'
		textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px'
	}

	// Handle input changes
	function handleInput() {
		resize()
	}

	// Handle submit
	function handleSubmit() {
		const message = input.trim()
		if (!message || disabled) return

		onSubmit?.(message)
		input = ''
		resize()
	}

	// Handle keydown
	function handleKeydown(e: KeyboardEvent) {
		// Enter to send, Shift+Enter for newline
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault()
			handleSubmit()
		}
	}

	onMount(() => {
		resize()
	})
</script>

<div class="input-box {className}" class:focused={isFocused} class:disabled>
	<div class="input-wrapper">
		<textarea
			bind:this={textarea}
			bind:value={input}
			onInput={handleInput}
			onKeydown={handleKeydown}
			onFocus={() => (isFocused = true)}
			onBlur={() => (isFocused = false)}
			{placeholder}
			{disabled}
			rows="1"
			class="input-textarea"
		></textarea>

		<button
			class="send-button"
			onclick={handleSubmit}
			disabled={disabled || !input.trim()}
			aria-label="Send message"
		>
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
			</svg>
		</button>
	</div>

	<div class="input-hint">
		<span>Enter to send</span>
		<span>Shift+Enter for new line</span>
	</div>
</div>

<style>
	.input-box {
		padding: 0.75rem 1rem;
		background: var(--chatbox-background-primary);
		border-top: 1px solid var(--chatbox-border-primary);
	}

	.input-box.focused {
		background: var(--chatbox-background-secondary);
	}

	.input-wrapper {
		display: flex;
		align-items: flex-end;
		gap: 0.5rem;
		background: var(--chatbox-background-tertiary);
		border-radius: var(--chatbox-radius-lg);
		padding: 0.5rem;
		border: 1px solid var(--chatbox-border-primary);
		transition: all 0.2s ease;
	}

	.focused .input-wrapper {
		border-color: var(--chatbox-border-brand);
		box-shadow: 0 0 0 2px var(--chatbox-background-brand-secondary);
	}

	.input-textarea {
		flex: 1;
		background: transparent;
		border: none;
		outline: none;
		resize: none;
		font-family: inherit;
		font-size: 0.9375rem;
		line-height: 1.5;
		color: var(--chatbox-tint-primary);
		max-height: 200px;
		min-height: 1.5em;
		padding: 0.25rem 0;
	}

	.input-textarea::placeholder {
		color: var(--chatbox-tint-placeholder);
	}

	.send-button {
		flex-shrink: 0;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: var(--chatbox-radius-md);
		background: var(--chatbox-background-brand-primary);
		color: white;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
	}

	.send-button:hover:not(:disabled) {
		background: var(--chatbox-background-brand-primary-hover);
	}

	.send-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.input-hint {
		display: flex;
		justify-content: center;
		gap: 1rem;
		margin-top: 0.5rem;
		font-size: 0.7rem;
		color: var(--chatbox-tint-tertiary);
	}

	.disabled .input-textarea {
		opacity: 0.5;
	}
</style>
