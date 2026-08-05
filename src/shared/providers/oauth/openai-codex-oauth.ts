/**
 * OpenAI ChatGPT / Codex subscription OAuth (device-code + refresh).
 *
 * Uses the public Codex CLI client id (same pattern as OpenCode, LangChain, OpenClaw).
 * Chat billed against ChatGPT Plus/Pro/Team quota via WHAM Responses backend —
 * not Platform API keys.
 *
 * Network: defaults to Tauri desktop HTTP IPC (no CORS). Pass fetchImpl to override (tests).
 */

import { defaultOAuthFetch } from '../../utils/desktop-http-fetch'

/** Codex CLI public client id (widely reused by third-party agent tools) */
export const OPENAI_CODEX_OAUTH_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann'

export const OPENAI_CODEX_OAUTH_SCOPES = 'openid profile email offline_access'

export const OPENAI_CODEX_AUTHORIZE_URL = 'https://auth.openai.com/oauth/authorize'
export const OPENAI_CODEX_TOKEN_URL = 'https://auth.openai.com/oauth/token'
export const OPENAI_CODEX_DEVICE_CODE_URL = 'https://auth.openai.com/api/accounts/deviceauth/usercode'
export const OPENAI_CODEX_DEVICE_TOKEN_URL = 'https://auth.openai.com/api/accounts/deviceauth/token'
export const OPENAI_CODEX_DEVICE_REDIRECT_URI = 'https://auth.openai.com/deviceauth/callback'
/** Browser page where user enters the device user code */
export const OPENAI_CODEX_DEVICE_VERIFICATION_URI = 'https://auth.openai.com/codex/device'

/** WHAM (Codex) Responses base — subscription-backed chat */
export const OPENAI_CODEX_WHAM_API_BASE = 'https://chatgpt.com/backend-api/wham'

export const OPENAI_CODEX_AUTH_CLAIMS_NAMESPACE = 'https://api.openai.com/auth'

/** Refresh this many ms before expiresAt */
export const OPENAI_CODEX_TOKEN_EXPIRY_SKEW_MS = 60_000

export type OpenAICodexOAuthTokens = {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  tokenType?: string
  scope?: string
  obtainedAt?: number
  accountId?: string
  planType?: string
  idToken?: string
}

export type OpenAICodexDeviceCodeResponse = {
  /** OpenAI field name is device_auth_id (not RFC device_code) */
  device_auth_id: string
  /** @deprecated alias of device_auth_id for callers that still use device_code */
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete?: string
  expires_in: number
  interval?: number
}

export type OpenAICodexTokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
  id_token?: string
}

export class OpenAICodexOAuthError extends Error {
  readonly code: string
  readonly status?: number

  constructor(message: string, code: string, status?: number) {
    super(message)
    this.name = 'OpenAICodexOAuthError'
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
export function humanizeOpenAICodexOAuthNetworkError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  if (
    message === 'Load failed' ||
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('CORS')
  ) {
    return 'Could not reach auth.openai.com (network/CORS). Use the desktop app build, check your connection, then try again.'
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
    // OpenAI style: { error: { message, type, code } }
    if (o.error && typeof o.error === 'object') {
      const err = o.error as Record<string, unknown>
      if (typeof err.message === 'string' && err.message.trim()) return err.message
      if (typeof err.code === 'string') return err.code
    }
    if (typeof o.message === 'string') return o.message
    if (typeof o.detail === 'string') return o.detail
  }
  return fallback
}

function parseIntervalSeconds(value: unknown, fallback = 5): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
  if (typeof value === 'string') {
    const n = Number(value)
    if (Number.isFinite(n) && n > 0) return n
  }
  return fallback
}

function parseExpiresInSeconds(data: Record<string, unknown>, now: number): number {
  if (typeof data.expires_in === 'number' && data.expires_in > 0) return data.expires_in
  if (typeof data.expires_at === 'string') {
    const t = Date.parse(data.expires_at)
    if (!Number.isNaN(t)) {
      return Math.max(60, Math.floor((t - now) / 1000))
    }
  }
  return 1800
}

function base64UrlDecode(segment: string): string {
  const padded = segment + '='.repeat((4 - (segment.length % 4)) % 4)
  const b64 = padded.replace(/-/g, '+').replace(/_/g, '/')
  if (typeof atob === 'function') {
    return atob(b64)
  }
  // Node / vitest
  return Buffer.from(b64, 'base64').toString('utf8')
}

/** Decode JWT payload without signature verification (claim extraction only). */
export function decodeJwtClaims(token: string): Record<string, unknown> {
  if (!token || token.split('.').length < 2) return {}
  try {
    const payload = token.split('.')[1]
    return JSON.parse(base64UrlDecode(payload)) as Record<string, unknown>
  } catch {
    return {}
  }
}

