/**
 * xAI SuperGrok / X Premium OAuth (device-code flow).
 *
 * Uses the public Grok CLI OAuth client (same pattern as Hermes, OpenCode, etc.).
 * Endpoints confirmed via OIDC discovery at https://auth.x.ai/.well-known/openid-configuration
 *
 * Network: defaults to Tauri desktop HTTP IPC (no CORS). Pass fetchImpl to override (tests).
 */

import { defaultOAuthFetch } from './desktop-http-fetch'

export const XAI_OAUTH_CLIENT_ID = 'b1a00492-073a-47ea-816f-4c329264a828'

/** Scopes used by subscription-backed agent clients */
export const XAI_OAUTH_SCOPES = 'openid profile email offline_access grok-cli:access api:access'

export const XAI_OIDC_ISSUER = 'https://auth.x.ai'
export const XAI_DEVICE_CODE_URL = 'https://auth.x.ai/oauth2/device/code'
export const XAI_TOKEN_URL = 'https://auth.x.ai/oauth2/token'
export const XAI_API_BASE = 'https://api.x.ai/v1'

/** Refresh this many ms before expiresAt */
export const XAI_TOKEN_EXPIRY_SKEW_MS = 60_000

export type XaiOAuthTokens = {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  tokenType?: string
  scope?: string
  obtainedAt?: number
}

export type XaiDeviceCodeResponse = {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete?: string
  expires_in: number
  interval?: number
}

export type XaiTokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
}

export class XaiOAuthError extends Error {
  readonly code: string
  readonly status?: number

  constructor(message: string, code: string, status?: number) {
    super(message)
    this.name = 'XaiOAuthError'
    this.code = code
    this.status = status
  }
}

type FetchLike = typeof fetch

function resolveFetch(fetchImpl?: FetchLike): FetchLike {
  return fetchImpl || defaultOAuthFetch()
}

function formBody(params: Record<string, string>): string {
  return new URLSearchParams(params).toString()
}

/** Map raw network failures to a clearer user-facing message. */
export function humanizeOAuthNetworkError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  if (
    message === 'Load failed' ||
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('CORS')
  ) {
    return 'Could not reach auth.x.ai (network/CORS). Use the desktop app build, check your connection, then try again.'
  }
  return message
}

function parseJsonSafe(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function tokenErrorMessage(json: unknown, fallback: string): string {
  if (json && typeof json === 'object') {
    const o = json as Record<string, unknown>
    if (typeof o.error_description === 'string') return o.error_description
    if (typeof o.error === 'string') return o.error
    if (typeof o.message === 'string') return o.message
  }
  return fallback
}

export function isXaiTokenExpired(tokens: Pick<XaiOAuthTokens, 'expiresAt'> | undefined | null, now = Date.now()): boolean {
  if (!tokens?.expiresAt) return false
  return tokens.expiresAt - XAI_TOKEN_EXPIRY_SKEW_MS <= now
}

export function tokensFromTokenResponse(data: XaiTokenResponse, now = Date.now()): XaiOAuthTokens {
  const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenType: data.token_type || 'Bearer',
    scope: data.scope,
    obtainedAt: now,
    expiresAt: now + expiresIn * 1000,
  }
}

/**
 * Start device-code authorization. Caller should open verification_uri(_complete)
 * and poll with pollDeviceAuth.
 */
export async function startDeviceAuth(
  options: {
    clientId?: string
    scope?: string
    fetchImpl?: FetchLike
  } = {}
): Promise<XaiDeviceCodeResponse> {
  const fetchImpl = resolveFetch(options.fetchImpl)
  const clientId = options.clientId || XAI_OAUTH_CLIENT_ID
  const scope = options.scope || XAI_OAUTH_SCOPES

  let res: Response
  try {
    res = await fetchImpl(XAI_DEVICE_CODE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: formBody({
        client_id: clientId,
        scope,
      }),
    })
  } catch (err) {
    throw new XaiOAuthError(humanizeOAuthNetworkError(err), 'network_error')
  }

  const text = await res.text()
  const json = parseJsonSafe(text)

  if (!res.ok) {
    throw new XaiOAuthError(tokenErrorMessage(json, `Device code request failed (${res.status})`), 'device_code_failed', res.status)
  }

  const data = json as Partial<XaiDeviceCodeResponse>
  if (!data?.device_code || !data?.user_code || !data?.verification_uri || typeof data.expires_in !== 'number') {
    throw new XaiOAuthError('Invalid device code response from xAI', 'invalid_device_response', res.status)
  }

  return {
    device_code: data.device_code,
    user_code: data.user_code,
    verification_uri: data.verification_uri,
    verification_uri_complete: data.verification_uri_complete,
    expires_in: data.expires_in,
    interval: data.interval ?? 5,
  }
}

export type PollDeviceAuthResult =
  | { status: 'pending' }
  | { status: 'slow_down'; interval: number }
  | { status: 'success'; tokens: XaiOAuthTokens }
  | { status: 'expired' }
  | { status: 'denied' }
  | { status: 'error'; error: XaiOAuthError }

/**
 * Single poll attempt against the token endpoint (device_code grant).
 * Caller owns the sleep loop so UI can cancel.
 */
