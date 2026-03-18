import { browser } from '$app/environment'
import type { BuiltinProviderBaseInfo } from '$shared/types'

interface SharedProvidersLoaderModule {
	loadSharedProvidersRuntime(): Promise<{
		getSystemProviders: () => BuiltinProviderBaseInfo[]
	}>
}

class ProviderCatalogStore {
	systemProviders = $state<BuiltinProviderBaseInfo[]>([])
	ready = $state(false)
	private initializing: Promise<BuiltinProviderBaseInfo[]> | null = null

	constructor() {
		if (browser) {
			void this.init()
		}
	}

	async init(): Promise<BuiltinProviderBaseInfo[]> {
		if (!browser) {
			return this.systemProviders
		}

		if (this.ready) {
			return this.systemProviders
		}

		if (!this.initializing) {
			this.initializing = (async () => {
				const loaderModule = (await import('$lib/runtime/shared-providers.js')) as SharedProvidersLoaderModule
				const runtime = await loaderModule.loadSharedProvidersRuntime()
				this.systemProviders = runtime.getSystemProviders()
				this.ready = true
				return this.systemProviders
			})()
		}

		return this.initializing
	}
}

export const providerCatalogStore = new ProviderCatalogStore()
