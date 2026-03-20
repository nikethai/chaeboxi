<script lang="ts">
	import type { ImageGeneration, ProviderInfo } from '$shared/types'
	import { ModelProviderEnum, ModelProviderType } from '$shared/types'
	import { onMount } from 'svelte'
	import EmptyState from '$lib/components/image-creator/EmptyState.svelte'
	import ErrorCard from '$lib/components/image-creator/ErrorCard.svelte'
	import GeneratedImagesGallery from '$lib/components/image-creator/GeneratedImagesGallery.svelte'
	import HistoryList from '$lib/components/image-creator/HistoryList.svelte'
	import MobileSheet from '$lib/components/image-creator/MobileSheet.svelte'
	import PromptDisplay from '$lib/components/image-creator/PromptDisplay.svelte'
	import ReferenceImagesPreview from '$lib/components/image-creator/ReferenceImagesPreview.svelte'
	import {
		GEMINI_IMAGE_MODEL_IDS,
		HISTORY_PANEL_WIDTH,
		IMAGE_MODEL_FALLBACK_NAMES,
		MAX_REFERENCE_IMAGES,
		OPENAI_IMAGE_MODEL_IDS,
		getRatioOptionsForModel,
	} from '$lib/image-creator/constants'
	import { providerCatalogStore } from '$lib/stores/provider-catalog.svelte'
	import { settingsStore } from '$lib/stores/settings.svelte'
	import { imageGenerationStore } from '$lib/stores/image-generation.svelte'
	import { getAvailableProviders } from '$lib/utils/providers'
	import { StorageKeyGenerator } from '../../../../src/renderer/storage/StoreStorage'

	type ImageModelGroup = {
		label: string
		providerId: string
		models: Array<{
			modelId: string
			displayName: string
		}>
	}

	type ReferenceImage = {
		storageKey: string
		dataUrl: string
		sourceRecordId?: string
	}

	type GalleryImage = {
		storageKey: string
		dataUrl: string
	}

	let ready = $state(false)
	let prompt = $state('')
	let referenceImages = $state<ReferenceImage[]>([])
	let generatedImages = $state<GalleryImage[]>([])
	let selectedProvider = $state<string>(ModelProviderEnum.OpenAI)
	let selectedModel = $state('')
	let selectedRatio = $state('auto')
	let showHistory = $state(true)
	let showHistorySheet = $state(false)
	let showModelSheet = $state(false)
	let showRatioSheet = $state(false)
	let modelMenuOpen = $state(false)
	let ratioMenuOpen = $state(false)
	let isSubmitting = $state(false)
	let isRetrying = $state(false)
	let isSmallScreen = $state(false)
	let fileInput = $state<HTMLInputElement | null>(null)
	let textarea = $state<HTMLTextAreaElement | null>(null)
	let modelMenuRoot = $state<HTMLDivElement | null>(null)
	let ratioMenuRoot = $state<HTMLDivElement | null>(null)

	const providers = $derived(getAvailableProviders(settingsStore.settings, providerCatalogStore.systemProviders))

	const imageModelGroups = $derived(getImageModelGroups(providers))
	const hasImageProviders = $derived(imageModelGroups.length > 0)
	const currentRecord = $derived(imageGenerationStore.currentRecord)
	const isGenerating = $derived(Boolean(imageGenerationStore.currentGeneratingId))
	const ratioOptions = $derived(getRatioOptionsForModel(selectedModel))
	const modelDisplayName = $derived(getModelDisplayName(providers, selectedProvider, selectedModel))

	$effect(() => {
		const groups = imageModelGroups
		if (groups.length === 0) {
			selectedProvider = ''
			selectedModel = ''
			return
		}

		const lastUsed = imageGenerationStore.lastUsedPictureModel
		const requestedProvider = lastUsed?.provider ?? selectedProvider
		const requestedModel = lastUsed?.modelId ?? selectedModel
		const hasSelection = groups.some(
			(group) => group.providerId === requestedProvider && group.models.some((model) => model.modelId === requestedModel)
		)

		if (hasSelection) {
			selectedProvider = requestedProvider
			selectedModel = requestedModel
			return
		}

		const firstGroup = groups[0]
		const firstModel = firstGroup?.models[0]
		if (firstGroup && firstModel) {
			selectedProvider = firstGroup.providerId
			selectedModel = firstModel.modelId
		}
	})

	$effect(() => {
		if (!ratioOptions.includes(selectedRatio)) {
			selectedRatio = 'auto'
		}
	})

	$effect(() => {
		const storageKeys = currentRecord?.generatedImages ?? []
		if (storageKeys.length === 0) {
			generatedImages = []
			return
		}

		let cancelled = false
		void Promise.all(
			storageKeys.map(async (storageKey) => {
				const dataUrl = await imageGenerationStore.getStoredImageDataUrl(storageKey)
				return dataUrl ? { storageKey, dataUrl } : null
			})
		).then((images) => {
			if (cancelled) {
				return
			}

			generatedImages = images.filter((image): image is GalleryImage => image !== null)
		})

		return () => {
			cancelled = true
		}
	})

	onMount(async () => {
		updateScreenSize()
		await Promise.all([settingsStore.init(), providerCatalogStore.init(), imageGenerationStore.init()])
		ready = true
	})

	function updateScreenSize() {
		isSmallScreen = window.innerWidth <= 820
		if (isSmallScreen) {
			modelMenuOpen = false
			ratioMenuOpen = false
		}
	}

	function handleWindowClick(event: MouseEvent) {
		const target = event.target as Node | null

		if (modelMenuRoot && target && !modelMenuRoot.contains(target)) {
			modelMenuOpen = false
		}

		if (ratioMenuRoot && target && !ratioMenuRoot.contains(target)) {
			ratioMenuOpen = false
		}
	}

	function getImageModelGroups(providerList: ProviderInfo[]): ImageModelGroup[] {
		const groups: ImageModelGroup[] = []

		const geminiProvider = providerList.find((provider) => provider.id === ModelProviderEnum.Gemini)
		if (geminiProvider) {
			const models = getAvailableImageModels(geminiProvider, GEMINI_IMAGE_MODEL_IDS)
			if (models.length > 0) {
				groups.push({
					label: 'Google Gemini',
					providerId: geminiProvider.id,
					models,
				})
			}
		}

		for (const provider of providerList.filter(
			(candidate) => candidate.isCustom && candidate.type === ModelProviderType.Gemini
		)) {
			const models = getAvailableImageModels(provider, GEMINI_IMAGE_MODEL_IDS)
			if (models.length > 0) {
				groups.push({
					label: provider.name,
					providerId: provider.id,
					models,
				})
			}
		}

		for (const provider of providerList.filter((candidate) =>
			[ModelProviderEnum.OpenAI, ModelProviderEnum.Azure].includes(candidate.id as ModelProviderEnum)
		)) {
			const models = getAvailableImageModels(provider, OPENAI_IMAGE_MODEL_IDS)
			if (models.length > 0) {
				groups.push({
					label: provider.name,
					providerId: provider.id,
					models,
				})
			}
		}

		return groups
	}

	function getAvailableImageModels(provider: ProviderInfo, imageModelIds: string[]) {
		const providerModels = provider.models || provider.defaultSettings?.models || []
		return imageModelIds
			.map((modelId) => {
				const model = providerModels.find((candidate) => candidate.modelId === modelId)
				if (!model) {
					return null
				}

				return {
					modelId,
					displayName: model.nickname || IMAGE_MODEL_FALLBACK_NAMES[modelId] || modelId,
				}
			})
			.filter((model): model is { modelId: string; displayName: string } => model !== null)
	}

	function getModelDisplayName(providerList: ProviderInfo[], providerId: string, modelId: string) {
		if (!providerId || !modelId) {
			return 'Select model'
		}

		const provider = providerList.find((candidate) => candidate.id === providerId)
		const models = provider?.models || provider?.defaultSettings?.models || []
		const model = models.find((candidate) => candidate.modelId === modelId)
		const modelLabel = model?.nickname || IMAGE_MODEL_FALLBACK_NAMES[modelId] || modelId

		return provider ? `${provider.name} - ${modelLabel}` : modelLabel
	}

	function focusComposer() {
		textarea?.focus()
	}

	async function loadReferenceImages(storageKeys: string[]) {
		const images = await Promise.all(
			storageKeys.map(async (storageKey) => {
				const dataUrl = await imageGenerationStore.getStoredImageDataUrl(storageKey)
				return dataUrl ? { storageKey, dataUrl } : null
			})
		)

		referenceImages = images.filter((image): image is ReferenceImage => image !== null)
	}

	async function handleHistorySelect(record: ImageGeneration) {
		await imageGenerationStore.selectRecord(record.id)
		prompt = record.prompt
		await loadReferenceImages(record.referenceImages)
		showHistorySheet = false
	}

	function handleNewCreation() {
		imageGenerationStore.clearCurrentRecord()
		prompt = ''
		referenceImages = []
		generatedImages = []
		showHistorySheet = false
		focusComposer()
	}

	function handleModelSelect(providerId: string, modelId: string) {
		selectedProvider = providerId
		selectedModel = modelId
		modelMenuOpen = false
		showModelSheet = false
	}

	function handleRatioSelect(ratio: string) {
		selectedRatio = ratio
		ratioMenuOpen = false
		showRatioSheet = false
	}

	async function handleSubmit() {
		if (!prompt.trim() || !hasImageProviders || isGenerating || isSubmitting || !selectedProvider || !selectedModel) {
			return
		}

		isSubmitting = true
		try {
			const parentIds = [...new Set(referenceImages.map((image) => image.sourceRecordId).filter(Boolean))] as string[]

			await imageGenerationStore.createAndGenerate({
				prompt: prompt.trim(),
				referenceImages: referenceImages.map((image) => image.storageKey),
				model: {
					provider: selectedProvider,
					modelId: selectedModel,
				},
				imageGenerateNum: 1,
				aspectRatio: selectedRatio,
				parentIds: parentIds.length > 0 ? parentIds : undefined,
			})

			prompt = ''
			referenceImages = []
		} finally {
			isSubmitting = false
		}
	}

	async function handleQuickPrompt(promptText: string) {
		if (!hasImageProviders || isGenerating || isSubmitting || !selectedProvider || !selectedModel) {
			return
		}

		isSubmitting = true
		try {
			await imageGenerationStore.createAndGenerate({
				prompt: promptText,
				referenceImages: [],
				model: {
					provider: selectedProvider,
					modelId: selectedModel,
				},
				imageGenerateNum: 1,
				aspectRatio: 'auto',
			})
		} finally {
			isSubmitting = false
		}
	}

	async function handleRetry() {
		if (!currentRecord || isRetrying || isGenerating) {
			return
		}

		isRetrying = true
		try {
			await imageGenerationStore.retryGeneration(currentRecord.id)
		} finally {
			isRetrying = false
		}
	}

	async function handleUseAsReference(storageKey: string) {
		if (referenceImages.length >= MAX_REFERENCE_IMAGES) {
			return
		}

		const dataUrl = await imageGenerationStore.getStoredImageDataUrl(storageKey)
		if (!dataUrl) {
			return
		}

		const sourceRecordId = currentRecord?.id
		const exists = referenceImages.some((image) => image.storageKey === storageKey)
		if (exists) {
			return
		}

		referenceImages = [...referenceImages, { storageKey, dataUrl, sourceRecordId }]
	}

	function handleRemoveReference(storageKey: string) {
		referenceImages = referenceImages.filter((image) => image.storageKey !== storageKey)
	}

	async function handleDeleteRecord(recordId: string) {
		await imageGenerationStore.deleteRecord(recordId)
	}

	async function handleFileUpload(fileList: FileList | null) {
		if (!fileList) {
			return
		}

		const nextImages: ReferenceImage[] = []
		for (const file of Array.from(fileList)) {
			if (!file.type.startsWith('image/')) {
				continue
			}

			if (referenceImages.length + nextImages.length >= MAX_REFERENCE_IMAGES) {
				break
			}

			const dataUrl = await readFileAsDataUrl(file)
			const storageKey = StorageKeyGenerator.picture('image-creator-ref')
			await imageGenerationStore.saveStoredImage(storageKey, dataUrl)
			nextImages.push({ storageKey, dataUrl })
		}

		if (nextImages.length > 0) {
			referenceImages = [...referenceImages, ...nextImages]
		}

		if (fileInput) {
			fileInput.value = ''
		}
	}

	function readFileAsDataUrl(file: File) {
		return new Promise<string>((resolve, reject) => {
			const reader = new FileReader()
			reader.onload = () => resolve(String(reader.result ?? ''))
			reader.onerror = () => reject(reader.error ?? new Error(`Failed to read ${file.name}`))
			reader.readAsDataURL(file)
		})
	}
