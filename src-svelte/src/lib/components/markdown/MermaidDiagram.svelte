<script lang="ts">
	import { onMount } from 'svelte'

	interface Props {
		code: string
		theme?: 'default' | 'dark'
	}

	let { code, theme = 'default' }: Props = $props()

	let svgContainer: HTMLDivElement
	let svgHtml = $state('')
	let error = $state('')
	let loading = $state(true)

	onMount(async () => {
		await renderDiagram()
	})

	async function renderDiagram() {
		loading = true
		error = ''

		try {
			// Dynamic import mermaid
			const mermaid = (await import('mermaid')).default

			// Initialize mermaid with theme
			mermaid.initialize({
				startOnLoad: false,
				theme: theme === 'dark' ? 'dark' : 'default',
				securityLevel: 'loose',
				fontFamily: 'inherit',
			})

			// Generate diagram
			const id = `mermaid-${Math.random().toString(36).slice(2)}`
			const { svg } = await mermaid.render(id, code)
			svgHtml = svg
		} catch (e) {
			console.error('Mermaid render error:', e)
			error = e instanceof Error ? e.message : 'Failed to render diagram'
		} finally {
			loading = false
		}
	}

	function downloadSvg() {
		if (!svgHtml) return
		const blob = new Blob([svgHtml], { type: 'image/svg+xml' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = 'diagram.svg'
		a.click()
		URL.revokeObjectURL(url)
	}
</script>

<div class="mermaid-container" bind:this={svgContainer}>
	{#if loading}
		<div class="mermaid-loading">
			<span>Rendering diagram...</span>
		</div>
	{:else if error}
		<div class="mermaid-error">
			<span class="error-label">Diagram Error:</span>
			<pre class="error-message">{error}</pre>
			<button class="retry-button" onclick={renderDiagram}>Retry</button>
		</div>
	{:else}
		<div class="mermaid-actions">
			<button class="action-button" onclick={downloadSvg} title="Download SVG">
				Download
			</button>
		</div>
		<div class="mermaid-content">
			{@html svgHtml}
		</div>
	{/if}
</div>

<style>
	.mermaid-container {
		position: relative;
		margin: 1em 0;
		padding: 1em;
		background: var(--chatbox-background-secondary);
		border-radius: var(--chatbox-radius-md);
		overflow: hidden;
	}

	.mermaid-loading {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100px;
		color: var(--chatbox-tint-secondary);
	}

	.mermaid-error {
		padding: 1em;
	}

	.error-label {
		color: var(--chatbox-tint-error);
		font-weight: 600;
		display: block;
		margin-bottom: 0.5em;
	}

	.error-message {
		background: var(--chatbox-background-tertiary);
		padding: 0.75em;
		border-radius: var(--chatbox-radius-sm);
		font-size: 0.875rem;
		color: var(--chatbox-tint-secondary);
		white-space: pre-wrap;
		word-break: break-word;
		margin-bottom: 0.75em;
	}

	.retry-button {
		background: var(--chatbox-background-brand-primary);
		color: white;
		border: none;
		padding: 0.5em 1em;
		border-radius: var(--chatbox-radius-sm);
		cursor: pointer;
		font-size: 0.875rem;
	}

	.retry-button:hover {
		background: var(--chatbox-background-brand-primary-hover);
	}

	.mermaid-actions {
		position: absolute;
		top: 0.5em;
		right: 0.5em;
		z-index: 10;
	}

	.action-button {
		background: var(--chatbox-background-tertiary);
		border: 1px solid var(--chatbox-border-primary);
		padding: 0.25em 0.75em;
		border-radius: var(--chatbox-radius-sm);
		cursor: pointer;
		font-size: 0.75rem;
		color: var(--chatbox-tint-secondary);
		transition: all 0.2s ease;
	}

	.action-button:hover {
		background: var(--chatbox-background-secondary);
		color: var(--chatbox-tint-primary);
	}

	.mermaid-content {
		overflow-x: auto;
		display: flex;
		justify-content: center;
	}

	.mermaid-content :global(svg) {
		max-width: 100%;
		height: auto;
	}
</style>
