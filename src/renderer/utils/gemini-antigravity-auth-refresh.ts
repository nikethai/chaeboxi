import { ensureGeminiAntigravityBearer, resolveGeminiAuthMode } from '@shared/providers/oauth'
import { ModelProviderEnum, type Settings } from '@shared/types'
import { settingsStore } from '@/stores/settingsStore'

/**
 * Before Gemini model calls, refresh OAuth tokens if needed and persist the patch.
 * Returns updated global settings snapshot for getModel.
 */
export async function refreshGeminiAntigravityAuthIfNeeded(
  globalSettings: Settings,
  providerId?: string
): Promise<Settings> {
  if (providerId !== ModelProviderEnum.Gemini) {
    return globalSettings
  }

  const providerSettings = globalSettings.providers?.[ModelProviderEnum.Gemini]
  if (resolveGeminiAuthMode(providerSettings) !== 'oauth') {
    return globalSettings
  }

  try {
    const { settingsPatch } = await ensureGeminiAntigravityBearer(providerSettings)
    if (!settingsPatch) {
      return globalSettings
    }

    settingsStore.setState((current) => {
      const currentProvider = current.providers?.[ModelProviderEnum.Gemini] || {}
      return {
        providers: {
          ...(current.providers || {}),
          [ModelProviderEnum.Gemini]: {
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
