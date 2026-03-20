import { browser } from '$app/environment'
import type { ImageGeneration, ImageGenerationModel, ImageGenerationPage } from '$shared/types'
import { blobToDataUrl } from '$lib/image-creator/constants'

interface RendererImageGenerationState {
	currentGeneratingId: string | null
	currentRecordId: string | null
	setCurrentRecordId(id: string | null): void
}

interface RendererImageGenerationStore {
	getState(): RendererImageGenerationState
	subscribe(listener: () => void): () => void
}

interface RendererLastUsedState {
	picture?: {
		provider: string
		modelId: string
	}
}

interface RendererLastUsedStore {
	getState(): RendererLastUsedState
	subscribe(listener: () => void): () => void
}

interface RendererBlobStorage {
	getBlob(key: string): Promise<string | null>
	setBlob(key: string, value: string): Promise<void>
	delBlob(key: string): Promise<void>
}

interface RendererImageStorage {
	initialize(): Promise<void>
	getById(id: string): Promise<ImageGeneration | null>
	getPage(cursor: number, limit?: number): Promise<ImageGenerationPage>
}

interface RendererImagePlatform {
	getImageGenerationStorage(): RendererImageStorage
}

interface CreateAndGenerateParams {
	prompt: string
	referenceImages: string[]
	model: ImageGenerationModel
	dalleStyle?: 'vivid' | 'natural'
	imageGenerateNum?: number
	aspectRatio?: string
	parentIds?: string[]
}

interface RendererImageGenerationRuntime {
	imageGenerationStore: RendererImageGenerationStore
	deleteRecord(id: string): Promise<void>
	createAndGenerate(params: CreateAndGenerateParams): Promise<string>
	retryGeneration(recordId: string): Promise<void>
	clearCurrentRecord(): void
	initLastUsedModelStore(): Promise<unknown>
	lastUsedModelStore: RendererLastUsedStore
	storage: RendererBlobStorage
	platform: RendererImagePlatform
}

interface RendererImageGenerationModule {
	loadImageGenerationRuntime(): Promise<RendererImageGenerationRuntime>
}

function dedupeRecords(records: ImageGeneration[]) {
	const seen = new Set<string>()
	const next: ImageGeneration[] = []

	for (const record of records) {
		if (seen.has(record.id)) {
			continue
		}

		seen.add(record.id)
		next.push(record)
	}

	return next
}

class ImageGenerationStore {
	ready = $state(false)
	history = $state<ImageGeneration[]>([])
	currentRecord = $state<ImageGeneration | null>(null)
	currentRecordId = $state<string | null>(null)
	currentGeneratingId = $state<string | null>(null)
	lastUsedPictureModel = $state<{ provider: string; modelId: string } | null>(null)
	historyLoading = $state(false)
	loadingMore = $state(false)
	error = $state<string | null>(null)

	private rendererModule: RendererImageGenerationRuntime | null = null
	private initializing: Promise<void> | null = null
	private historyCursor: number | null = 0
	private unsubscribeImageStore: (() => void) | null = null
	private unsubscribeLastUsed: (() => void) | null = null
	private pollTimer: number | null = null
	private recordRefreshInFlight: Promise<ImageGeneration | null> | null = null

	constructor() {
		if (browser) {
			void this.init()
		}
	}

	get hasMoreHistory() {
		return this.historyCursor !== null
	}

	private get imageStorage() {
		return this.rendererModule?.platform.getImageGenerationStorage() ?? null
	}

	private syncFromRendererStore() {
		if (!this.rendererModule) {
			return
		}

		const rendererState = this.rendererModule.imageGenerationStore.getState()
		const nextRecordId = rendererState.currentRecordId
		const nextGeneratingId = rendererState.currentGeneratingId
		const recordChanged = this.currentRecordId !== nextRecordId
		const generatingChanged = this.currentGeneratingId !== nextGeneratingId

		this.currentRecordId = nextRecordId
		this.currentGeneratingId = nextGeneratingId
		this.lastUsedPictureModel = this.rendererModule.lastUsedModelStore.getState().picture ?? null

		if (!nextRecordId) {
			this.currentRecord = null
		}

		if (recordChanged && nextRecordId) {
			void this.refreshCurrentRecord()
		}

		if (generatingChanged) {
			this.syncPolling()

			if (!nextGeneratingId) {
				void this.loadHistory(true)
			}
		}
	}

	private syncPolling() {
		if (!browser) {
			return
		}

		if (this.currentGeneratingId && this.pollTimer === null) {
			this.pollTimer = window.setInterval(() => {
				void this.refreshCurrentRecord()
			}, 800)
			return
		}

		if (!this.currentGeneratingId && this.pollTimer !== null) {
			window.clearInterval(this.pollTimer)
			this.pollTimer = null
		}
	}