export function extractChatGPTClaims(idOrAccessToken?: string | null): {
  accountId?: string
  planType?: string
  userId?: string
} {
  if (!idOrAccessToken) return {}
  const claims = decodeJwtClaims(idOrAccessToken)
  const auth = claims[OPENAI_CODEX_AUTH_CLAIMS_NAMESPACE]
  if (auth && typeof auth === 'object') {
    const a = auth as Record<string, unknown>
    return {
      accountId: typeof a.chatgpt_account_id === 'string' ? a.chatgpt_account_id : undefined,
      planType: typeof a.chatgpt_plan_type === 'string' ? a.chatgpt_plan_type : undefined,
      userId: typeof a.chatgpt_user_id === 'string' ? a.chatgpt_user_id : undefined,
    }
  }
  if (typeof claims.chatgpt_account_id === 'string') {
    return {
      accountId: claims.chatgpt_account_id,
      planType: typeof claims.chatgpt_plan_type === 'string' ? claims.chatgpt_plan_type : undefined,
    }
  }
  return {}
}

export function isOpenAICodexTokenExpired(
  tokens: Pick<OpenAICodexOAuthTokens, 'expiresAt'> | undefined | null,
  now = Date.now()
): boolean {
  if (!tokens?.expiresAt) return false
  return tokens.expiresAt - OPENAI_CODEX_TOKEN_EXPIRY_SKEW_MS <= now
}

export function tokensFromOpenAICodexTokenResponse(
  data: OpenAICodexTokenResponse,
  now = Date.now(),
  previous?: Pick<OpenAICodexOAuthTokens, 'accountId' | 'planType' | 'refreshToken'>
): OpenAICodexOAuthTokens {
  const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600
  const idToken = data.id_token
  const fromId = extractChatGPTClaims(idToken)
  const fromAccess = extractChatGPTClaims(data.access_token)
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || previous?.refreshToken,
    tokenType: data.token_type || 'Bearer',
    scope: data.scope,
    obtainedAt: now,
    expiresAt: now + expiresIn * 1000,
    idToken,
    accountId: fromId.accountId || fromAccess.accountId || previous?.accountId,
    planType: fromId.planType || fromAccess.planType || previous?.planType,
  }
}

/**
 * Start device-code authorization (ChatGPT subscription).
 *
 * Matches Codex CLI (`device_code_auth.rs`):
 * - JSON body with `client_id` only (server owns PKCE)
 * - Response: `device_auth_id`, `user_code`, `interval`
 * - After approval, token poll returns `authorization_code` + `code_verifier`
 */
export async function startOpenAICodexDeviceAuth(
  options: {
    clientId?: string
    fetchImpl?: FetchLike
    now?: number
  } = {}
): Promise<OpenAICodexDeviceCodeResponse> {
  const fetchImpl = resolveFetch(options.fetchImpl)
  const clientId = options.clientId || OPENAI_CODEX_OAUTH_CLIENT_ID
  const now = options.now ?? Date.now()

  let res: Response
  try {
    // Official Codex CLI only sends client_id — PKCE is issued by the server on success
    res = await fetchImpl(OPENAI_CODEX_DEVICE_CODE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
      }),
    })
  } catch (err) {
    throw new OpenAICodexOAuthError(humanizeOpenAICodexOAuthNetworkError(err), 'network_error')
  }

  const text = await res.text()
  const json = parseJsonSafe(text)

  if (!res.ok) {
    throw new OpenAICodexOAuthError(
      tokenErrorMessage(json, `Device code request failed (${res.status})`),
      'device_code_failed',
      res.status
    )
  }

  const data = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>
  const deviceAuthId =
    typeof data.device_auth_id === 'string'
      ? data.device_auth_id
      : typeof data.device_code === 'string'
        ? data.device_code
        : undefined
  const userCode =
    typeof data.user_code === 'string'
      ? data.user_code
      : typeof data.usercode === 'string'
        ? data.usercode
        : undefined

  if (!deviceAuthId || !userCode) {
    throw new OpenAICodexOAuthError('Invalid device code response from OpenAI', 'invalid_device_response', res.status)
  }

  const verificationUri =
    (typeof data.verification_uri === 'string' && data.verification_uri) ||
    (typeof data.verification_uri_complete === 'string' && data.verification_uri_complete) ||
    OPENAI_CODEX_DEVICE_VERIFICATION_URI

  return {
    device_auth_id: deviceAuthId,
    device_code: deviceAuthId,
    user_code: userCode,
    verification_uri: verificationUri,
    verification_uri_complete:
      typeof data.verification_uri_complete === 'string' ? data.verification_uri_complete : undefined,
    // Official flow uses fixed 15 min window; response may only include interval
    expires_in: parseExpiresInSeconds(data, now) || 15 * 60,
    interval: parseIntervalSeconds(data.interval, 5),
  }
}

