const modules = import.meta.glob('../../../../src/shared/providers/index.ts')

export async function loadSharedProvidersRuntime() {
	const providersModule = await modules['../../../../src/shared/providers/index.ts']()

	return {
		getSystemProviders: providersModule.getSystemProviders,
	}
}
