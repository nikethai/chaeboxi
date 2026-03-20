<script lang="ts">
	import { MAX_REFERENCE_IMAGES } from '$lib/image-creator/constants'

	interface ReferenceImagePreview {
		storageKey: string
		dataUrl: string
		sourceRecordId?: string
	}

	interface Props {
		images?: ReferenceImagePreview[]
		onRemove?: (storageKey: string) => void
		onAdd?: () => void
	}

	let { images = [], onRemove, onAdd }: Props = $props()
</script>

{#if images.length > 0}
	<div class="reference-strip">
		{#each images as image (image.storageKey)}
			<div class="thumb-shell">
				<img src={image.dataUrl} alt="" class="thumb-image" />
				<button class="thumb-remove" type="button" aria-label="Remove reference image" onclick={() => onRemove?.(image.storageKey)}>
					<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
						<path d="M18 6 6 18"></path>
						<path d="m6 6 12 12"></path>
					</svg>
				</button>
			</div>
		{/each}

		{#if images.length < MAX_REFERENCE_IMAGES}
			<button class="add-thumb" type="button" aria-label="Add reference image" onclick={() => onAdd?.()}>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M12 5v14"></path>
					<path d="M5 12h14"></path>
				</svg>
			</button>
		{/if}
	</div>
{/if}

<style>
	.reference-strip {
		display: flex;
		gap: 0.65rem;
		overflow-x: auto;
		padding: 0.1rem 0 0.15rem;
	}

	.thumb-shell,
	.add-thumb {
		position: relative;
		width: 66px;
		height: 66px;
		border-radius: 14px;
		flex-shrink: 0;
	}

	.thumb-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: inherit;
		border: 1px solid var(--chatbox-border-primary);
		background: var(--chatbox-background-secondary);
	}

	.thumb-remove {
		position: absolute;
		top: -0.35rem;
		right: -0.35rem;
		width: 1.35rem;
		height: 1.35rem;
		border: none;
		border-radius: 999px;
		background: rgba(15, 23, 42, 0.88);
		color: white;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}

	.add-thumb {
		border: 1px dashed var(--chatbox-border-secondary);
		background: transparent;
		color: var(--chatbox-tint-tertiary);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
	}

	.add-thumb:hover {
		border-color: var(--chatbox-border-brand);
		color: var(--chatbox-tint-brand);
		background: var(--chatbox-background-brand-secondary);
	}
</style>
