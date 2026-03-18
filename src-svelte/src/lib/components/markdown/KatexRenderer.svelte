<script lang="ts">
	interface Props {
		content: string
		displayMode?: boolean
	}

	let { content, displayMode = false }: Props = $props()
	let renderedHtml = $state('')

	$effect(() => {
		void renderKatex()
	})

	async function renderKatex() {
		try {
			const katex = (await import('katex')).default
			renderedHtml = katex.renderToString(content, {
				displayMode,
				throwOnError: false,
				trust: true,
			})
		} catch (error) {
			console.error('KaTeX render error:', error)
			renderedHtml = content
		}
	}
</script>

{#if renderedHtml}
	<span class="katex" class:display-mode={displayMode}>
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
