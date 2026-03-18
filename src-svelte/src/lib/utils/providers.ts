import {
	ModelProviderEnum,
	type BuiltinProviderBaseInfo,
	type ProviderInfo,
	type ProviderModelInfo,
	type Settings,
} from '$shared/types'

export interface SelectedModel {
	provider: string
	modelId: string
}

export function getAvailableProviders(
	settings: Settings,
	systemProviders: BuiltinProviderBaseInfo[] = []
): ProviderInfo[] {
	const baseProviders = [...systemProviders, ...(settings.customProviders || [])]
	const resolvedProviders: Array<ProviderInfo | null> = baseProviders.map((provider) => {
			const providerSettings = settings.providers?.[provider.id]
			const models = providerSettings?.models ?? provider.defaultSettings?.models
			const hasConfiguredAccess =
				(!provider.isCustom && providerSettings?.apiKey) ||
				((provider.isCustom || provider.id === ModelProviderEnum.Ollama || provider.id === ModelProviderEnum.LMStudio) &&
					Boolean(models?.length))

			if (!hasConfiguredAccess) {
				return null
			}

			return {
				...provider,
				...providerSettings,
				models,
			} as ProviderInfo
		})

	return resolvedProviders.filter((provider): provider is ProviderInfo => provider !== null)
}

export function getChatModels(provider: ProviderInfo): ProviderModelInfo[] {
	return (provider.models || provider.defaultSettings?.models || []).filter(
		(model) => !model.type || model.type === 'chat'
	)
}

export function getSelectedModelLabel(providers: ProviderInfo[], selected?: SelectedModel | null): string {
	if (!selected) {
		return 'Select Model'
	}

	const provider = providers.find((candidate) => candidate.id === selected.provider)
	const model = provider ? getChatModels(provider).find((candidate) => candidate.modelId === selected.modelId) : undefined

	return model?.nickname || selected.modelId
}
