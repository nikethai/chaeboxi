<script lang="ts">
	interface Props {
		prompt?: string
		modelLabel?: string
		referenceImageCount?: number
		status?: 'pending' | 'generating' | 'done' | 'error'
	}

	let { prompt = '', modelLabel = '', referenceImageCount = 0, status = 'done' }: Props = $props()

	const statusLabel = $derived(
		status === 'generating'
			? 'Generating'
			: status === 'error'
				? 'Failed'
				: status === 'pending'
					? 'Queued'
					: 'Completed'
	)
</script>

<div class="prompt-display">
	<p class="prompt-text">{prompt}</p>
	<div class="prompt-meta">
		<span>{modelLabel}</span>
		<span class="meta-dot">•</span>
		<span>{statusLabel}</span>
		{#if referenceImageCount > 0}
			<span class="meta-dot">•</span>
			<span>{referenceImageCount} ref{referenceImageCount === 1 ? '' : 's'}</span>
		{/if}
	</div>
</div>

<style>
	.prompt-display {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.45rem;
		text-align: center;
	}

	.prompt-text {
		max-width: min(90%, 46rem);
		margin: 0;
		font-size: 0.92rem;
		line-height: 1.55;
		color: var(--chatbox-tint-primary);
	}

	.prompt-meta {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		font-size: 0.74rem;
		color: var(--chatbox-tint-tertiary);
	}

	.meta-dot {
		opacity: 0.6;
	}
</style>
