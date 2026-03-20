<script lang="ts">
	interface Props {
		placeholder?: string
		disabled?: boolean
		generating?: boolean
		label?: string
		helperText?: string
		class?: string
		onSubmit?: (message: string) => void
		onStopGenerating?: () => void
	}

	let {
		placeholder = 'Type your question here...',
		disabled = false,
		generating = false,
		label = 'Message',
		helperText = 'Enter to send, Shift+Enter for a new line',
		class: className = '',
		onSubmit,
		onStopGenerating,
	}: Props = $props()

	let value = $state('')
	let textarea: HTMLTextAreaElement

	function syncHeight() {
		if (!textarea) {
			return
		}

		textarea.style.height = 'auto'
		textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`
	}

	function handleInput() {
		syncHeight()
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
		<div class="input-toolbar">
			<div class="toolbar-copy">
				<span class="toolbar-label">{label}</span>
				<span class="toolbar-helper">{generating ? 'Assistant is responding' : helperText}</span>
			</div>
			{#if generating}
				<span class="toolbar-status">Generating</span>
			{/if}
		</div>

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

			<div class="input-actions">
				{#if generating}
					<button
						class="send-btn stop-btn"
						type="button"
						onclick={onStopGenerating}
						aria-label="Stop generating"
						title="Stop generating"
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
						title="Send message"
					>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<line x1="12" y1="19" x2="12" y2="5"></line>
							<polyline points="5 12 12 5 19 12"></polyline>
						</svg>
					</button>
				{/if}
			</div>
		</div>

		<p class="disclaimer disclaimer-safe-area">AI can make mistakes. Double-check important information.</p>
	</div>
</div>

<style>
	.input-container {
		padding: 0 0.85rem 0.9rem;
	}

	.input-box-outer {
		display: flex;
		flex-direction: column;
		gap: 0.42rem;
		max-width: 56rem;
		margin: 0 auto;
		width: 100%;
	}

	.input-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0 0.2rem;
	}

	.toolbar-copy {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}

	.toolbar-label {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--chatbox-tint-tertiary);
	}

	.toolbar-helper,
	.toolbar-status {
		font-size: 0.76rem;
		color: var(--chatbox-tint-secondary);
	}

	.toolbar-status {
		display: inline-flex;
		align-items: center;
		padding: 0.22rem 0.55rem;
		border-radius: 999px;
		border: 1px solid var(--chatbox-border-brand);
		background: var(--chatbox-background-brand-secondary);
		color: var(--chatbox-tint-brand);
		font-weight: 600;
	}

	.input-box {
		display: flex;
		align-items: flex-end;
		gap: 0.7rem;
		background:
			linear-gradient(
				180deg,
				color-mix(in srgb, var(--chatbox-background-primary), var(--chatbox-background-secondary) 35%) 0%,
				var(--chatbox-background-primary) 100%
			);
		border: 1px solid var(--chatbox-border-primary);
		border-radius: 22px;
		padding: 0.8rem 0.9rem;
		transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
		min-height: 68px;
		box-shadow: 0 12px 32px rgba(15, 23, 42, 0.04);
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
		font-size: 0.95rem;
		line-height: 1.45;
		color: var(--chatbox-tint-primary);
		padding: 0.15rem 0;
		max-height: 220px;
		overflow-y: auto;
		font-family: inherit;
	}

	textarea::placeholder {
		color: var(--chatbox-tint-tertiary);
	}

	.input-actions {
		display: flex;
		align-items: center;
		padding-bottom: 0.1rem;
	}

	.send-btn {
		flex-shrink: 0;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.15s ease, transform 0.15s ease;
		background: var(--chatbox-background-secondary);
		color: white;
	}

	.send-btn.active {
		background: var(--chatbox-background-brand-primary);
	}

	.send-btn.active:hover {
		transform: translateY(-1px);
		background: var(--chatbox-background-brand-primary-hover);
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
		padding-bottom: max(env(safe-area-inset-bottom), var(--mobile-safe-area-inset-bottom, 0px));
	}

	@media (max-width: 720px) {
		.input-container {
			padding-inline: 0.65rem;
		}

		.input-box {
			padding: 0.72rem 0.8rem;
			border-radius: 20px;
		}
	}
</style>