export type OpenAICodexPollDeviceAuthResult =
  | { status: 'pending' }
  | { status: 'slow_down'; interval: number }
  | { status: 'success'; tokens: OpenAICodexOAuthTokens }
  | { status: 'expired' }
  | { status: 'denied' }
  | { status: 'error'; error: OpenAICodexOAuthError }

/**
 * Single poll: deviceauth/token (JSON) → authorization_code + server PKCE → oauth/token exchange.
 *
 * Codex CLI behavior:
 * - Body: { device_auth_id, user_code } only
 * - Pending: HTTP 403 or 404
 * - Success: { authorization_code, code_challenge, code_verifier } then exchange at /oauth/token
 */
export async function pollOpenAICodexDeviceAuthOnce(
  device: Pick<OpenAICodexDeviceCodeResponse, 'device_auth_id' | 'device_code' | 'user_code'>,
  options: {
    clientId?: string
    fetchImpl?: FetchLike
    now?: number
  } = {}
): Promise<OpenAICodexPollDeviceAuthResult> {
  const fetchImpl = resolveFetch(options.fetchImpl)
  const clientId = options.clientId || OPENAI_CODEX_OAUTH_CLIENT_ID
  const now = options.now ?? Date.now()
  const deviceAuthId = device.device_auth_id || device.device_code

  let res: Response
  try {
    res = await fetchImpl(OPENAI_CODEX_DEVICE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      // Official Codex CLI does not send client_id on poll
      body: JSON.stringify({
        device_auth_id: deviceAuthId,
        user_code: device.user_code,
      }),
    })
  } catch (err) {
    return {
      status: 'error',
      error: new OpenAICodexOAuthError(humanizeOpenAICodexOAuthNetworkError(err), 'network_error'),
    }
  }

  const text = await res.text()
  const json = parseJsonSafe(text) as Record<string, unknown> | undefined
  const msg = tokenErrorMessage(json, '')

  // Codex CLI treats 403 / 404 as "keep waiting"
  if (res.status === 403 || res.status === 404) {
    return { status: 'pending' }
  }

  const errCode =
    typeof json?.error === 'string'
      ? json.error
      : json?.error && typeof json.error === 'object' && typeof (json.error as { code?: unknown }).code === 'string'
        ? (json.error as { code: string }).code
        : typeof json?.status === 'string'
          ? json.status
          : ''

  const looksPending =
    errCode === 'authorization_pending' ||
    errCode === 'pending' ||
    /pending|not.?approved|waiting for|authorization is pending/i.test(msg)

  if (looksPending) {
    return { status: 'pending' }
  }
  if (errCode === 'slow_down' || /slow.?down/i.test(msg)) {
    return { status: 'slow_down', interval: 5 }
  }
  if (errCode === 'expired_token' || errCode === 'expired' || /expired/i.test(msg)) {
    return { status: 'expired' }
  }
  if (errCode === 'access_denied' || errCode === 'denied' || /access.?denied|denied/i.test(msg)) {
    return { status: 'denied' }
  }

  // Some OpenAI edge responses use 400 for "not ready yet"
  if (!res.ok && res.status === 400 && /pending|not ready|try again later/i.test(msg)) {
    return { status: 'pending' }
  }

  if (!res.ok) {
    return {
      status: 'error',
      error: new OpenAICodexOAuthError(
        `Device poll failed (${res.status}): ${msg || 'unknown error'}`,
        errCode || 'token_poll_failed',
        res.status
      ),
    }
  }

  // Direct tokens (some gateways) — rare but safe
  if (json && typeof json.access_token === 'string') {
    return {
      status: 'success',
      tokens: tokensFromOpenAICodexTokenResponse(json as unknown as OpenAICodexTokenResponse, now),
    }
  }

  const authorizationCode =
    typeof json?.authorization_code === 'string'
      ? json.authorization_code
      : typeof json?.code === 'string' && json.code.length > 20
        ? json.code
        : undefined

  // Server-issued PKCE verifier (required by Codex device flow)
  const codeVerifier = typeof json?.code_verifier === 'string' ? json.code_verifier : undefined

  if (!authorizationCode) {
    // 200 without code yet — keep waiting
    return { status: 'pending' }
  }

  if (!codeVerifier) {
    return {
      status: 'error',
      error: new OpenAICodexOAuthError(
        'Device auth succeeded but no code_verifier was returned. Please try again.',
        'missing_code_verifier'
      ),
    }
  }

  // Exchange authorization code for tokens (standard OAuth form body + server PKCE)
  // Match Codex CLI encoding: application/x-www-form-urlencoded with encoded values
  try {
    const exchangeBody =
      `grant_type=authorization_code` +
      `&code=${encodeURIComponent(authorizationCode)}` +
      `&redirect_uri=${encodeURIComponent(OPENAI_CODEX_DEVICE_REDIRECT_URI)}` +
      `&client_id=${encodeURIComponent(clientId)}` +
      `&code_verifier=${encodeURIComponent(codeVerifier)}`

    const tokenRes = await fetchImpl(OPENAI_CODEX_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: exchangeBody,
    })
    const tokenText = await tokenRes.text()
    const tokenJson = parseJsonSafe(tokenText) as Record<string, unknown> | undefined
    if (!tokenRes.ok || !tokenJson || typeof tokenJson.access_token !== 'string') {
      return {
        status: 'error',
        error: new OpenAICodexOAuthError(
          `Token exchange failed (${tokenRes.status}): ${tokenErrorMessage(tokenJson, tokenText.slice(0, 180) || 'unknown error')}`,
          'token_exchange_failed',
          tokenRes.status
        ),
      }
    }
    return {
      status: 'success',
      tokens: tokensFromOpenAICodexTokenResponse(tokenJson as unknown as OpenAICodexTokenResponse, now),
    }
  } catch (exchangeErr) {
    return {
      status: 'error',
      error: new OpenAICodexOAuthError(
        `Token exchange network error: ${humanizeOpenAICodexOAuthNetworkError(exchangeErr)}`,
        'network_error'
      ),
    }
  }
}

