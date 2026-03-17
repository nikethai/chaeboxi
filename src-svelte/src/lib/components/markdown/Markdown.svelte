<script lang="ts">
	import { marked } from 'marked'
	import { settingsStore } from '$lib/stores/settings.svelte'
	import CodeBlock from './CodeBlock.svelte'
	import KatexRenderer from './KatexRenderer.svelte'
	import MermaidDiagram from './MermaidDiagram.svelte'

	interface Props {
		content: string
		enableLaTeX?: boolean
		enableMermaid?: boolean
		enableHtml?: boolean
		class?: string
		streaming?: boolean
	}

	let { content, enableLaTeX = true, enableMermaid = true, enableHtml = false, class: className = '', streaming = false }: Props = $props()

	// Use settings from store
	const latexEnabled = $derived(enableLaTeX && settingsStore.settings.enableLaTeXRendering)
	const mermaidEnabled = $derived(enableMermaid && settingsStore.settings.enableMermaidRendering)

	// Parse markdown to tokens
	let tokens = $derived.by(() => {
		try {
			if (!content) return []
			return marked.lexer(content, { gfm: true, breaks: true })
		} catch (e) {
			console.error('Markdown parse error:', e)
			return []
		}
	})

	// Check if content contains mermaid code blocks
	const hasMermaid = $derived(
		tokens.some((t) => t.type === 'code' && t.lang === 'mermaid')
	)

	// Split text by LaTeX delimiters
	function splitByLatex(text: string): Array<{ type: 'text' | 'latex'; content: string }> {
		const parts: Array<{ type: 'text' | 'latex'; content: string }> = []
		const regex = /\$([^$\n]+)\$/g
		let lastIndex = 0
		let match

		while ((match = regex.exec(text)) !== null) {
			// Add text before match
			if (match.index > lastIndex) {
				parts.push({ type: 'text', content: text.slice(lastIndex, match.index) })
			}
			// Add LaTeX
			parts.push({ type: 'latex', content: match[1] })
			lastIndex = regex.lastIndex
		}

		// Add remaining text
		if (lastIndex < text.length) {
			parts.push({ type: 'text', content: text.slice(lastIndex) })
		}

		return parts
	}
</script>

<div class="markdown-content {className}" data-latex-enabled={latexEnabled} data-mermaid-enabled={mermaidEnabled} data-streaming={streaming}>
	{#if hasMermaid && mermaidEnabled}
		{#each tokens as token}
			{#if token.type === 'code' && token.lang === 'mermaid'}
				<MermaidDiagram code={token.text} />
			{:else}
				{@render tokenRenderer(token)}
			{/if}
		{/each}
	{:else}
		{#each tokens as token}
			{@render tokenRenderer(token)}
		{/each}
	{/if}
</div>

{#snippet tokenRenderer(token: marked.Token)}
	{#if token.type === 'heading'}
		<svelte:element this="h{token.depth}">
			{token.text}
		</svelte:element>
	{:else if token.type === 'paragraph'}
		<p>
			{#if latexEnabled}
				{#each splitByLatex(token.text) as part}
					{#if part.type === 'latex'}
						<KatexRenderer content={part.content} displayMode={false} />
					{:else}
						{part.content}
					{/if}
				{/each}
			{:else}
				{token.text}
			{/if}
		</p>
	{:else if token.type === 'code'}
		{#if token.lang === 'mermaid' && mermaidEnabled}
			<MermaidDiagram code={token.text} />
		{:else}
			<CodeBlock code={token.text} language={token.lang || 'text'} collapsed={settingsStore.settings.autoCollapseCodeBlock} />
		{/if}
	{:else if token.type === 'blockquote'}
		<blockquote>
			<p>{token.text}</p>
		</blockquote>
	{:else if token.type === 'list'}
		{#if token.ordered}
			<ol>
				{#each token.items as item}
					<li>{item.text}</li>
				{/each}
			</ol>
		{:else}
			<ul>
				{#each token.items as item}
					<li>{item.text}</li>
				{/each}
			</ul>
		{/if}
	{:else if token.type === 'table'}
		<div class="table-wrapper">
			<table>
				<thead>
					<tr>
						{#each token.header as cell}
							<th>{cell.text}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each token.rows as row}
						<tr>
							{#each row as cell}
								<td>{cell.text}</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else if token.type === 'hr'}
		<hr />
	{:else if token.type === 'html'}
		{#if enableHtml}
			{@html token.text}
		{/if}
	{:else if token.type === 'text'}
		<span>
			{#if latexEnabled}
				{#each splitByLatex(token.text) as part}
					{#if part.type === 'latex'}
						<KatexRenderer content={part.content} displayMode={false} />
					{:else}
						{part.content}
					{/if}
				{/each}
			{:else}
				{token.text}
			{/if}
		</span>
	{:else if token.type === 'strong'}
		<strong>{token.text}</strong>
	{:else if token.type === 'em'}
		<em>{token.text}</em>
	{/if}
{/snippet}

<style>
	.markdown-content {
		line-height: 1.6;
		word-wrap: break-word;
		overflow-wrap: break-word;
	}

	.markdown-content :global(h1) {
		font-size: 2em;
		font-weight: 700;
		margin: 0.67em 0;
		border-bottom: 1px solid var(--chatbox-border-primary);
	}

	.markdown-content :global(h2) {
		font-size: 1.5em;
		font-weight: 600;
		margin: 0.83em 0;
		border-bottom: 1px solid var(--chatbox-border-primary);
	}

	.markdown-content :global(h3) {
		font-size: 1.25em;
		font-weight: 600;
		margin: 1em 0;
	}

	.markdown-content :global(h4),
	.markdown-content :global(h5),
	.markdown-content :global(h6) {
		font-weight: 600;
		margin: 1em 0;
	}

	.markdown-content :global(p) {
		margin: 0.75em 0;
	}

	.markdown-content :global(blockquote) {
		border-left: 4px solid var(--chatbox-border-brand);
		padding-left: 1em;
		margin: 1em 0;
		color: var(--chatbox-tint-secondary);
	}

	.markdown-content :global(ul),
	.markdown-content :global(ol) {
		padding-left: 2em;
		margin: 1em 0;
	}

	.markdown-content :global(.table-wrapper) {
		overflow-x: auto;
		margin: 1em 0;
	}

	.markdown-content :global(table) {
		width: 100%;
		border-collapse: collapse;
	}

	.markdown-content :global(th),
	.markdown-content :global(td) {
		border: 1px solid var(--chatbox-border-primary);
		padding: 0.5em 1em;
		text-align: left;
	}

	.markdown-content :global(th) {
		background: var(--chatbox-background-secondary);
		font-weight: 600;
	}

	.markdown-content :global(hr) {
		border: none;
		border-top: 1px solid var(--chatbox-border-primary);
		margin: 2em 0;
	}

	.markdown-content :global(a) {
		color: var(--chatbox-tint-brand);
		text-decoration: none;
	}

	.markdown-content :global(a:hover) {
		text-decoration: underline;
	}

	.markdown-content :global(img) {
		max-width: 100%;
		height: auto;
		border-radius: var(--chatbox-radius-md);
	}
</style>
