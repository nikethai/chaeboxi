import { useMemo } from 'react'
import { useSettings } from './useSettings'
import { SystemProviders } from 'src/shared/defaults'
import { ModelProvider, ProviderInfo } from 'src/shared/types'
import useChatboxAIModels from './useChatboxAIModels'

export const useProviders = () => {
  const { chatboxAIModels } = useChatboxAIModels()
  const { settings } = useSettings()
  const providerSettingsMap = settings.providers
  const providers = useMemo(
    () =>
      [...SystemProviders, ...(settings.customProviders || [])]
        .map((p) => {
          const providerSettings = providerSettingsMap?.[p.id]
          if (p.id === ModelProvider.ChatboxAI && settings.licenseKey) {
            return {
              ...p,
              ...providerSettings,
              models: chatboxAIModels,
            }
          } else if (
            (!p.isCustom && providerSettings?.apiKey) ||
            ((p.isCustom || p.id === ModelProvider.Ollama || p.id === ModelProvider.LMStudio) &&
              providerSettings?.models?.length)
          ) {
            return {
              ...p,
              ...providerSettings,
            } as ProviderInfo
          } else {
            return null
          }
        })
        .filter((p) => !!p),
    [providerSettingsMap, settings, chatboxAIModels]
  )

  return {
    providers,
  }
}
