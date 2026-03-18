<div class="settings-page">
	<header class="settings-header">
		<h1>Settings</h1>
	</header>

	<div class="settings-content">
		<div class="coming-soon">
			<div class="icon">⚙️</div>
			<h2>Settings are not fully ported yet</h2>
			<p>This rescue pass removes fake completeness. Provider setup, advanced settings, and management flows still live in the React app.</p>
			<p class="hint">Only routes that clearly explain their incomplete status remain visible here.</p>
			<a href="/settings/provider">Open Provider Setup Status</a>
		</div>
	</div>
</div>

<style>
	.settings-page {
		min-height: 100%;
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
		max-width: 52rem;
		margin: 0 auto;
		padding: 1.5rem;
	}

	.coming-soon {
		text-align: center;
		padding: 3rem;
		background: var(--chatbox-background-secondary);
		border-radius: 18px;
		border: 1px solid var(--chatbox-border-primary);
	}

	.icon {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	.coming-soon h2 {
		font-size: 1.25rem;
		font-weight: 700;
		margin: 0 0 0.5rem;
		color: var(--chatbox-tint-primary);
	}

	.coming-soon p {
		color: var(--chatbox-tint-secondary);
		margin: 0.4rem 0 0;
	}

	.coming-soon a {
		display: inline-flex;
		margin-top: 1rem;
		padding: 0.5rem 0.875rem;
		border-radius: 999px;
		background: var(--chatbox-background-brand-primary);
		color: white;
		text-decoration: none;
		font-weight: 600;
		font-size: 0.875rem;
	}

	.hint {
		font-size: 0.875rem;
		color: var(--chatbox-tint-tertiary);
	}
</style>
