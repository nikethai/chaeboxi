<script lang="ts">
	interface Props {
		code: string
		language?: string
		showLineNumbers?: boolean
		collapsed?: boolean
	}

	let { code, language = 'text', showLineNumbers = false, collapsed = false }: Props = $props()

	let copied = $state(false)
	let isCollapsed = $state(false)
	let highlightedHtml = $state('')

	const CODE_COLLAPSE_THRESHOLD = 7
	const shouldCollapse = $derived(code.split('\n').length > CODE_COLLAPSE_THRESHOLD)

	$effect(() => {
		isCollapsed = collapsed && shouldCollapse
	})

	$effect(() => {
		void highlightCode()
	})

	async function highlightCode() {
		try {
			const hljs = (await import('highlight.js')).default
			const normalizedLanguage = language.toLowerCase()
			highlightedHtml = hljs.getLanguage(normalizedLanguage)
				? hljs.highlight(code, { language: normalizedLanguage }).value
				: hljs.highlightAuto(code).value
		} catch (error) {
			console.error('Highlight error:', error)
			highlightedHtml = code
		}
	}

	async function copyCode() {
		await navigator.clipboard.writeText(code)
		copied = true
		setTimeout(() => {
			copied = false
		}, 1500)
	}

	function toggleCollapse() {
		isCollapsed = !isCollapsed
	}
</script>

<div class="code-block" data-language={language} data-line-numbers={showLineNumbers}>
	<div class="code-header">
		<div class="code-info">
			<span class="code-language">{language}</span>
			{#if shouldCollapse}
				<button class="collapse-button" type="button" onclick={toggleCollapse}>
					{isCollapsed ? 'Expand' : 'Collapse'}
				</button>
			{/if}
		</div>
		<button class="copy-button" type="button" onclick={copyCode}>
			{copied ? 'Copied!' : 'Copy'}
		</button>
	</div>

	{#if shouldCollapse && isCollapsed}
		<button class="collapsed-preview" type="button" onclick={toggleCollapse}>
			{code.split('\n').slice(0, 3).join('\n')}...
			<span class="expand-hint">(click to expand)</span>
		</button>
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
		border-radius: 14px;
		overflow: hidden;
		margin: 0.95em 0;
		border: 1px solid var(--chatbox-border-primary);
	}

	.code-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: color-mix(in srgb, var(--chatbox-background-secondary), var(--chatbox-background-primary) 35%);
		padding: 0.55rem 0.875rem;
		border-bottom: 1px solid var(--chatbox-border-primary);
	}

	.code-info {
		display: flex;
		align-items: center;
		gap: 0.75em;
	}

	.code-language {
		font-size: 0.72rem;
		color: var(--chatbox-tint-secondary);
		text-transform: uppercase;
		font-weight: 700;
		letter-spacing: 0.04em;
	}

	.collapse-button,
	.copy-button {
		background: transparent;
		border: 1px solid var(--chatbox-border-primary);
		color: var(--chatbox-tint-secondary);
		cursor: pointer;
		font-size: 0.75rem;
		padding: 0.25rem 0.55rem;
		border-radius: 999px;
		transition: all 0.15s ease;
	}

	.collapse-button:hover,
	.copy-button:hover {
		background: var(--chatbox-background-primary);
		color: var(--chatbox-tint-primary);
	}

	.code-content {
		overflow-x: auto;
		padding: 0.95rem 1rem;
	}

	.code-content pre {
		margin: 0;
		background: transparent !important;
	}

	.code-content code {
		font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Courier New', monospace;
		font-size: 0.875rem;
		line-height: 1.55;
	}

	.collapsed-preview {
		width: 100%;
		padding: 1rem;
		color: var(--chatbox-tint-secondary);
		font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Courier New', monospace;
		font-size: 0.85rem;
		white-space: pre-wrap;
		cursor: pointer;
		background: transparent;
		border: none;
		text-align: left;
	}

	.expand-hint {
		display: block;
		color: var(--chatbox-tint-brand);
		margin-top: 0.5rem;
		font-size: 0.75rem;
	}

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
