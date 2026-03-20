<script lang="ts">
	interface Props {
		disabled?: boolean
		onPromptSelect?: (prompt: string) => void
	}

	let { disabled = false, onPromptSelect }: Props = $props()

	const quickPrompts = [
		'A serene mountain landscape at sunset',
		'A futuristic city with flying cars',
		'A cozy coffee shop interior',
		'An abstract painting with vibrant colors',
		'A cute rabbit in Pixar animation style',
	]
</script>

<div class="empty-state">
	<div class="empty-icon">
		<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
			<rect x="3" y="3" width="18" height="18" rx="3"></rect>
			<circle cx="8.5" cy="8.5" r="1.5"></circle>
			<path d="m21 15-5-5L5 21"></path>
		</svg>
	</div>

	<div class="empty-copy">
		<p class="empty-kicker">Real image route</p>
		<h1>Create amazing images</h1>
		<p>
			Describe the image you want to generate. This route uses the real generation flow and keeps incomplete extras
			out of the way.
		</p>
	</div>

	<div class="prompt-grid">
		{#each quickPrompts as prompt}
			<button class="prompt-chip" type="button" disabled={disabled} onclick={() => onPromptSelect?.(prompt)}>
				{prompt}
			</button>
		{/each}
	</div>
</div>

<style>
	.empty-state {
		min-height: min(60vh, 42rem);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		text-align: center;
		padding: 2rem 0 1rem;
	}

	.empty-icon {
		width: 72px;
		height: 72px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 20px;
		background: var(--chatbox-background-secondary);
		color: var(--chatbox-tint-tertiary);
	}

	.empty-copy {
		max-width: 34rem;
	}

	.empty-kicker {
		margin: 0 0 0.4rem;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--chatbox-tint-tertiary);
	}

	.empty-copy h1 {
		margin: 0;
		font-size: clamp(1.55rem, 4.8vw, 2.4rem);
		line-height: 1.02;
		letter-spacing: -0.04em;
		color: var(--chatbox-tint-primary);
	}

	.empty-copy p:last-child {
		margin: 0.7rem 0 0;
		font-size: 0.9rem;
		line-height: 1.55;
		color: var(--chatbox-tint-secondary);
	}

	.prompt-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
		justify-content: center;
		max-width: 42rem;
	}

	.prompt-chip {
		max-width: 16rem;
		border: 1px solid var(--chatbox-border-primary);
		border-radius: 16px;
		background: var(--chatbox-background-secondary);
		color: var(--chatbox-tint-primary);
		padding: 0.8rem 0.95rem;
		font: inherit;
		font-size: 0.84rem;
		line-height: 1.35;
		cursor: pointer;
		transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
	}

	.prompt-chip:hover:enabled {
		background: var(--chatbox-background-tertiary);
		border-color: var(--chatbox-border-secondary);
		transform: translateY(-1px);
	}

	.prompt-chip:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}
</style>
