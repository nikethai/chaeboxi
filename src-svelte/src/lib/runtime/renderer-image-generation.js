const modules = import.meta.glob([
	'../../../../src/renderer/stores/imageGenerationStore.ts',
	'../../../../src/renderer/stores/imageGenerationActions.ts',
	'../../../../src/renderer/stores/lastUsedModelStore.ts',
	'../../../../src/renderer/storage/index.ts',
	'../../../../src/renderer/platform/index.ts',
])

export async function loadImageGenerationRuntime() {
	const [storeModule, actionsModule, lastUsedModelModule, storageModule, platformModule] = await Promise.all([
		modules['../../../../src/renderer/stores/imageGenerationStore.ts'](),
		modules['../../../../src/renderer/stores/imageGenerationActions.ts'](),
		modules['../../../../src/renderer/stores/lastUsedModelStore.ts'](),
		modules['../../../../src/renderer/storage/index.ts'](),
		modules['../../../../src/renderer/platform/index.ts'](),
	])

	return {
		imageGenerationStore: storeModule.imageGenerationStore,
		deleteRecord: storeModule.deleteRecord,
		createAndGenerate: actionsModule.createAndGenerate,
		retryGeneration: actionsModule.retryGeneration,
		clearCurrentRecord: actionsModule.clearCurrentRecord,
		initLastUsedModelStore: lastUsedModelModule.initLastUsedModelStore,
		lastUsedModelStore: lastUsedModelModule.lastUsedModelStore,
		storage: storageModule.default,
		platform: platformModule.default,
	}
}