</script>

<svelte:window onresize={updateScreenSize} onclick={handleWindowClick} />

<div class="image-page">
	<div class="image-page-header">
		<div class="page-copy">
			<p class="page-kicker">Image creator</p>
			<h1>Real generation workflow</h1>
			<p class="page-subtitle">
				Create, retry, browse history, and reuse reference images without placeholder behavior.
			</p>
		</div>

		<div class="page-actions">
			<button class="header-action" type="button" onclick={handleNewCreation}>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
					<path d="M12 5v14"></path>
					<path d="M5 12h14"></path>
				</svg>
				New
			</button>

			<button
				class="header-action"
				type="button"
				onclick={() => {
					if (isSmallScreen) {
						showHistorySheet = true
					} else {
						showHistory = !showHistory
					}
				}}
			>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
					<path d="M3 3v5h5"></path>
					<path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"></path>
				</svg>
				History
			</button>
		</div>
	</div>

	<div class="image-shell">
		<section class="image-main">
			<div class="result-scroll">
				<div class="result-column">
					{#if ready && !hasImageProviders}
						<div class="provider-warning">
							<div>
								<div class="provider-warning-title">Set up an image-capable provider first</div>
								<p>
									The route stays real: if no supported image model is configured, generation remains disabled instead
									of falling back to a fake demo model.
								</p>
							</div>
							<a href="/settings/provider">Provider settings</a>
						</div>
					{/if}

					{#if currentRecord}
						<div class="record-stack">
							<GeneratedImagesGallery
								images={generatedImages}
								generating={currentRecord.status === 'generating' && generatedImages.length === 0}
								onUseAsReference={handleUseAsReference}
							/>

							<PromptDisplay
								prompt={currentRecord.prompt}
								modelLabel={modelDisplayName}
								referenceImageCount={currentRecord.referenceImages.length}
								status={currentRecord.status}
							/>

							{#if currentRecord.status === 'error'}
								<ErrorCard error={currentRecord.error ?? 'Generation failed.'} retrying={isRetrying} onRetry={handleRetry} />
							{/if}
						</div>
					{:else}
						<EmptyState disabled={!hasImageProviders || isGenerating || isSubmitting} onPromptSelect={handleQuickPrompt} />
					{/if}
				</div>
			</div>

			<div class="composer-shell">
				<div class="composer-column">
					<ReferenceImagesPreview
						images={referenceImages}
						onRemove={handleRemoveReference}
						onAdd={() => fileInput?.click()}
					/>

					<input
						bind:this={fileInput}
						type="file"
						class="file-input"
						accept="image/*"
						multiple
						onchange={(event) => handleFileUpload((event.currentTarget as HTMLInputElement).files)}
					/>

					<div class="composer-card">
						<div class="composer-row">
							<textarea
								bind:this={textarea}
								class="composer-textarea"
								placeholder="Describe the image you want to create..."
								value={prompt}
								disabled={!hasImageProviders || isGenerating || isSubmitting}
								rows="1"
								oninput={(event) => {
									prompt = (event.currentTarget as HTMLTextAreaElement).value
									const target = event.currentTarget as HTMLTextAreaElement
									target.style.height = 'auto'
									target.style.height = `${Math.min(target.scrollHeight, 220)}px`
								}}
								onkeydown={(event) => {
									if (event.key === 'Enter' && !event.shiftKey) {
										event.preventDefault()
										void handleSubmit()
									}
								}}
							></textarea>

							<button
								class="send-button"
								class:busy={isGenerating}
								type="button"
								disabled={!prompt.trim() || !hasImageProviders || isGenerating || isSubmitting}
								onclick={() => void handleSubmit()}
							>
								{#if isGenerating}
									<span class="spinner"></span>
								{:else}
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
										<path d="m12 19 7-7-7-7"></path>
										<path d="M5 12h14"></path>
									</svg>
								{/if}
							</button>
						</div>

						<div class="toolbar-row">
							<div class="toolbar-group">
								<div bind:this={modelMenuRoot} class="toolbar-menu">
									<button
										type="button"
										class="toolbar-pill"
										onclick={() => {
											if (isSmallScreen) {
												showModelSheet = true
											} else {
												modelMenuOpen = !modelMenuOpen
											}
										}}
									>
										<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<path d="m12 3 1.9 5.8H20l-4.9 3.6 1.9 5.8-4.9-3.6-4.9 3.6 1.9-5.8L4 8.8h6.1L12 3z"></path>
										</svg>
										<span>{modelDisplayName}</span>
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
											<path d="m6 9 6 6 6-6"></path>
										</svg>
									</button>

									{#if modelMenuOpen && !isSmallScreen}
										<div class="toolbar-dropdown wide">
											{#each imageModelGroups as group (group.providerId)}
												<div class="dropdown-group">
													<div class="dropdown-label">{group.label}</div>
													{#each group.models as model (model.modelId)}
														<button
															type="button"
															class="dropdown-option"
															class:selected={selectedProvider === group.providerId && selectedModel === model.modelId}
															onclick={() => handleModelSelect(group.providerId, model.modelId)}
														>
															{model.displayName}
														</button>
													{/each}
												</div>
											{/each}
										</div>
									{/if}
								</div>

								<div bind:this={ratioMenuRoot} class="toolbar-menu">
									<button
										type="button"
										class="toolbar-pill"
										onclick={() => {
											if (isSmallScreen) {
												showRatioSheet = true
											} else {
												ratioMenuOpen = !ratioMenuOpen
											}
										}}
									>
										<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<rect x="3" y="5" width="18" height="14" rx="2"></rect>
										</svg>
										<span>{selectedRatio}</span>
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
											<path d="m6 9 6 6 6-6"></path>
										</svg>
									</button>

									{#if ratioMenuOpen && !isSmallScreen}
										<div class="toolbar-dropdown narrow">
											{#each ratioOptions as ratio (ratio)}
												<button
													type="button"
													class="dropdown-option"
													class:selected={selectedRatio === ratio}
													onclick={() => handleRatioSelect(ratio)}
												>
													{ratio}
												</button>
											{/each}
										</div>
									{/if}
								</div>

								<button type="button" class="toolbar-pill" onclick={() => fileInput?.click()}>
									<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M14.2 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7.2"></path>
										<path d="M16 3h5v5"></path>
										<path d="m21 3-7 7"></path>
									</svg>
									<span>Upload</span>
								</button>
							</div>

							<button type="button" class="toolbar-pill subtle" onclick={handleNewCreation}>
								<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
									<path d="M12 5v14"></path>
									<path d="M5 12h14"></path>
								</svg>
								<span>New creation</span>
							</button>
						</div>
					</div>

					<p class="composer-disclaimer disclaimer-safe-area">
						AI-generated images may be inaccurate. Review output carefully before using it.
					</p>
				</div>
			</div>
		</section>

		{#if !isSmallScreen && showHistory}
			<aside class="history-panel" style={`width: ${HISTORY_PANEL_WIDTH}px;`}>
				<div class="history-header">
					<div class="history-title">History</div>
					<div class="history-header-actions">
						<button type="button" class="history-header-btn" onclick={handleNewCreation}>New</button>
						<button type="button" class="history-header-btn" onclick={() => (showHistory = false)}>Hide</button>
					</div>
				</div>

				<HistoryList
					records={imageGenerationStore.history}
					currentRecordId={imageGenerationStore.currentRecordId}
					loading={imageGenerationStore.historyLoading}
					hasMore={imageGenerationStore.hasMoreHistory}
					loadingMore={imageGenerationStore.loadingMore}
					onSelect={(record) => void handleHistorySelect(record)}
					onLoadMore={() => void imageGenerationStore.loadHistory()}
					onDelete={(recordId) => void handleDeleteRecord(recordId)}
				/>
			</aside>
		{/if}
	</div>
</div>

<MobileSheet open={showHistorySheet} title="History" onClose={() => (showHistorySheet = false)}>
	{#snippet actions()}
		<button type="button" class="sheet-action" onclick={handleNewCreation}>New</button>
	{/snippet}

	<HistoryList
		records={imageGenerationStore.history}
		currentRecordId={imageGenerationStore.currentRecordId}
		loading={imageGenerationStore.historyLoading}
		hasMore={imageGenerationStore.hasMoreHistory}
		loadingMore={imageGenerationStore.loadingMore}
		mobile
		onSelect={(record) => void handleHistorySelect(record)}
		onLoadMore={() => void imageGenerationStore.loadHistory()}
		onDelete={(recordId) => void handleDeleteRecord(recordId)}
	/>
</MobileSheet>

<MobileSheet open={showModelSheet} title="Select Model" onClose={() => (showModelSheet = false)}>
	<div class="sheet-option-list">
		{#each imageModelGroups as group (group.providerId)}
			<div class="sheet-option-group">
				<div class="sheet-option-label">{group.label}</div>
				{#each group.models as model (model.modelId)}
					<button
						type="button"
						class="sheet-option"
						class:selected={selectedProvider === group.providerId && selectedModel === model.modelId}
						onclick={() => handleModelSelect(group.providerId, model.modelId)}
					>
						{model.displayName}
					</button>
				{/each}
			</div>
		{/each}
	</div>
</MobileSheet>

<MobileSheet open={showRatioSheet} title="Aspect Ratio" onClose={() => (showRatioSheet = false)}>
	<div class="sheet-option-list">
		{#each ratioOptions as ratio (ratio)}
			<button
				type="button"
				class="sheet-option"
				class:selected={selectedRatio === ratio}
				onclick={() => handleRatioSelect(ratio)}
			>
				{ratio}
			</button>
		{/each}
	</div>
</MobileSheet>

<style>
	.image-page {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--chatbox-background-primary);
	}

	.image-page-header {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1rem 0.75rem;
		border-bottom: 1px solid var(--chatbox-border-primary);
	}

	.page-copy {
		min-width: 0;
	}

	.page-kicker {
		margin: 0 0 0.35rem;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--chatbox-tint-tertiary);
	}

	.page-copy h1 {
		margin: 0;
		font-size: 1.15rem;
		line-height: 1.1;
		color: var(--chatbox-tint-primary);
	}

	.page-subtitle {
		margin: 0.3rem 0 0;
		font-size: 0.82rem;
		line-height: 1.45;
		color: var(--chatbox-tint-secondary);
	}

	.page-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.header-action,
	.sheet-action,
	.history-header-btn {
		border: 1px solid var(--chatbox-border-primary);
		border-radius: 999px;
		background: var(--chatbox-background-secondary);
		color: var(--chatbox-tint-primary);
		padding: 0.48rem 0.82rem;
		font: inherit;
		font-size: 0.78rem;
		font-weight: 600;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		cursor: pointer;
	}

	.image-shell {
		flex: 1;
		display: flex;
		min-height: 0;
	}

	.image-main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.result-scroll {
		flex: 1;
		min-height: 0;
		overflow: auto;
	}

	.result-column {
		width: min(100%, 58rem);
		margin: 0 auto;
		padding: 1rem 1rem 1.25rem;
		box-sizing: border-box;
	}

	.provider-warning {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
		padding: 0.95rem 1rem;
		border: 1px solid var(--chatbox-border-primary);
		border-radius: 18px;
		background: color-mix(in srgb, var(--chatbox-background-secondary), transparent 12%);
	}

	.provider-warning-title {
		font-size: 0.92rem;
		font-weight: 700;
		color: var(--chatbox-tint-primary);
		margin-bottom: 0.35rem;
	}

	.provider-warning p {
		margin: 0;
		font-size: 0.82rem;
		line-height: 1.5;
		color: var(--chatbox-tint-secondary);
	}

	.provider-warning a {
		flex-shrink: 0;
		border-radius: 999px;
		background: var(--chatbox-background-brand-primary);
		color: white;
		text-decoration: none;
		padding: 0.58rem 0.88rem;
		font-size: 0.8rem;
		font-weight: 600;
	}

	.record-stack {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0.6rem 0 1rem;
	}

	.composer-shell {
		flex-shrink: 0;
		padding: 0 1rem 0.95rem;
	}

	.composer-column {
		width: min(100%, 52rem);
		margin: 0 auto;
	}

	.file-input {
		display: none;
	}

	.composer-card {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		padding: 0.8rem 0.85rem 0.75rem;
		border: 1px solid var(--chatbox-border-primary);
		border-radius: 24px;
		background:
			linear-gradient(
				180deg,
				color-mix(in srgb, var(--chatbox-background-primary), var(--chatbox-background-secondary) 35%) 0%,
				var(--chatbox-background-primary) 100%
			);
		box-shadow: 0 14px 36px rgba(15, 23, 42, 0.04);
	}

	.composer-row {
		display: flex;
		align-items: flex-end;
		gap: 0.7rem;
	}

	.composer-textarea {
		flex: 1;
		min-height: 2.4rem;
		max-height: 220px;
		border: none;
		outline: none;
		resize: none;
		background: transparent;
		color: var(--chatbox-tint-primary);
		font: inherit;
		font-size: 0.94rem;
		line-height: 1.45;
		padding: 0.15rem 0;
	}

	.composer-textarea::placeholder {
		color: var(--chatbox-tint-tertiary);
	}

	.send-button {
		width: 2.2rem;
		height: 2.2rem;
		border: none;
		border-radius: 999px;
		background: var(--chatbox-background-brand-primary);
		color: white;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		flex-shrink: 0;
	}

	.send-button:disabled {
		background: var(--chatbox-background-tertiary);
		color: var(--chatbox-tint-white);
		cursor: not-allowed;
	}

	.send-button.busy {
		cursor: progress;
	}

	.spinner {
		width: 0.9rem;
		height: 0.9rem;
		border: 2px solid rgba(255, 255, 255, 0.35);
		border-top-color: white;
		border-radius: 999px;
		animation: spin 0.7s linear infinite;
	}

	.toolbar-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.toolbar-group {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		flex-wrap: wrap;
	}

	.toolbar-menu {
		position: relative;
	}

	.toolbar-pill {
		border: 1px solid var(--chatbox-border-primary);
		border-radius: 999px;
		background: var(--chatbox-background-secondary);
		color: var(--chatbox-tint-secondary);
		padding: 0.46rem 0.7rem;
		font: inherit;
		font-size: 0.79rem;
		font-weight: 600;
		display: inline-flex;
		align-items: center;
		gap: 0.38rem;
		cursor: pointer;
		max-width: min(22rem, calc(100vw - 8rem));
	}

	.toolbar-pill span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.toolbar-pill.subtle {
		background: transparent;
	}

	.toolbar-dropdown {
		position: absolute;
		bottom: calc(100% + 0.55rem);
		left: 0;
		z-index: 50;
		padding: 0.45rem;
		border: 1px solid var(--chatbox-border-primary);
		border-radius: 18px;
		background: var(--chatbox-background-primary);
		box-shadow: 0 20px 48px rgba(15, 23, 42, 0.14);
	}

	.toolbar-dropdown.wide {
		width: min(22rem, calc(100vw - 2rem));
		max-height: 22rem;
		overflow: auto;
	}

	.toolbar-dropdown.narrow {
		width: 7rem;
	}

	.dropdown-group + .dropdown-group {
		margin-top: 0.45rem;
		padding-top: 0.45rem;
		border-top: 1px solid var(--chatbox-border-primary);
	}

	.dropdown-label,
	.sheet-option-label,
	.history-title {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--chatbox-tint-tertiary);
	}

	.dropdown-option,
	.sheet-option {
		width: 100%;
		border: none;
		border-radius: 12px;
		background: transparent;
		color: var(--chatbox-tint-primary);
		padding: 0.72rem 0.82rem;
		font: inherit;
		font-size: 0.82rem;
		text-align: left;
		cursor: pointer;
	}

	.dropdown-option:hover,
	.sheet-option:hover {
		background: var(--chatbox-background-secondary);
	}

	.dropdown-option.selected,
	.sheet-option.selected {
		background: var(--chatbox-background-brand-secondary);
		color: var(--chatbox-tint-brand);
	}

	.composer-disclaimer {
		margin: 0.55rem 0 0;
		text-align: center;
		font-size: 0.72rem;
		line-height: 1.4;
		color: var(--chatbox-tint-tertiary);
	}

	.history-panel {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		border-left: 1px solid var(--chatbox-border-primary);
		background: var(--chatbox-background-primary);
	}

	.history-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.95rem 0.9rem 0.7rem;
		border-bottom: 1px solid var(--chatbox-border-primary);
	}

	.history-header-actions {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.sheet-option-list {
		padding: 0.7rem;
	}

	.sheet-option-group + .sheet-option-group {
		margin-top: 0.6rem;
		padding-top: 0.6rem;
		border-top: 1px solid var(--chatbox-border-primary);
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (max-width: 820px) {
		.image-page-header,
		.provider-warning {
			flex-direction: column;
			align-items: flex-start;
		}

		.result-column,
		.composer-shell {
			padding-left: 0.85rem;
			padding-right: 0.85rem;
		}

		.toolbar-row {
			align-items: stretch;
		}

		.toolbar-group {
			width: 100%;
		}
	}
</style>
