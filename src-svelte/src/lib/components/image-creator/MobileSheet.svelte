<script lang="ts">
	import type { Snippet } from 'svelte'

	interface Props {
		open?: boolean
		title?: string
		onClose?: () => void
		children?: Snippet
		actions?: Snippet
	}

	let { open = false, title = '', onClose, children, actions }: Props = $props()

	function handleWindowKeydown(event: KeyboardEvent) {
		if (open && event.key === 'Escape') {
			onClose?.()
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			onClose?.()
		}
	}
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if open}
	<div class="sheet-overlay" role="presentation" onclick={handleBackdropClick}>
		<div class="sheet" role="dialog" aria-modal="true" aria-label={title}>
			<div class="sheet-handle"></div>
			<header class="sheet-header">
				<div class="sheet-title">{title}</div>
				<div class="sheet-actions">
					{@render actions?.()}
				</div>
			</header>
			<div class="sheet-body">
				{@render children?.()}
			</div>
		</div>
	</div>
{/if}

<style>
	.sheet-overlay {
		position: fixed;
		inset: 0;
		z-index: 80;
		background: var(--chatbox-background-mask-overlay);
		display: flex;
		align-items: flex-end;
	}

	.sheet {
		width: 100%;
		max-height: min(75vh, 42rem);
		display: flex;
		flex-direction: column;
		border-top-left-radius: 22px;
		border-top-right-radius: 22px;
		background: var(--chatbox-background-primary);
		border-top: 1px solid var(--chatbox-border-primary);
		box-shadow: 0 -20px 60px rgba(15, 23, 42, 0.2);
	}

	.sheet-handle {
		width: 44px;
		height: 5px;
		border-radius: 999px;
		background: var(--chatbox-background-tertiary);
		margin: 0.7rem auto 0.25rem;
	}

	.sheet-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.4rem 1rem 0.8rem;
		border-bottom: 1px solid var(--chatbox-border-primary);
	}

	.sheet-title {
		font-size: 0.76rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--chatbox-tint-tertiary);
	}

	.sheet-actions {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}

	.sheet-body {
		flex: 1;
		min-height: 0;
		overflow: auto;
	}
 </style>