/**
 * Load ChatGPT/Codex OAuth tokens from a local Codex CLI auth.json (e.g. ~/.codex/auth.json).
 * Useful when device-code exchange fails but `codex login` already works on this machine.
 */
export function tokensFromCodexAuthJson(raw: unknown, now = Date.now()): OpenAICodexOAuthTokens {
  if (!raw || typeof raw !== 'object') {
    throw new OpenAICodexOAuthError('Invalid Codex auth.json', 'invalid_auth_json')
  }
  const root = raw as Record<string, unknown>
  const tokensNode =
    root.tokens && typeof root.tokens === 'object' ? (root.tokens as Record<string, unknown>) : root

  const accessToken =
    (typeof tokensNode.access_token === 'string' && tokensNode.access_token) ||
    (typeof tokensNode.access === 'string' && tokensNode.access) ||
    (typeof root.access_token === 'string' && root.access_token) ||
    ''
  const refreshToken =
    (typeof tokensNode.refresh_token === 'string' && tokensNode.refresh_token) ||
    (typeof tokensNode.refresh === 'string' && tokensNode.refresh) ||
    (typeof root.refresh_token === 'string' && root.refresh_token) ||
    undefined
  const idToken =
    (typeof tokensNode.id_token === 'string' && tokensNode.id_token) ||
    (typeof root.id_token === 'string' && root.id_token) ||
    undefined

  if (!accessToken) {
    throw new OpenAICodexOAuthError(
      'Codex auth.json has no access token. Run `codex login` first.',
      'invalid_auth_json'
    )
  }

  const claims = extractChatGPTClaims(idToken || accessToken)
  const accountId =
    (typeof tokensNode.account_id === 'string' && tokensNode.account_id) ||
    claims.accountId

  // Codex auth.json often lacks expires_in — refresh proactively soon
  let expiresAt = now + 50 * 60 * 1000
  if (typeof root.expires === 'number') {
    // some samples store ms epoch
    expiresAt = root.expires > 1e12 ? root.expires : root.expires * 1000
  } else if (typeof tokensNode.expires === 'number') {
    expiresAt = tokensNode.expires > 1e12 ? tokensNode.expires : tokensNode.expires * 1000
  }

  return {
    accessToken,
    refreshToken,
    idToken,
    accountId,
    planType: claims.planType,
    tokenType: 'Bearer',
    obtainedAt: now,
    expiresAt,
  }
}

/**
 * Poll until success, expiry, denial, or abort.
 */
