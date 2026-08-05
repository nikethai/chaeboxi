import type { ProviderSettings } from '../types'

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
