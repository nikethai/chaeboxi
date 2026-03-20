<script lang="ts">
	interface Props {
		error?: string
		retrying?: boolean
		onRetry?: () => void
	}

	let { error = 'Generation failed.', retrying = false, onRetry }: Props = $props()
</script>

<div class="error-card">
	<div class="error-icon">
		<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M18 6 6 18"></path>
			<path d="m6 6 12 12"></path>
		</svg>
	</div>
	<div class="error-copy">
		<h2>Generation failed</h2>
		<p>{error}</p>
		<div class="error-actions">
			<button type="button" class="retry-btn" onclick={() => onRetry?.()} disabled={retrying}>
				{retrying ? 'Retrying…' : 'Retry'}
			</button>
			<a href="/settings/provider">Provider settings</a>
		</div>
	</div>
</div>

<style>
	.error-card {
		display: flex;
		align-items: flex-start;
		justify-content: center;
		gap: 1rem;
		padding: 1rem 1.1rem;
		border: 1px solid var(--chatbox-border-error);
		border-radius: 18px;
		background: var(--chatbox-background-error-secondary);
		color: var(--chatbox-tint-primary);
	}

	.error-icon {
		width: 42px;
		height: 42px;
		border-radius: 999px;
		background: var(--chatbox-background-error-primary);
		color: white;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.error-copy {
		max-width: 32rem;
	}

	.error-copy h2 {
		margin: 0;
		font-size: 0.95rem;
	}

	.error-copy p {
		margin: 0.35rem 0 0;
		font-size: 0.84rem;
		line-height: 1.5;
		color: var(--chatbox-tint-secondary);
		white-space: pre-wrap;
	}

	.error-actions {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		margin-top: 0.8rem;
	}

	.retry-btn {
		border: none;
		border-radius: 999px;
		background: var(--chatbox-background-error-primary);
		color: white;
		padding: 0.52rem 0.85rem;
		font: inherit;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
	}

	.retry-btn:disabled {
		cursor: progress;
		opacity: 0.7;
	}

	.error-actions a {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--chatbox-tint-brand);
		text-decoration: none;
	}

	@media (max-width: 720px) {
		.error-card {
			flex-direction: column;
		}
	}
</style>