	private patchHistoryRecord(record: ImageGeneration | null) {
		if (!record) {
			return
		}

		const index = this.history.findIndex((candidate) => candidate.id === record.id)
		if (index >= 0) {
			const nextHistory = [...this.history]
			nextHistory[index] = record
			this.history = nextHistory
			return
		}

		this.history = dedupeRecords([record, ...this.history])
	}

	private async loadHistoryInternal(reset = false) {
		if (!this.imageStorage) {
			return
		}

		if (reset) {
			this.historyLoading = true
			this.historyCursor = 0
			this.error = null
		} else if (this.historyCursor === null || this.loadingMore) {
			return
		} else {
			this.loadingMore = true
		}

		try {
			const cursor = reset ? 0 : this.historyCursor ?? 0
			const page = await this.imageStorage.getPage(cursor)
			this.historyCursor = page.nextCursor
			this.history = reset ? page.items : dedupeRecords([...this.history, ...page.items])
		} catch (error) {
			this.error = error instanceof Error ? error.message : `${error}`
		} finally {
			this.historyLoading = false
			this.loadingMore = false
		}
	}

	private async refreshCurrentRecordInternal() {
		if (!this.imageStorage || !this.currentRecordId) {
			this.currentRecord = null
			return null
		}

		if (this.recordRefreshInFlight) {
			return this.recordRefreshInFlight
		}

		this.recordRefreshInFlight = this.imageStorage
			.getById(this.currentRecordId)
			.then((record) => {
				this.currentRecord = record
				this.patchHistoryRecord(record)
				return record
			})
			.finally(() => {
				this.recordRefreshInFlight = null
			})

		return this.recordRefreshInFlight
	}

	async init() {
		if (!browser || this.ready) {
			return
		}

		if (!this.initializing) {
			this.initializing = (async () => {
				const rendererLoader = (await import('$lib/runtime/renderer-image-generation.js')) as RendererImageGenerationModule
				this.rendererModule = await rendererLoader.loadImageGenerationRuntime()
				await Promise.all([
					this.rendererModule.initLastUsedModelStore(),
					this.rendererModule.platform.getImageGenerationStorage().initialize(),
				])

				this.syncFromRendererStore()

				if (!this.unsubscribeImageStore) {
					this.unsubscribeImageStore = this.rendererModule.imageGenerationStore.subscribe(() => {
						this.syncFromRendererStore()
					})
				}

				if (!this.unsubscribeLastUsed) {
					this.unsubscribeLastUsed = this.rendererModule.lastUsedModelStore.subscribe(() => {
						this.lastUsedPictureModel = this.rendererModule?.lastUsedModelStore.getState().picture ?? null
					})
				}

				await Promise.all([this.loadHistoryInternal(true), this.refreshCurrentRecordInternal()])
				this.ready = true
			})()
		}

		await this.initializing
	}

	async loadHistory(reset = false) {
		await this.init()
		await this.loadHistoryInternal(reset)
	}

	async refreshCurrentRecord() {
		await this.init()
		return await this.refreshCurrentRecordInternal()
	}

	async selectRecord(recordId: string) {
		await this.init()
		this.rendererModule?.imageGenerationStore.getState().setCurrentRecordId(recordId)
		this.syncFromRendererStore()
		return await this.refreshCurrentRecord()
	}

	async createAndGenerate(params: CreateAndGenerateParams) {
		await this.init()
		if (!this.rendererModule) {
			return null
		}

		const recordId = await this.rendererModule.createAndGenerate(params)
		this.syncFromRendererStore()
		await this.refreshCurrentRecord()
		return recordId
	}

	async retryGeneration(recordId: string) {
		await this.init()
		await this.rendererModule?.retryGeneration(recordId)
		this.syncFromRendererStore()
		await this.refreshCurrentRecord()
	}

	async deleteRecord(recordId: string) {
		await this.init()
		await this.rendererModule?.deleteRecord(recordId)
		this.history = this.history.filter((record) => record.id !== recordId)
		this.syncFromRendererStore()
		if (this.currentRecordId === recordId) {
			this.currentRecord = null
		}
	}

	clearCurrentRecord() {
		this.rendererModule?.clearCurrentRecord()
		this.syncFromRendererStore()
	}

	async getStoredImageDataUrl(storageKey: string) {
		await this.init()
		const blob = await this.rendererModule?.storage.getBlob(storageKey)
		return blob ? blobToDataUrl(blob) : null
	}

	async saveStoredImage(storageKey: string, dataUrl: string) {
		await this.init()
		await this.rendererModule?.storage.setBlob(storageKey, dataUrl)
	}

	async deleteStoredImage(storageKey: string) {
		await this.init()
		await this.rendererModule?.storage.delBlob(storageKey)
	}
}

export const imageGenerationStore = new ImageGenerationStore()
