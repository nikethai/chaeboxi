<script lang="ts">
	import { Lexer, marked, type Token, type Tokens } from 'marked'
	import { processLaTeX } from '$lib/utils/latex'
	import { uiStore } from '$lib/stores/ui.svelte'
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

	let {
		content,
		enableLaTeX = true,
		enableMermaid = true,
		enableHtml = false,
		class: className = '',
		streaming = false,
	}: Props = $props()

	const markdownOptions = { gfm: true, breaks: true }
	const latexEnabled = $derived(enableLaTeX && settingsStore.settings.enableLaTeXRendering)
	const mermaidEnabled = $derived(enableMermaid && settingsStore.settings.enableMermaidRendering)
	const mermaidTheme = $derived(uiStore.state.realTheme === 'dark' ? 'dark' : 'default')
	const normalizedContent = $derived(latexEnabled ? processLaTeX(content) : content)

	const tokens = $derived.by(() => {
		try {
			return normalizedContent ? marked.lexer(normalizedContent, markdownOptions) : []
		} catch (error) {
			console.error('Markdown parse error:', error)
			return []
		}
	})

	function getHeadingTag(depth: number) {
		return `h${Math.min(Math.max(depth, 1), 6)}`
	}

	function getInlineTokens(token: { tokens?: Token[]; text?: string }) {
		if (token.tokens?.length) {
			return token.tokens
		}

		return token.text ? Lexer.lexInline(token.text, markdownOptions) : []
	}

	function getChildTokens(token: { tokens?: Token[] }) {
		return token.tokens ?? []
	}

	function splitTextSegments(text: string): Array<{ type: 'text' | 'math-inline' | 'math-display'; content: string }> {
		const segments: Array<{ type: 'text' | 'math-inline' | 'math-display'; content: string }> = []
		const pattern = /(\$\$[\s\S]+?\$\$|\$[^$\n]+\$)/g
		let lastIndex = 0
		let match: RegExpExecArray | null

		while ((match = pattern.exec(text)) !== null) {
			if (match.index > lastIndex) {
				segments.push({ type: 'text', content: text.slice(lastIndex, match.index) })
			}

			const raw = match[0]
			const isDisplay = raw.startsWith('$$') && raw.endsWith('$$')
			segments.push({
				type: isDisplay ? 'math-display' : 'math-inline',
				content: raw.slice(isDisplay ? 2 : 1, isDisplay ? -2 : -1).trim(),
			})
			lastIndex = pattern.lastIndex
		}

		if (lastIndex < text.length) {
			segments.push({ type: 'text', content: text.slice(lastIndex) })
		}

		return segments.length ? segments : [{ type: 'text', content: text }]
	}
</script>

<div class="markdown-content {className}" data-streaming={streaming}>
	{@render renderBlockTokens(tokens)}
</div>

