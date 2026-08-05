import {
  ensureOpenAICodexBearer,
  resolveOpenAIAuthMode,
} from '@shared/providers/oauth'
import { ModelProviderEnum, type Settings } from '@shared/types'
import { settingsStore } from '@/stores/settingsStore'

/**
 * Before OpenAI model calls in ChatGPT/Codex OAuth mode, refresh tokens if needed
 * and persist the patch. Never falls back to Platform API key.
 */
export async function refreshOpenAICodexAuthIfNeeded(
  globalSettings: Settings,
  providerId?: string
): Promise<Settings> {
  if (providerId !== ModelProviderEnum.OpenAI) {
    return globalSettings
  }

  const providerSettings = globalSettings.providers?.[ModelProviderEnum.OpenAI]
  if (resolveOpenAIAuthMode(providerSettings) !== 'oauth') {
    return globalSettings
  }

  try {
    const { settingsPatch } = await ensureOpenAICodexBearer(providerSettings)
    if (!settingsPatch) {
      return globalSettings
    }

    settingsStore.setState((current) => {
      const currentProvider = current.providers?.[ModelProviderEnum.OpenAI] || {}
      return {
        providers: {
          ...(current.providers || {}),
          [ModelProviderEnum.OpenAI]: {
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
