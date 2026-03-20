<script lang="ts">
	import type { ImageGeneration } from '$shared/types'
	import { IMAGE_MODEL_FALLBACK_NAMES } from '$lib/image-creator/constants'
	import { imageGenerationStore } from '$lib/stores/image-generation.svelte'

	interface Props {
		records?: ImageGeneration[]
		currentRecordId?: string | null
		loading?: boolean
		hasMore?: boolean
		loadingMore?: boolean
		mobile?: boolean
		onSelect?: (record: ImageGeneration) => void
		onLoadMore?: () => void
		onDelete?: (recordId: string) => void
	}

	let {
		records = [],
		currentRecordId = null,
		loading = false,
		hasMore = false,
		loadingMore = false,
		mobile = false,
		onSelect,
		onLoadMore,
		onDelete,
	}: Props = $props()

	let thumbnails = $state<Record<string, string | null>>({})

	$effect(() => {
		const nextRecords = records
			.map((record) => ({
				id: record.id,
				storageKey: record.generatedImages[0] ?? null,
			}))
			.filter((record) => record.storageKey && thumbnails[record.id] === undefined)

		if (nextRecords.length === 0) {
			return
		}

		void Promise.all(
			nextRecords.map(async (record) => {
				const imageUrl = record.storageKey ? await imageGenerationStore.getStoredImageDataUrl(record.storageKey) : null
				return { id: record.id, imageUrl }
			})
		).then((results) => {
			thumbnails = {
				...thumbnails,
				...Object.fromEntries(results.map((result) => [result.id, result.imageUrl])),
			}
		})
	})

	function confirmDelete(recordId: string) {
		if (mobile && !window.confirm('Delete this image record?')) {
			return
		}

		onDelete?.(recordId)
	}
</script>

<div class="history-list">
	{#if loading && records.length === 0}
		{#each Array.from({ length: 3 }) as _, index (index)}
			<div class="history-skeleton"></div>
		{/each}
	{:else if records.length === 0}
		<div class="history-empty">
			<p>No image history yet.</p>
		</div>
	{:else}
		{#each records as record (record.id)}
			<div
				role="button"
				tabindex="0"
				class="history-item"
				class:active={record.id === currentRecordId}
				onclick={() => onSelect?.(record)}
				onkeydown={(event) => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault()
						onSelect?.(record)
					}
				}}
			>
				<div class="history-thumb">
					{#if thumbnails[record.id]}
						<img src={thumbnails[record.id] ?? ''} alt="" />
					{:else}
						<div class="history-thumb-fallback">
							<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
								<rect x="3" y="3" width="18" height="18" rx="3"></rect>
								<circle cx="8.5" cy="8.5" r="1.5"></circle>
								<path d="m21 15-5-5L5 21"></path>
							</svg>
						</div>
					{/if}
				</div>

				<div class="history-copy">
					<div class="history-title">{record.prompt}</div>
					<div class="history-meta">
						<span>{new Date(record.createdAt).toLocaleDateString()}</span>
						<span>•</span>
						<span>{IMAGE_MODEL_FALLBACK_NAMES[record.model.modelId] || record.model.modelId}</span>
					</div>
				</div>

					<button
						type="button"
						class="history-delete"
						aria-label="Delete image record"
					onclick={(event) => {
						event.stopPropagation()
						confirmDelete(record.id)
					}}
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M3 6h18"></path>
							<path d="M8 6V4h8v2"></path>
							<path d="m19 6-1 14H6L5 6"></path>
						</svg>
					</button>
			</div>
		{/each}

		{#if hasMore}
			<button type="button" class="load-more" onclick={() => onLoadMore?.()} disabled={loadingMore}>
				{loadingMore ? 'Loading…' : 'Load more'}
			</button>
		{/if}
	{/if}
</div>

<style>
	.history-list {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0.7rem;
	}

	.history-skeleton {
		height: 64px;
		border-radius: 16px;
		background:
			linear-gradient(
				120deg,
				var(--chatbox-background-secondary) 0%,
				var(--chatbox-background-tertiary) 35%,
				var(--chatbox-background-secondary) 65%
			);
		background-size: 200% 200%;
		animation: history-shimmer 1.5s ease-in-out infinite;
	}

	.history-empty {
		padding: 2rem 1rem;
		text-align: center;
		color: var(--chatbox-tint-tertiary);
		font-size: 0.82rem;
	}

	.history-empty p {
		margin: 0;
	}

	.history-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.5rem;
		border: 1px solid transparent;
		border-radius: 16px;
		background: transparent;
		color: inherit;
		cursor: pointer;
		text-align: left;
		transition: background 0.15s ease, border-color 0.15s ease;
	}

	.history-item:focus-visible {
		outline: 2px solid var(--chatbox-border-brand);
		outline-offset: 2px;
	}

	.history-item:hover {
		background: var(--chatbox-background-secondary);
	}

	.history-item.active {
		background: var(--chatbox-background-brand-secondary);
		border-color: var(--chatbox-border-brand);
	}

	.history-thumb {
		width: 48px;
		height: 48px;
		flex-shrink: 0;
		border-radius: 12px;
		overflow: hidden;
		border: 1px solid var(--chatbox-border-primary);
		background: var(--chatbox-background-secondary);
	}

	.history-thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.history-thumb-fallback {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--chatbox-tint-tertiary);
	}

	.history-copy {
		flex: 1;
		min-width: 0;
	}

	.history-title {
		line-clamp: 2;
		font-size: 0.78rem;
		line-height: 1.3;
		color: var(--chatbox-tint-primary);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.history-meta {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		margin-top: 0.3rem;
		font-size: 0.7rem;
		color: var(--chatbox-tint-tertiary);
	}

	.history-delete {
		width: 1.9rem;
		height: 1.9rem;
		border: none;
		border-radius: 10px;
		background: transparent;
		color: var(--chatbox-tint-tertiary);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		flex-shrink: 0;
		transition: background 0.15s ease, color 0.15s ease;
	}

	.history-delete:hover {
		background: var(--chatbox-background-error-secondary);
		color: var(--chatbox-tint-error);
	}

	.load-more {
		margin-top: 0.45rem;
		border: 1px solid var(--chatbox-border-primary);
		border-radius: 14px;
		background: var(--chatbox-background-secondary);
		color: var(--chatbox-tint-primary);
		padding: 0.65rem 0.8rem;
		font: inherit;
		font-size: 0.78rem;
		font-weight: 600;
		cursor: pointer;
	}

	.load-more:disabled {
		cursor: progress;
		opacity: 0.7;
	}

	@keyframes history-shimmer {
		0% {
			background-position: 200% 50%;
		}

		100% {
			background-position: -30% 50%;
		}
	}
</style>
