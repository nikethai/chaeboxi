<script lang="ts">
	import { onMount } from 'svelte'

	interface Props {
		code: string
		language?: string
		showLineNumbers?: boolean
		collapsed?: boolean
	}

	let { code, language = 'text', showLineNumbers = false, collapsed = false }: Props = $props()

	let copied = $state(false)
	let isCollapsed = $state(collapsed)
	let highlightedHtml = $state('')

	const CODE_COLLAPSE_THRESHOLD = 7
	const shouldCollapse = $derived(code.split('\n').length > CODE_COLLAPSE_THRESHOLD)

	onMount(async () => {
		await highlightCode()
	})

	async function highlightCode() {
		try {
			const hljs = (await import('highlight.js')).default
			const lang = language.toLowerCase()

			// Check if language is supported
			if (hljs.getLanguage(lang)) {
				highlightedHtml = hljs.highlight(code, { language: lang }).value
			} else {
				highlightedHtml = hljs.highlightAuto(code).value
			}
		} catch (e) {
			console.error('Highlight error:', e)
			highlightedHtml = code
		}
	}

	async function copyCode() {
		await navigator.clipboard.writeText(code)
		copied = true
		setTimeout(() => (copied = false), 2000)
	}

	function toggleCollapse() {
		isCollapsed = !isCollapsed
	}
</script>

<div class="code-block" data-language={language}>
	<div class="code-header">
		<div class="code-info">
			<span class="code-language">{language}</span>
			{#if shouldCollapse}
				<button class="collapse-button" onclick={toggleCollapse}>
					{isCollapsed ? 'Expand' : 'Collapse'}
				</button>
			{/if}
		</div>
		<button class="copy-button" onclick={copyCode}>
			{copied ? 'Copied!' : 'Copy'}
		</button>
	</div>

	{#if shouldCollapse && isCollapsed}
		<div class="collapsed-preview" onclick={toggleCollapse}>
			{code.split('\n').slice(0, 3).join('\n')}...
			<span class="expand-hint">(click to expand)</span>
		</div>
	{:else}
		<div class="code-content">
			{#if highlightedHtml}
				<pre><code class="hljs language-{language}">{@html highlightedHtml}</code></pre>
			{:else}
				<pre><code>{code}</code></pre>
			{/if}
		</div>
	{/if}
</div>

<style>
	.code-block {
		position: relative;
		background: var(--chatbox-background-secondary);
		border-radius: var(--chatbox-radius-md);
		overflow: hidden;
		margin: 1em 0;
	}

	.code-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: var(--chatbox-background-tertiary);
		padding: 0.5em 1em;
		border-bottom: 1px solid var(--chatbox-border-primary);
	}

	.code-info {
		display: flex;
		align-items: center;
		gap: 0.75em;
	}

	.code-language {
		font-size: 0.75rem;
		color: var(--chatbox-tint-secondary);
		text-transform: uppercase;
		font-weight: 500;
	}

	.collapse-button {
		background: transparent;
		border: none;
		color: var(--chatbox-tint-brand);
		cursor: pointer;
		font-size: 0.75rem;
		padding: 0.25em 0.5em;
		border-radius: var(--chatbox-radius-sm);
	}

	.collapse-button:hover {
		background: var(--chatbox-background-secondary);
	}

	.copy-button {
		background: transparent;
		border: 1px solid var(--chatbox-border-primary);
		padding: 0.25em 0.75em;
		border-radius: var(--chatbox-radius-sm);
		cursor: pointer;
		font-size: 0.75rem;
		color: var(--chatbox-tint-secondary);
		transition: all 0.2s ease;
	}

	.copy-button:hover {
		background: var(--chatbox-background-secondary);
		color: var(--chatbox-tint-primary);
	}

	.code-content {
		overflow-x: auto;
		padding: 1em;
	}

	.code-content pre {
		margin: 0;
		background: transparent !important;
	}

	.code-content code {
		font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Courier New', monospace;
		font-size: 0.875rem;
		line-height: 1.5;
	}

	.collapsed-preview {
		padding: 1em;
		color: var(--chatbox-tint-secondary);
		font-family: monospace;
		font-size: 0.875rem;
		white-space: pre-wrap;
		cursor: pointer;
	}

	.expand-hint {
		display: block;
		color: var(--chatbox-tint-brand);
		margin-top: 0.5em;
		font-size: 0.75rem;
	}

	/* highlight.js theme integration */
	:global(.hljs) {
		background: transparent !important;
	}

	:global(.hljs-keyword),
	:global(.hljs-selector-tag),
	:global(.hljs-title),
	:global(.hljs-section),
	:global(.hljs-doctag),
	:global(.hljs-name),
	:global(.hljs-strong) {
		color: #c678dd;
	}

	:global(.hljs-string),
	:global(.hljs-title.class_),
	:global(.hljs-title.class_.inherited__),
	:global(.hljs-title.function_),
	:global(.hljs-addition) {
		color: #98c379;
	}

	:global(.hljs-comment),
	:global(.hljs-quote) {
		color: #5c6370;
		font-style: italic;
	}

	:global(.hljs-number),
	:global(.hljs-literal),
	:global(.hljs-variable),
	:global(.hljs-template-variable) {
		color: #d19a66;
	}

	:global(.hljs-built_in),
	:global(.hljs-type) {
		color: #e6c07b;
	}

	:global(.hljs-attr),
	:global(.hljs-selector-class),
	:global(.hljs-selector-id),
	:global(.hljs-selector-attr),
	:global(.hljs-selector-pseudo) {
		color: #61aeee;
	}

	:global(.hljs-meta) {
		color: #abb2bf;
	}
</style>
