<script lang="ts">
	import { settingsStore } from '$lib/stores/settings.svelte'
</script>

<div class="about-page">
	<header class="about-header">
		<h1>About Chaeboxi</h1>
	</header>

	<div class="about-content">
		<section class="about-section">
			<div class="app-info">
				<div class="app-icon">💬</div>
				<h2>Chaeboxi</h2>
				<p class="version">Version 0.1.0</p>
				<p class="tech">Svelte 5 + Tauri</p>
			</div>
		</section>

		<section class="about-section">
			<h3>Features</h3>
			<ul class="features-list">
				<li>AI-powered chat interface</li>
				<li>Markdown rendering with syntax highlighting</li>
				<li>LaTeX mathematical equation support</li>
				<li>Mermaid diagram rendering</li>
				<li>Multi-language support (14 languages)</li>
				<li>Dark/Light theme support</li>
				<li>Session management</li>
			</ul>
		</section>

		<section class="about-section">
			<h3>Technology Stack</h3>
			<div class="tech-stack">
				<div class="tech-item">
					<span class="tech-name">Frontend</span>
					<span class="tech-value">Svelte 5</span>
				</div>
				<div class="tech-item">
					<span class="tech-name">Desktop</span>
					<span class="tech-value">Tauri v2</span>
				</div>
				<div class="tech-item">
					<span class="tech-name">Markdown</span>
					<span class="tech-value">marked</span>
				</div>
				<div class="tech-item">
					<span class="tech-name">Code Highlighting</span>
					<span class="tech-value">highlight.js</span>
				</div>
				<div class="tech-item">
					<span class="tech-name">Math</span>
					<span class="tech-value">KaTeX</span>
				</div>
				<div class="tech-item">
					<span class="tech-name">Diagrams</span>
					<span class="tech-value">Mermaid</span>
				</div>
			</div>
		</section>

		<section class="about-section">
			<h3>Links</h3>
			<div class="links">
				<a href="https://github.com/chaeboxi/chaeboxi" target="_blank" rel="noopener noreferrer">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
						<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
					</svg>
					GitHub
				</a>
			</div>
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

	.about-section h3 {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--chatbox-tint-primary);
		margin: 0 0 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--chatbox-border-primary);
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

	.features-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.features-list li {
		padding: 0.5rem 0;
		color: var(--chatbox-tint-secondary);
		border-bottom: 1px solid var(--chatbox-border-primary);
	}

	.features-list li:last-child {
		border-bottom: none;
	}

	.tech-stack {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 1rem;
	}

	.tech-item {
		display: flex;
		flex-direction: column;
		padding: 0.75rem;
		background: var(--chatbox-background-tertiary);
		border-radius: var(--chatbox-radius-md);
	}

	.tech-name {
		font-size: 0.75rem;
		color: var(--chatbox-tint-tertiary);
	}

	.tech-value {
		font-size: 0.875rem;
		color: var(--chatbox-tint-primary);
		font-weight: 500;
	}

	.links {
		display: flex;
		gap: 1rem;
	}

	.links a {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: var(--chatbox-background-tertiary);
		color: var(--chatbox-tint-primary);
		text-decoration: none;
		border-radius: var(--chatbox-radius-md);
		transition: background 0.2s ease;
	}

	.links a:hover {
		background: var(--chatbox-background-brand-secondary);
	}
</style>