export async function pollOpenAICodexDeviceAuth(
  device: OpenAICodexDeviceCodeResponse,
  options: {
    clientId?: string
    fetchImpl?: FetchLike
    signal?: AbortSignal
    sleep?: (ms: number) => Promise<void>
    now?: () => number
  } = {}
): Promise<OpenAICodexOAuthTokens> {
  const sleep = options.sleep || ((ms: number) => new Promise((r) => setTimeout(r, ms)))
  const nowFn = options.now || (() => Date.now())
  const deadline = nowFn() + device.expires_in * 1000
  let intervalMs = Math.max(1, device.interval ?? 5) * 1000

  while (nowFn() < deadline) {
    if (options.signal?.aborted) {
      throw new OpenAICodexOAuthError('Authorization cancelled', 'cancelled')
    }

    const result = await pollOpenAICodexDeviceAuthOnce(device, {
      clientId: options.clientId,
      fetchImpl: options.fetchImpl,
      now: nowFn(),
    })

    if (result.status === 'success') {
      return result.tokens
    }
    if (result.status === 'slow_down') {
      intervalMs = Math.max(intervalMs, result.interval * 1000) + 5000
    } else if (result.status === 'expired') {
      throw new OpenAICodexOAuthError('Authorization timed out. Please try again.', 'expired_token')
    } else if (result.status === 'denied') {
      throw new OpenAICodexOAuthError('Access denied in browser. Please try again.', 'access_denied')
    } else if (result.status === 'error') {
      throw result.error
    }

    await sleep(intervalMs)
  }

  throw new OpenAICodexOAuthError('Authorization timed out. Please try again.', 'expired_token')
}

export async function refreshOpenAICodexAccessToken(
  refreshToken: string,
  options: {
    clientId?: string
    fetchImpl?: FetchLike
    now?: number
    previous?: Pick<OpenAICodexOAuthTokens, 'accountId' | 'planType'>
  } = {}
): Promise<OpenAICodexOAuthTokens> {
  const fetchImpl = resolveFetch(options.fetchImpl)
  const clientId = options.clientId || OPENAI_CODEX_OAUTH_CLIENT_ID
  const now = options.now ?? Date.now()

  let res: Response
  try {
    res = await fetchImpl(OPENAI_CODEX_TOKEN_URL, {
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
    throw new OpenAICodexOAuthError(humanizeOpenAICodexOAuthNetworkError(err), 'network_error')
  }

  const text = await res.text()
  const json = parseJsonSafe(text) as Record<string, unknown> | undefined

  if (!res.ok || !json || typeof json.access_token !== 'string') {
    const code = typeof json?.error === 'string' ? json.error : 'refresh_failed'
    throw new OpenAICodexOAuthError(tokenErrorMessage(json, `Token refresh failed (${res.status})`), code, res.status)
  }

  const tokens = tokensFromOpenAICodexTokenResponse(json as unknown as OpenAICodexTokenResponse, now, {
    refreshToken,
    accountId: options.previous?.accountId,
    planType: options.previous?.planType,
  })
  if (!tokens.refreshToken) {
    tokens.refreshToken = refreshToken
  }
  return tokens
}

/**
 * Return a usable access token, refreshing when near expiry.
 * Does not persist — caller should apply returned tokens to settings.
 */
export async function ensureFreshOpenAICodexAccessToken(
  tokens: OpenAICodexOAuthTokens | undefined | null,
  options: {
    clientId?: string
    fetchImpl?: FetchLike
    now?: number
  } = {}
): Promise<{ accessToken: string; tokens: OpenAICodexOAuthTokens; refreshed: boolean }> {
  if (!tokens?.accessToken) {
    throw new OpenAICodexOAuthError(
      'Not signed in to ChatGPT. Sign in with your ChatGPT subscription.',
      'not_signed_in'
    )
  }

  const now = options.now ?? Date.now()
  if (!isOpenAICodexTokenExpired(tokens, now)) {
    return { accessToken: tokens.accessToken, tokens, refreshed: false }
  }

  if (!tokens.refreshToken) {
    throw new OpenAICodexOAuthError(
      'Session expired. Sign in again with your ChatGPT subscription.',
      'session_expired'
    )
  }

  try {
    const next = await refreshOpenAICodexAccessToken(tokens.refreshToken, {
      clientId: options.clientId,
      fetchImpl: options.fetchImpl,
      now,
      previous: { accountId: tokens.accountId, planType: tokens.planType },
    })
    return { accessToken: next.accessToken, tokens: next, refreshed: true }
  } catch (err) {
    if (
      err instanceof OpenAICodexOAuthError &&
      (err.code === 'invalid_grant' || err.status === 400 || err.status === 401)
    ) {
      throw new OpenAICodexOAuthError(
        'Session revoked or expired. Sign in again with your ChatGPT subscription.',
        'invalid_grant',
        err.status
      )
    }
    throw err
  }
}
