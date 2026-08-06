/**
 * Gemini dual-auth helpers: Antigravity / Cloud Code OAuth vs AI Studio API key.
 */

import type { ProviderSettings } from '../../types/settings'
import {
  ensureFreshGeminiAntigravityAccessToken,
  type GeminiAntigravityOAuthTokens,
  GeminiAntigravityOAuthError,
} from './gemini-antigravity-oauth'

export type GeminiAuthMode = 'oauth' | 'api_key'

/**
 * Resolve auth mode for Gemini provider.
 * Existing API-key installs stay on api_key; default empty installs → api_key.
 */
export function resolveGeminiAuthMode(settings?: ProviderSettings | null): GeminiAuthMode {
  if (settings?.authMode === 'api_key' || settings?.authMode === 'oauth') {
    return settings.authMode
  }
  if (settings?.apiKey && !settings?.oauth?.accessToken) {
    return 'api_key'
  }
  if (settings?.oauth?.accessToken) {
    return 'oauth'
  }
  return 'api_key'
}

export function isGeminiAntigravityOAuthSignedIn(settings?: ProviderSettings | null): boolean {
  return Boolean(settings?.oauth?.accessToken)
}

/**
 * Sync credential resolution (no network).
 * Never falls back to apiKey in oauth mode (prevents silent API billing).
 */
export function resolveGeminiCredential(settings?: ProviderSettings | null): string {
  const mode = resolveGeminiAuthMode(settings)
  if (mode === 'oauth') {
    return settings?.oauth?.accessToken || ''
  }
  return settings?.apiKey || ''
}

export function resolveGeminiAntigravityProjectId(settings?: ProviderSettings | null): string | undefined {
  return settings?.oauth?.projectId
}

export function geminiAntigravityTokensFromSettings(
  settings?: ProviderSettings | null
): GeminiAntigravityOAuthTokens | undefined {
  const o = settings?.oauth
  if (!o?.accessToken) return undefined
  return {
    accessToken: o.accessToken,
    refreshToken: o.refreshToken,
    expiresAt: o.expiresAt,
    tokenType: o.tokenType,
    scope: o.scope,
    obtainedAt: o.obtainedAt,
    projectId: o.projectId,
    email: o.email,
    planType: o.planType,
  }
}

export function settingsPatchFromGeminiAntigravityTokens(
  tokens: GeminiAntigravityOAuthTokens,
  extras?: { riskAcceptedAt?: number }
): Partial<ProviderSettings> {
  return {
    authMode: 'oauth',
    oauth: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      tokenType: tokens.tokenType,
      scope: tokens.scope,
      obtainedAt: tokens.obtainedAt,
      projectId: tokens.projectId,
      email: tokens.email,
      planType: tokens.planType,
      riskAcceptedAt: extras?.riskAcceptedAt,
    },
  }
}

export function settingsPatchSignOutGeminiAntigravityOAuth(): Partial<ProviderSettings> {
  return {
    oauth: undefined,
    // Keep authMode as oauth so UI stays on Google sign-in path after sign-out
    authMode: 'oauth',
  }
}

/**
 * Ensure a valid credential for the active auth mode. May refresh OAuth tokens.
 * Never falls back to apiKey when authMode is oauth.
 */
export async function ensureGeminiAntigravityBearer(
  settings: ProviderSettings | undefined | null,
  options: {
    fetchImpl?: typeof fetch
    now?: number
  } = {}
): Promise<{
  bearer: string
  projectId?: string
  settingsPatch?: Partial<ProviderSettings>
}> {
  const mode = resolveGeminiAuthMode(settings)

  if (mode === 'api_key') {
    const key = settings?.apiKey || ''
    if (!key) {
      throw new GeminiAntigravityOAuthError(
        'Gemini API key is required. Paste a key from AI Studio or switch to Google sign-in.',
        'api_key_required'
      )
    }
    return { bearer: key }
  }

  const tokens = geminiAntigravityTokensFromSettings(settings)
  const result = await ensureFreshGeminiAntigravityAccessToken(tokens, {
    fetchImpl: options.fetchImpl,
    now: options.now,
  })

  if (result.refreshed) {
    return {
      bearer: result.accessToken,
      projectId: result.tokens.projectId || settings?.oauth?.projectId,
      settingsPatch: settingsPatchFromGeminiAntigravityTokens(result.tokens, {
        riskAcceptedAt: settings?.oauth?.riskAcceptedAt,
      }),
    }
  }

  return {
    bearer: result.accessToken,
    projectId: result.tokens.projectId || settings?.oauth?.projectId,
  }
}

export { GeminiAntigravityOAuthError }
