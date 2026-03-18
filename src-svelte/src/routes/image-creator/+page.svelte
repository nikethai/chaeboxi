<script lang="ts">
</script>

<div class="image-creator-page">
	<header class="page-header">
		<h1>Image Creator</h1>
	</header>

	<div class="page-content">
		<div class="coming-soon">
			<div class="icon">🎨</div>
			<h2>Image creator is not ported yet</h2>
			<p>This rescue milestone keeps chat real and hides fake product parity.</p>
			<p class="hint">Image generation workflows still belong to the React app for now.</p>
		</div>
	</div>
</div>

<style>
	.image-creator-page {
		min-height: 100vh;
		background: var(--chatbox-background-primary);
	}

	.page-header {
		padding: 1.5rem;
		border-bottom: 1px solid var(--chatbox-border-primary);
		background: var(--chatbox-background-secondary);
	}

	.page-header h1 {
		font-size: 1.5rem;
		font-weight: 600;
		margin: 0;
		color: var(--chatbox-tint-primary);
	}

	.page-content {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: calc(100vh - 80px);
		padding: 2rem;
	}

	.coming-soon {
		text-align: center;
		padding: 3rem;
		background: var(--chatbox-background-secondary);
		border-radius: var(--chatbox-radius-lg);
		max-width: 400px;
	}

	.icon {
		font-size: 4rem;
		margin-bottom: 1rem;
	}

	.coming-soon h2 {
		font-size: 1.5rem;
		font-weight: 600;
		margin: 0 0 0.5rem;
		color: var(--chatbox-tint-primary);
	}

	.coming-soon p {
		color: var(--chatbox-tint-secondary);
		margin: 0;
	}

	.hint {
		margin-top: 0.5rem !important;
		font-size: 0.875rem;
		color: var(--chatbox-tint-tertiary) !important;
	}
</style>
