/**
 * xAI dual-auth helpers: OAuth (SuperGrok / X Premium) vs developer API key.
 */

import type { ProviderSettings } from '../../types/settings'
import {
  ensureFreshAccessToken,
  type XaiOAuthTokens,
  XaiOAuthError,
} from './xai-oauth'

export type XaiAuthMode = 'oauth' | 'api_key'

export function resolveXaiAuthMode(settings?: ProviderSettings | null): XaiAuthMode {
  if (settings?.authMode === 'api_key' || settings?.authMode === 'oauth') {
    return settings.authMode
  }
  // Backward compatible: existing API key installs stay on api_key
  if (settings?.apiKey && !settings?.oauth?.accessToken) {
    return 'api_key'
  }
  // Prefer OAuth when tokens present, else default UI to oauth for new users
  if (settings?.oauth?.accessToken) {
    return 'oauth'
  }
  return 'oauth'
}

export function isXaiOAuthSignedIn(settings?: ProviderSettings | null): boolean {
  return Boolean(settings?.oauth?.accessToken)
}

/**
 * Sync bearer resolution (no network). Prefer oauth access token when in oauth mode.
 */
export function resolveXaiBearer(settings?: ProviderSettings | null): string {
  const mode = resolveXaiAuthMode(settings)
  if (mode === 'oauth') {
    return settings?.oauth?.accessToken || ''
  }
  return settings?.apiKey || ''
}

export function oauthTokensFromSettings(settings?: ProviderSettings | null): XaiOAuthTokens | undefined {
  const o = settings?.oauth
  if (!o?.accessToken) return undefined
  return {
    accessToken: o.accessToken,
    refreshToken: o.refreshToken,
    expiresAt: o.expiresAt,
    tokenType: o.tokenType,
    scope: o.scope,
    obtainedAt: o.obtainedAt,
  }
}

export function settingsPatchFromOAuthTokens(tokens: XaiOAuthTokens): Partial<ProviderSettings> {
  return {
    authMode: 'oauth',
    oauth: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      tokenType: tokens.tokenType,
      scope: tokens.scope,
      obtainedAt: tokens.obtainedAt,
    },
  }
}

export function settingsPatchSignOutOAuth(): Partial<ProviderSettings> {
  return {
    oauth: undefined,
    // Keep authMode as oauth so UI stays on SuperGrok path after sign-out
    authMode: 'oauth',
  }
}

/**
 * Ensure a valid bearer for the active auth mode. May refresh OAuth tokens.
 * Returns bearer + optional settings patch to persist refreshed tokens.
 */
export async function ensureXaiBearer(
  settings: ProviderSettings | undefined | null,
  options: {
    fetchImpl?: typeof fetch
    now?: number
  } = {}
): Promise<{ bearer: string; settingsPatch?: Partial<ProviderSettings> }> {
  const mode = resolveXaiAuthMode(settings)

  if (mode === 'api_key') {
    const key = settings?.apiKey || ''
    if (!key) {
      throw new XaiOAuthError('xAI API key is required. Paste a key from console.x.ai or switch to SuperGrok sign-in.', 'api_key_required')
    }
    return { bearer: key }
  }

  const tokens = oauthTokensFromSettings(settings)
  const result = await ensureFreshAccessToken(tokens, {
    fetchImpl: options.fetchImpl,
    now: options.now,
  })

  if (result.refreshed) {
    return {
      bearer: result.accessToken,
      settingsPatch: settingsPatchFromOAuthTokens(result.tokens),
    }
  }

  return { bearer: result.accessToken }
}

export { XaiOAuthError }
