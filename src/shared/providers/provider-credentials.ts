import { ModelProviderEnum } from '../types/provider'
import type { ProviderBaseInfo, ProviderSettings } from '../types'

/**
 * True when the provider has usable credentials for chat:
 * developer API key and/or OAuth access token (e.g. SuperGrok / X Premium).
 */
export function hasProviderCredentials(settings?: ProviderSettings | null): boolean {
  if (!settings) return false
  if (typeof settings.apiKey === 'string' && settings.apiKey.trim().length > 0) {
    return true
  }
  if (typeof settings.oauth?.accessToken === 'string' && settings.oauth.accessToken.length > 0) {
    return true
  }
  return false
}

const LOCAL_PROVIDER_IDS = new Set<string>([
  ModelProviderEnum.Ollama,
  ModelProviderEnum.LMStudio,
  ModelProviderEnum.OpenClaw,
  ModelProviderEnum.ComfyUI,
])

/**
 * Whether a provider should appear in the settings provider list (configured / usable).
 * - Cloud builtins: need API key or OAuth
 * - Local / custom: models list (or default models for OpenClaw / ComfyUI)
 * - Custom providers always list once created
 */
export function isProviderListedInSettings(
  base: Pick<ProviderBaseInfo, 'id' | 'isCustom' | 'defaultSettings'>,
  settings?: ProviderSettings | null
): boolean {
  if (base.isCustom) {
    return true
  }
  if (hasProviderCredentials(settings)) {
    return true
  }
  if (LOCAL_PROVIDER_IDS.has(base.id)) {
    if (settings?.models?.length) {
      return true
    }
    if (
      (base.id === ModelProviderEnum.OpenClaw || base.id === ModelProviderEnum.ComfyUI) &&
      base.defaultSettings?.models?.length
    ) {
      return true
    }
    // Ollama / LM Studio: show when user has visited and set host, or always offer via Add
    return false
  }
  return false
}
