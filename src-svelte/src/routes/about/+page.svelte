<div class="about-page">
	<header class="about-header">
		<h1>About Chaeboxi</h1>
	</header>

	<div class="about-content">
		<section class="about-section incomplete-card">
			<div class="app-info">
				<div class="app-icon">💬</div>
				<h2>About is still partial</h2>
				<p class="version">The React app remains the source of truth for app metadata and release details.</p>
				<p class="tech">This route stays available only as an explicit incomplete-state page during the rescue pass.</p>
			</div>
			<a href="https://github.com/chaeboxi/chaeboxi" target="_blank" rel="noopener noreferrer">
				View Repository
			</a>
		</section>
	</div>
</div>

<style>
	.about-page {
		min-height: 100vh;
		background: var(--chatbox-background-primary);
	}

	.about-header {
		padding: 1.5rem;
		border-bottom: 1px solid var(--chatbox-border-primary);
		background: var(--chatbox-background-secondary);
	}

	.about-header h1 {
		font-size: 1.5rem;
		font-weight: 600;
		margin: 0;
		color: var(--chatbox-tint-primary);
	}

	.about-content {
		max-width: 800px;
		margin: 0 auto;
		padding: 1.5rem;
	}

	.about-section {
		margin-bottom: 2rem;
		padding: 1.5rem;
		background: var(--chatbox-background-secondary);
		border-radius: var(--chatbox-radius-md);
	}

	.app-info {
		text-align: center;
		padding: 1rem 0;
	}

	.app-icon {
		font-size: 4rem;
		margin-bottom: 1rem;
	}

	.app-info h2 {
		font-size: 1.5rem;
		font-weight: 600;
		margin: 0;
		color: var(--chatbox-tint-primary);
	}

	.version {
		color: var(--chatbox-tint-secondary);
		margin: 0.5rem 0;
	}

	.tech {
		color: var(--chatbox-tint-tertiary);
		font-size: 0.875rem;
		margin: 0;
	}

	.incomplete-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.incomplete-card a {
		display: flex;
		align-items: center;
		padding: 0.75rem 1rem;
		background: var(--chatbox-background-tertiary);
		color: var(--chatbox-tint-primary);
		text-decoration: none;
		border-radius: var(--chatbox-radius-md);
		transition: background 0.2s ease;
	}

	.incomplete-card a:hover {
		background: var(--chatbox-background-brand-secondary);
	}
</style>