export async function pollDeviceAuthOnce(
  deviceCode: string,
  options: {
    clientId?: string
    fetchImpl?: FetchLike
    now?: number
  } = {}
): Promise<PollDeviceAuthResult> {
  const fetchImpl = resolveFetch(options.fetchImpl)
  const clientId = options.clientId || XAI_OAUTH_CLIENT_ID
  const now = options.now ?? Date.now()

  let res: Response
  try {
    res = await fetchImpl(XAI_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: formBody({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: deviceCode,
        client_id: clientId,
      }),
    })
  } catch (err) {
    return {
      status: 'error',
      error: new XaiOAuthError(humanizeOAuthNetworkError(err), 'network_error'),
    }
  }

  const text = await res.text()
  const json = parseJsonSafe(text) as Record<string, unknown> | undefined

  if (res.ok && json && typeof json.access_token === 'string') {
    return {
      status: 'success',
      tokens: tokensFromTokenResponse(json as unknown as XaiTokenResponse, now),
    }
  }

  const err = typeof json?.error === 'string' ? json.error : ''
  if (err === 'authorization_pending') {
    return { status: 'pending' }
  }
  if (err === 'slow_down') {
    return { status: 'slow_down', interval: 5 }
  }
  if (err === 'expired_token') {
    return { status: 'expired' }
  }
  if (err === 'access_denied') {
    return { status: 'denied' }
  }

  return {
    status: 'error',
    error: new XaiOAuthError(tokenErrorMessage(json, `Token poll failed (${res.status})`), err || 'token_poll_failed', res.status),
  }
}

/**
 * Poll until success, expiry, denial, or abort.
 */
export async function pollDeviceAuth(
  device: Pick<XaiDeviceCodeResponse, 'device_code' | 'expires_in' | 'interval'>,
  options: {
    clientId?: string
    fetchImpl?: FetchLike
    signal?: AbortSignal
    sleep?: (ms: number) => Promise<void>
    now?: () => number
  } = {}
): Promise<XaiOAuthTokens> {
  const sleep = options.sleep || ((ms: number) => new Promise((r) => setTimeout(r, ms)))
  const nowFn = options.now || (() => Date.now())
  const deadline = nowFn() + device.expires_in * 1000
  let intervalMs = Math.max(1, device.interval ?? 5) * 1000

  while (nowFn() < deadline) {
    if (options.signal?.aborted) {
      throw new XaiOAuthError('Authorization cancelled', 'cancelled')
    }

    const result = await pollDeviceAuthOnce(device.device_code, {
      clientId: options.clientId,
      fetchImpl: options.fetchImpl,
      now: nowFn(),
    })

    if (result.status === 'success') {
      return result.tokens
    }
    if (result.status === 'slow_down') {
      intervalMs = Math.max(intervalMs, result.interval * 1000)
    } else if (result.status === 'expired') {
      throw new XaiOAuthError('Authorization timed out. Please try again.', 'expired_token')
    } else if (result.status === 'denied') {
      throw new XaiOAuthError('Access denied in browser. Please try again.', 'access_denied')
    } else if (result.status === 'error') {
      throw result.error
    }

    await sleep(intervalMs)
  }

  throw new XaiOAuthError('Authorization timed out. Please try again.', 'expired_token')
}

export async function refreshAccessToken(
  refreshToken: string,
  options: {
    clientId?: string
    fetchImpl?: FetchLike
    now?: number
  } = {}
): Promise<XaiOAuthTokens> {
  const fetchImpl = resolveFetch(options.fetchImpl)
  const clientId = options.clientId || XAI_OAUTH_CLIENT_ID
  const now = options.now ?? Date.now()

  let res: Response
  try {
    res = await fetchImpl(XAI_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: formBody({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
      }),
    })
  } catch (err) {
    throw new XaiOAuthError(humanizeOAuthNetworkError(err), 'network_error')
  }

  const text = await res.text()
  const json = parseJsonSafe(text) as Record<string, unknown> | undefined

  if (!res.ok || !json || typeof json.access_token !== 'string') {
    const code = typeof json?.error === 'string' ? json.error : 'refresh_failed'
    throw new XaiOAuthError(tokenErrorMessage(json, `Token refresh failed (${res.status})`), code, res.status)
  }

  const tokens = tokensFromTokenResponse(json as unknown as XaiTokenResponse, now)
  // Some servers omit refresh_token on refresh; keep the old one
  if (!tokens.refreshToken) {
    tokens.refreshToken = refreshToken
  }
  return tokens
}

/**
 * Return a usable access token, refreshing when near expiry.
 * Does not persist — caller should apply returned tokens to settings.
 */
export async function ensureFreshAccessToken(
  tokens: XaiOAuthTokens | undefined | null,
  options: {
    clientId?: string
    fetchImpl?: FetchLike
    now?: number
  } = {}
): Promise<{ accessToken: string; tokens: XaiOAuthTokens; refreshed: boolean }> {
  if (!tokens?.accessToken) {
    throw new XaiOAuthError('Not signed in to xAI. Sign in with SuperGrok / X Premium.', 'not_signed_in')
  }

  const now = options.now ?? Date.now()
  if (!isXaiTokenExpired(tokens, now)) {
    return { accessToken: tokens.accessToken, tokens, refreshed: false }
  }

  if (!tokens.refreshToken) {
    throw new XaiOAuthError('Session expired. Sign in again with SuperGrok / X Premium.', 'session_expired')
  }

  try {
    const next = await refreshAccessToken(tokens.refreshToken, {
      clientId: options.clientId,
      fetchImpl: options.fetchImpl,
      now,
    })
    return { accessToken: next.accessToken, tokens: next, refreshed: true }
  } catch (err) {
    if (err instanceof XaiOAuthError && (err.code === 'invalid_grant' || err.status === 400 || err.status === 401)) {
      throw new XaiOAuthError('Session revoked or expired. Sign in again with SuperGrok / X Premium.', 'invalid_grant', err.status)
    }
    throw err
  }
}