{#snippet renderBlockTokens(blockTokens: Token[])}
	{#each blockTokens as token, index (`${token.type}:${token.raw || index}`)}
		{@render renderBlockToken(token)}
	{/each}
{/snippet}

{#snippet renderBlockToken(token: Token)}
	{#if token.type === 'heading'}
		<svelte:element this={getHeadingTag(token.depth)}>
			{@render renderInlineTokens(getInlineTokens(token))}
		</svelte:element>
	{:else if token.type === 'paragraph'}
		<p>
			{@render renderInlineTokens(getInlineTokens(token))}
		</p>
	{:else if token.type === 'text'}
		<p>
			{@render renderInlineTokens(getInlineTokens(token))}
		</p>
	{:else if token.type === 'code'}
		{#if token.lang === 'mermaid' && mermaidEnabled}
			<MermaidDiagram code={token.text} theme={mermaidTheme} />
		{:else}
			<CodeBlock
				code={token.text}
				language={token.lang || 'text'}
				collapsed={settingsStore.settings.autoCollapseCodeBlock}
			/>
		{/if}
	{:else if token.type === 'blockquote'}
		<blockquote>
			{@render renderBlockTokens(getChildTokens(token))}
		</blockquote>
	{:else if token.type === 'list'}
		{#if token.ordered}
			<ol start={typeof token.start === 'number' ? token.start : undefined}>
				{#each token.items as item, itemIndex (`${item.raw || itemIndex}`)}
					<li>
						{#if item.task}
							<input type="checkbox" checked={Boolean(item.checked)} disabled />
						{/if}
						{@render renderBlockTokens(getChildTokens(item))}
					</li>
				{/each}
			</ol>
		{:else}
			<ul>
				{#each token.items as item, itemIndex (`${item.raw || itemIndex}`)}
					<li>
						{#if item.task}
							<input type="checkbox" checked={Boolean(item.checked)} disabled />
						{/if}
						{@render renderBlockTokens(getChildTokens(item))}
					</li>
				{/each}
			</ul>
		{/if}
	{:else if token.type === 'table'}
		<div class="table-wrapper">
			<table>
				<thead>
					<tr>
						{#each token.header as cell, cellIndex (`header:${cell.text}:${cellIndex}`)}
							<th align={cell.align ?? undefined}>
								{@render renderInlineTokens(getChildTokens(cell))}
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each token.rows as row, rowIndex (`row:${rowIndex}`)}
						<tr>
							{#each row as cell, cellIndex (`cell:${cell.text}:${cellIndex}`)}
								<td align={cell.align ?? undefined}>
									{@render renderInlineTokens(getChildTokens(cell))}
								</td>
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
		{:else}
			<p>{token.text}</p>
		{/if}
	{/if}
{/snippet}

{#snippet renderInlineTokens(inlineTokens: Token[])}
	{#each inlineTokens as token, index (`${token.type}:${token.raw || index}`)}
		{#if token.type === 'text' || token.type === 'escape'}
			{#each splitTextSegments(token.text) as segment, segmentIndex (`${segment.type}:${segmentIndex}:${segment.content}`)}
				{#if segment.type === 'math-inline' && latexEnabled}
					<KatexRenderer content={segment.content} displayMode={false} />
				{:else if segment.type === 'math-display' && latexEnabled}
					<KatexRenderer content={segment.content} displayMode={true} />
				{:else}
					{segment.content}
				{/if}
			{/each}
		{:else if token.type === 'strong'}
			<strong>{@render renderInlineTokens(getChildTokens(token))}</strong>
		{:else if token.type === 'em'}
			<em>{@render renderInlineTokens(getChildTokens(token))}</em>
		{:else if token.type === 'codespan'}
			<code>{token.text}</code>
		{:else if token.type === 'del'}
			<del>{@render renderInlineTokens(getChildTokens(token))}</del>
		{:else if token.type === 'link'}
			<a href={token.href} target="_blank" rel="noreferrer">{@render renderInlineTokens(getChildTokens(token))}</a>
		{:else if token.type === 'image'}
			<img src={token.href} alt={token.text} title={token.title ?? undefined} />
		{:else if token.type === 'br'}
			<br />
		{:else if token.type === 'html'}
			{#if enableHtml}
				{@html token.text}
			{:else}
				{token.text}
			{/if}
		{/if}
	{/each}
{/snippet}

<style>
	.markdown-content {
		line-height: 1.6;
		word-wrap: break-word;
		overflow-wrap: break-word;
	}

	.markdown-content :global(h1) {
		font-size: 1.8rem;
		font-weight: 700;
		margin: 0.9em 0 0.6em;
	}

	.markdown-content :global(h2) {
		font-size: 1.45rem;
		font-weight: 700;
		margin: 0.85em 0 0.55em;
	}

	.markdown-content :global(h3) {
		font-size: 1.2rem;
		font-weight: 700;
		margin: 0.8em 0 0.5em;
	}

	.markdown-content :global(h4),
	.markdown-content :global(h5),
	.markdown-content :global(h6) {
		font-weight: 700;
		margin: 0.8em 0 0.45em;
	}

	.markdown-content :global(p) {
		margin: 0.65em 0;
	}

	.markdown-content :global(blockquote) {
		border-left: 3px solid var(--chatbox-border-brand);
		padding-left: 0.875rem;
		margin: 0.9em 0;
		color: var(--chatbox-tint-secondary);
	}

	.markdown-content :global(ul),
	.markdown-content :global(ol) {
		padding-left: 1.5rem;
		margin: 0.75em 0;
	}

	.markdown-content :global(li + li) {
		margin-top: 0.25rem;
	}

	.markdown-content :global(code) {
		font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Courier New', monospace;
		font-size: 0.9em;
	}

	.markdown-content :global(.table-wrapper) {
		overflow-x: auto;
		margin: 0.9em 0;
	}

	.markdown-content :global(table) {
		width: 100%;
		border-collapse: collapse;
	}

	.markdown-content :global(th),
	.markdown-content :global(td) {
		border: 1px solid var(--chatbox-border-primary);
		padding: 0.5rem 0.75rem;
		text-align: left;
		vertical-align: top;
	}

	.markdown-content :global(th) {
		background: var(--chatbox-background-secondary);
		font-weight: 700;
	}

	.markdown-content :global(hr) {
		border: none;
		border-top: 1px solid var(--chatbox-border-primary);
		margin: 1.25rem 0;
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
		border-radius: 12px;
	}
</style>
