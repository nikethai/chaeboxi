<script lang="ts">
	import { onMount } from 'svelte'

	interface Props {
		content: string
		displayMode?: boolean
	}

	let { content, displayMode = false }: Props = $props()
	let container: HTMLDivElement
	let renderedHtml = $state('')

	onMount(async () => {
		try {
			// Dynamic import of katex
			const katex = (await import('katex')).default
			renderedHtml = katex.renderToString(content, {
				displayMode,
				throwOnError: false,
				trust: true,
			})
		} catch (e) {
			console.error('KaTeX render error:', e)
			renderedHtml = content
		}
	})
</script>

{#if renderedHtml}
	<span bind:this={container} class="katex" class:display-mode={displayMode}>
		{@html renderedHtml}
	</span>
{:else}
	<span class="katex-placeholder">{content}</span>
{/if}

<style>
	.katex {
		font-size: 1em;
	}

	.katex.display-mode {
		display: block;
		text-align: center;
		margin: 1em 0;
		overflow-x: auto;
		overflow-y: hidden;
	}

	.katex-placeholder {
		color: var(--chatbox-tint-error);
	}
</style>
