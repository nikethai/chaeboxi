<script lang="ts">
	interface GalleryImage {
		storageKey: string
		dataUrl: string
	}

	interface Props {
		images?: GalleryImage[]
		generating?: boolean
		onUseAsReference?: (storageKey: string) => void
	}

	let { images = [], generating = false, onUseAsReference }: Props = $props()

	let previewImage = $state<GalleryImage | null>(null)

	function handleWindowKeydown(event: KeyboardEvent) {
		if (previewImage && event.key === 'Escape') {
			previewImage = null
		}
	}
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if images.length > 0}
	<div class="gallery">
		{#each images as image (image.storageKey)}
			<div class="gallery-card">
				<button class="gallery-image-button" type="button" onclick={() => (previewImage = image)}>
					<img src={image.dataUrl} alt="" class="gallery-image" />
				</button>
				<div class="gallery-actions">
					<button type="button" onclick={() => onUseAsReference?.(image.storageKey)}>Use as reference</button>
					<a href={image.dataUrl} download={`image-${image.storageKey.replaceAll(':', '-')}.png`}>Download</a>
				</div>
			</div>
		{/each}
	</div>
{/if}

{#if generating}
	<div class="shimmer-shell">
		<div class="shimmer-card"></div>
	</div>
{/if}

{#if previewImage}
	<div class="preview-overlay" role="presentation" onclick={(event) => event.target === event.currentTarget && (previewImage = null)}>
		<div class="preview-card" role="dialog" aria-modal="true" aria-label="Image preview">
			<button class="preview-close" type="button" aria-label="Close preview" onclick={() => (previewImage = null)}>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
					<path d="M18 6 6 18"></path>
					<path d="m6 6 12 12"></path>
				</svg>
			</button>
			<img src={previewImage.dataUrl} alt="" class="preview-image" />
			<div class="preview-actions">
				<button type="button" onclick={() => previewImage && onUseAsReference?.(previewImage.storageKey)}>Use as reference</button>
				<a href={previewImage.dataUrl} download={`image-${previewImage.storageKey.replaceAll(':', '-')}.png`}>Download</a>
			</div>
		</div>
	</div>
{/if}

<style>
	.gallery {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 1rem;
	}

	.gallery-card {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.gallery-image-button {
		padding: 0;
		border: 1px solid var(--chatbox-border-primary);
		border-radius: 20px;
		background: var(--chatbox-background-secondary);
		overflow: hidden;
		cursor: zoom-in;
		box-shadow: 0 14px 28px rgba(15, 23, 42, 0.08);
	}

	.gallery-image {
		display: block;
		max-width: min(100%, 42rem);
		max-height: min(68vh, 38rem);
		object-fit: contain;
		background: var(--chatbox-background-secondary);
	}

	.gallery-actions,
	.preview-actions {
		display: flex;
		justify-content: center;
		gap: 0.65rem;
		flex-wrap: wrap;
	}

	.gallery-actions button,
	.gallery-actions a,
	.preview-actions button,
	.preview-actions a {
		border: 1px solid var(--chatbox-border-primary);
		border-radius: 999px;
		background: var(--chatbox-background-primary);
		color: var(--chatbox-tint-primary);
		text-decoration: none;
		padding: 0.5rem 0.8rem;
		font: inherit;
		font-size: 0.79rem;
		font-weight: 600;
		cursor: pointer;
	}

	.shimmer-shell {
		display: flex;
		justify-content: center;
	}

	.shimmer-card {
		width: min(100%, 320px);
		height: 320px;
		border-radius: 20px;
		background:
			linear-gradient(
				120deg,
				var(--chatbox-background-secondary) 0%,
				var(--chatbox-background-tertiary) 35%,
				var(--chatbox-background-secondary) 65%
			);
		background-size: 200% 200%;
		animation: shimmer 1.8s ease-in-out infinite;
	}

	.preview-overlay {
		position: fixed;
		inset: 0;
		z-index: 90;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		background: rgba(15, 23, 42, 0.78);
	}

	.preview-card {
		position: relative;
		max-width: min(92vw, 56rem);
		max-height: 92vh;
		border-radius: 22px;
		padding: 1rem;
		background: var(--chatbox-background-primary);
		border: 1px solid var(--chatbox-border-primary);
		box-shadow: 0 24px 80px rgba(15, 23, 42, 0.28);
	}

	.preview-close {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		width: 2rem;
		height: 2rem;
		border: none;
		border-radius: 999px;
		background: rgba(15, 23, 42, 0.82);
		color: white;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}

	.preview-image {
		display: block;
		max-width: 100%;
		max-height: calc(92vh - 6rem);
		object-fit: contain;
		border-radius: 16px;
	}

	@keyframes shimmer {
		0% {
			background-position: 200% 50%;
		}

		100% {
			background-position: -30% 50%;
		}
	}

	@media (max-width: 720px) {
		.gallery-image {
			width: min(100%, 320px);
			height: 320px;
			object-fit: cover;
		}
	}
</style>
