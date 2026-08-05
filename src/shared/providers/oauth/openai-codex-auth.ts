/**
 * OpenAI dual-auth helpers: ChatGPT / Codex OAuth (subscription) vs Platform API key.
 */

import type { ProviderSettings } from '../../types/settings'
import {
  ensureFreshOpenAICodexAccessToken,
  type OpenAICodexOAuthTokens,
  OpenAICodexOAuthError,
} from './openai-codex-oauth'

export type OpenAIAuthMode = 'oauth' | 'api_key'

/**
 * Resolve auth mode for OpenAI provider.
 * Existing API-key installs stay on api_key; explicit oauth wins when tokens present.
 * Default for empty installs: api_key (preserve power-user mental model).
 */
export function resolveOpenAIAuthMode(settings?: ProviderSettings | null): OpenAIAuthMode {
  if (settings?.authMode === 'api_key' || settings?.authMode === 'oauth') {
    return settings.authMode
  }
  // Backward compatible: existing API key installs stay on api_key
  if (settings?.apiKey && !settings?.oauth?.accessToken) {
    return 'api_key'
  }
  if (settings?.oauth?.accessToken) {
    return 'oauth'
  }
  return 'api_key'
}

export function isOpenAICodexOAuthSignedIn(settings?: ProviderSettings | null): boolean {
  return Boolean(settings?.oauth?.accessToken)
}

/**
 * Sync bearer resolution (no network). Prefer oauth access token when in oauth mode.
 * Never falls back to apiKey in oauth mode (prevents silent Platform billing).
 */
export function resolveOpenAIBearer(settings?: ProviderSettings | null): string {
  const mode = resolveOpenAIAuthMode(settings)
  if (mode === 'oauth') {
    return settings?.oauth?.accessToken || ''
  }
  return settings?.apiKey || ''
}

export function resolveOpenAIAccountId(settings?: ProviderSettings | null): string | undefined {
  return settings?.oauth?.accountId
}

export function openaiCodexTokensFromSettings(
  settings?: ProviderSettings | null
): OpenAICodexOAuthTokens | undefined {
  const o = settings?.oauth
  if (!o?.accessToken) return undefined
  return {
    accessToken: o.accessToken,
    refreshToken: o.refreshToken,
    expiresAt: o.expiresAt,
    tokenType: o.tokenType,
    scope: o.scope,
    obtainedAt: o.obtainedAt,
    accountId: o.accountId,
    planType: o.planType,
    idToken: o.idToken,
  }
}

export function settingsPatchFromOpenAICodexTokens(
  tokens: OpenAICodexOAuthTokens
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
      accountId: tokens.accountId,
      planType: tokens.planType,
      idToken: tokens.idToken,
    },
  }
}

export function settingsPatchSignOutOpenAICodexOAuth(): Partial<ProviderSettings> {
  return {
    oauth: undefined,
    // Keep authMode as oauth so UI stays on ChatGPT subscription path after sign-out
    authMode: 'oauth',
  }
}

/**
 * Ensure a valid bearer for the active auth mode. May refresh OAuth tokens.
 * Returns bearer + optional settings patch to persist refreshed tokens.
 * Never falls back to apiKey when authMode is oauth.
 */
export async function ensureOpenAICodexBearer(
  settings: ProviderSettings | undefined | null,
  options: {
    fetchImpl?: typeof fetch
    now?: number
  } = {}
): Promise<{ bearer: string; accountId?: string; settingsPatch?: Partial<ProviderSettings> }> {
  const mode = resolveOpenAIAuthMode(settings)

  if (mode === 'api_key') {
    const key = settings?.apiKey || ''
    if (!key) {
      throw new OpenAICodexOAuthError(
        'OpenAI API key is required. Paste a key from platform.openai.com or switch to ChatGPT subscription sign-in.',
        'api_key_required'
      )
    }
    return { bearer: key }
  }

  const tokens = openaiCodexTokensFromSettings(settings)
  const result = await ensureFreshOpenAICodexAccessToken(tokens, {
    fetchImpl: options.fetchImpl,
    now: options.now,
  })

  if (result.refreshed) {
    return {
      bearer: result.accessToken,
      accountId: result.tokens.accountId,
      settingsPatch: settingsPatchFromOpenAICodexTokens(result.tokens),
    }
  }

  return {
    bearer: result.accessToken,
    accountId: result.tokens.accountId || settings?.oauth?.accountId,
  }
}

export { OpenAICodexOAuthError }
