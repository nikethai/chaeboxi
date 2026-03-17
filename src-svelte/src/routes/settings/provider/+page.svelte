<script lang="ts">
</script>

<div class="settings-page">
	<header class="settings-header">
		<h1>Provider Settings</h1>
	</header>

	<div class="settings-content">
		<div class="coming-soon">
			<div class="icon">🔗</div>
			<h2>Provider Management</h2>
			<p>Configure AI providers and API keys.</p>
			<p class="hint">This feature will allow you to manage multiple AI providers.</p>
		</div>
	</div>
</div>

<style>
	.settings-page {
		min-height: 100vh;
		background: var(--chatbox-background-primary);
	}

	.settings-header {
		padding: 1.5rem;
		border-bottom: 1px solid var(--chatbox-border-primary);
		background: var(--chatbox-background-secondary);
	}

	.settings-header h1 {
		font-size: 1.5rem;
		font-weight: 600;
		margin: 0;
		color: var(--chatbox-tint-primary);
	}

	.settings-content {
		max-width: 800px;
		margin: 0 auto;
		padding: 1.5rem;
	}

	.coming-soon {
		text-align: center;
		padding: 3rem;
		background: var(--chatbox-background-secondary);
		border-radius: var(--chatbox-radius-lg);
	}

	.icon {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	.coming-soon h2 {
		font-size: 1.25rem;
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
