import {
	ModelProviderEnum,
	ModelProviderType,
	type BuiltinProviderBaseInfo,
	type CustomProviderBaseInfo,
	type ProviderBaseInfo,
	type ProviderModelInfo,
	type ProviderSettings,
	type Settings,
} from '$shared/types'
import { settingsStore } from '$lib/stores/settings.svelte'

type ProviderSettingsUpdater =
	| Partial<ProviderSettings>
	| ((current: ProviderSettings | undefined) => Partial<ProviderSettings>)

const LOCAL_MODEL_ONLY_PROVIDER_IDS = new Set<string>([ModelProviderEnum.Ollama, ModelProviderEnum.LMStudio])

export const customProviderTypeOptions = [
	{ value: ModelProviderType.OpenAI, label: 'OpenAI API Compatible' },
	{ value: ModelProviderType.OpenAIResponses, label: 'OpenAI Responses Compatible' },
	{ value: ModelProviderType.Claude, label: 'Claude API Compatible' },
	{ value: ModelProviderType.Gemini, label: 'Gemini API Compatible' },
] as const

export function getProviderBaseInfos(
	settings: Settings,
	systemProviders: BuiltinProviderBaseInfo[] = []
): ProviderBaseInfo[] {
	return [...systemProviders, ...(settings.customProviders ?? [])]
}

export function getProviderBaseInfo(
	settings: Settings,
	systemProviders: BuiltinProviderBaseInfo[] = [],
	providerId: string
): ProviderBaseInfo | null {
	return getProviderBaseInfos(settings, systemProviders).find((provider) => provider.id === providerId) ?? null
}

export function getProviderSettings(settings: Settings, providerId: string): ProviderSettings | undefined {
	return settings.providers?.[providerId]
}

export function getProviderModels(
	baseInfo: ProviderBaseInfo,
	providerSettings: ProviderSettings | undefined
): ProviderModelInfo[] {
	return providerSettings?.models ?? cloneModels(baseInfo.defaultSettings?.models)
}

export function isProviderConfigured(baseInfo: ProviderBaseInfo, settings: Settings): boolean {
	const providerSettings = getProviderSettings(settings, baseInfo.id)
	const models = getProviderModels(baseInfo, providerSettings)

	if (baseInfo.isCustom || LOCAL_MODEL_ONLY_PROVIDER_IDS.has(baseInfo.id)) {
		return models.length > 0
	}

	return Boolean(providerSettings?.apiKey?.trim())
}

export function getPreferredProviderId(
	settings: Settings,
	systemProviders: BuiltinProviderBaseInfo[] = []
): string | null {
	const providers = getProviderBaseInfos(settings, systemProviders)
	if (providers.length === 0) {
		return null
	}

	const defaultProviderId = settings.defaultChatModel?.provider
	if (defaultProviderId && providers.some((provider) => provider.id === defaultProviderId)) {
		return defaultProviderId
	}

	const firstConfiguredProvider = providers.find((provider) => isProviderConfigured(provider, settings))
	return firstConfiguredProvider?.id ?? providers[0]?.id ?? null
}

export function createCustomProvider(name: string, type: ModelProviderType): string {
	const trimmedName = name.trim() || 'Custom Provider'
	const providerId = `custom-provider-${crypto.randomUUID()}`

	settingsStore.update((draft) => {
		draft.customProviders = [
			...(draft.customProviders ?? []),
			{
				id: providerId,
				name: trimmedName,
				type,
				isCustom: true,
			},
		]
	})

	return providerId
}

export function updateCustomProvider(
	providerId: string,
	updater: Partial<CustomProviderBaseInfo> | ((current: CustomProviderBaseInfo) => Partial<CustomProviderBaseInfo>)
) {
	settingsStore.update((draft) => {
		draft.customProviders = (draft.customProviders ?? []).map((provider) => {
			if (provider.id !== providerId) {
				return provider
			}

			const patch = typeof updater === 'function' ? updater(provider) : updater
			return {
				...provider,
				...patch,
				id: provider.id,
				isCustom: true,
			}
		})
	})
}

export function deleteCustomProvider(providerId: string) {
	settingsStore.update((draft) => {
		draft.customProviders = (draft.customProviders ?? []).filter((provider) => provider.id !== providerId)
		if (draft.providers) {
			delete draft.providers[providerId]
		}
	})
}

export function updateProviderSettings(providerId: string, updater: ProviderSettingsUpdater) {
	settingsStore.update((draft) => {
		draft.providers ??= {}

		const current = draft.providers[providerId]
		const patch = typeof updater === 'function' ? updater(current) : updater

		draft.providers[providerId] = {
			...(current ?? {}),
			...patch,
		}
	})
}

export function upsertProviderModel(
	providerId: string,
	model: ProviderModelInfo,
	currentModels: ProviderModelInfo[],
	options: { previousModelId?: string | null } = {}
) {
	const models = [...currentModels]
	const targetIndex = options.previousModelId
		? models.findIndex((candidate) => candidate.modelId === options.previousModelId)
		: models.findIndex((candidate) => candidate.modelId === model.modelId)

	if (targetIndex >= 0) {
		models[targetIndex] = model
	} else {
		models.push(model)
	}

	updateProviderSettings(providerId, { models })
}

export function removeProviderModel(providerId: string, modelId: string, currentModels: ProviderModelInfo[]) {
	updateProviderSettings(providerId, {
		models: currentModels.filter((model) => model.modelId !== modelId),
	})
}

export function resetProviderModels(providerId: string, baseInfo: ProviderBaseInfo) {
	updateProviderSettings(providerId, {
		models: cloneModels(baseInfo.defaultSettings?.models),
	})
}

function cloneModels(models?: ProviderModelInfo[]): ProviderModelInfo[] {
	return models?.map((model) => ({
		...model,
		labels: model.labels ? [...model.labels] : undefined,
		capabilities: model.capabilities ? [...model.capabilities] : undefined,
	})) ?? []
}
