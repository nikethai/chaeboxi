import { ensureXaiBearer, resolveXaiAuthMode } from '@shared/providers/oauth'
import { ModelProviderEnum, type Settings } from '@shared/types'
import { settingsStore } from '@/stores/settingsStore'

/**
 * Before xAI model calls, refresh OAuth tokens if needed and persist the patch.
 * Returns updated global settings snapshot for getModel.
 */
export async function refreshXaiAuthIfNeeded(globalSettings: Settings, providerId?: string): Promise<Settings> {
  if (providerId !== ModelProviderEnum.XAI) {
    return globalSettings
  }

  const providerSettings = globalSettings.providers?.[ModelProviderEnum.XAI]
  if (resolveXaiAuthMode(providerSettings) !== 'oauth') {
    return globalSettings
  }

  try {
    const { settingsPatch } = await ensureXaiBearer(providerSettings)
    if (!settingsPatch) {
      return globalSettings
    }

    settingsStore.setState((current) => {
      const currentProvider = current.providers?.[ModelProviderEnum.XAI] || {}
      return {
        providers: {
          ...(current.providers || {}),
          [ModelProviderEnum.XAI]: {
            ...currentProvider,
            ...settingsPatch,
          },
        },
      }
    })

    return settingsStore.getState().getSettings()
  } catch {
    // Leave settings unchanged; getModel / chat will surface missing/expired auth
    return globalSettings
  }
}
