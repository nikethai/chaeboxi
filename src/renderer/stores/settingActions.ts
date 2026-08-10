import { hasProviderCredentials } from '@shared/providers/provider-credentials'
import { ModelProviderEnum } from '@shared/types'
import { getDefaultStore } from 'jotai'
import * as atoms from './atoms'
import { settingsStore } from './settingsStore'

export function needEditSetting() {
  const settings = settingsStore.getState()

  if (settings.providers && Object.keys(settings.providers).length > 0) {
    const providers = settings.providers
    const keys = Object.keys(settings.providers)
    // Any provider with API key or OAuth (e.g. SuperGrok)
    if (keys.filter((key) => hasProviderCredentials(providers[key])).length > 0) {
      return false
    }
    // Ollama / LMStudio/ custom provider
    if (
      keys.filter(
        (key) =>
          (key === ModelProviderEnum.Ollama ||
            key === ModelProviderEnum.LMStudio ||
            key === ModelProviderEnum.OpenClaw ||
            key.startsWith('custom-provider')) &&
          providers[key].models?.length
      ).length > 0
    ) {
      return false
    }
  }
  return true
}

export function getLanguage() {
  return settingsStore.getState().language
}

export function getProxy() {
  return settingsStore.getState().proxy
}

export function getRemoteConfig() {
  const store = getDefaultStore()
  return store.get(atoms.remoteConfigAtom)
}

export function getAutoGenerateTitle() {
  return settingsStore.getState().autoGenerateTitle
}

export function getExtensionSettings() {
  return settingsStore.getState().extension
}
