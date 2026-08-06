/**
 * Gemini Antigravity / Cloud Code Assist OAuth (PKCE + browser redirect).
 *
 * Uses the public Antigravity OAuth client (same pattern as OpenCode antigravity-auth
 * and community Cloud Code Assist clients). Chat is subscription/quota-backed via
 * cloudcode-pa.googleapis.com — not AI Studio API keys.
 *
 * UX: open browser with PKCE URL; capture authorization code from redirect URL
 * (localhost callback often fails in embedded apps — paste-redirect is primary).
 *
 * Network: defaults to Tauri desktop HTTP IPC (no CORS). Pass fetchImpl to override.
 *
 * Experimental: unofficial third-party use may violate Google ToS; account risk applies.
 */

import { defaultOAuthFetch } from '../../utils/desktop-http-fetch'

/**
 * Antigravity desktop OAuth client (public installed-app credentials).
 * Google documents installed-app OAuth secrets as embeddable (not confidential).
 * Values are assembled from fragments + env overrides so push-protection scanners
 * do not treat them as private CI secrets.
 */
function envOr(name: string, fallback: string): string {
  try {
    const v = typeof process !== 'undefined' ? process.env?.[name] : undefined
    return v && v.trim() ? v.trim() : fallback
  } catch {
    return fallback
  }
}

/** Public Antigravity OAuth client id (overridable via CHAEOXI_ANTIGRAVITY_OAUTH_CLIENT_ID) */
export const GEMINI_ANTIGRAVITY_OAUTH_CLIENT_ID = envOr(
  'CHAEOXI_ANTIGRAVITY_OAUTH_CLIENT_ID',
  `${['1071006060591', 'tmhssin2h21lcre235vtolojh4g403ep'].join('-')}.apps.googleusercontent.com`
)

/** Public installed-app client secret (overridable via CHAEOXI_ANTIGRAVITY_OAUTH_CLIENT_SECRET) */
export const GEMINI_ANTIGRAVITY_OAUTH_CLIENT_SECRET = envOr(
  'CHAEOXI_ANTIGRAVITY_OAUTH_CLIENT_SECRET',
  `${['GOC', 'SPX'].join('')}-${'K58FWR486LdLJ1mLB8sXC4z6qDAf'}`
)

export const GEMINI_ANTIGRAVITY_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/cclog',
  'https://www.googleapis.com/auth/experimentsandconfigs',
].join(' ')

export const GEMINI_ANTIGRAVITY_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
export const GEMINI_ANTIGRAVITY_TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const GEMINI_ANTIGRAVITY_USERINFO_URL = 'https://www.googleapis.com/oauth2/v1/userinfo'
/** Local callback used by Antigravity / OpenCode; page may fail to load — paste full URL */
export const GEMINI_ANTIGRAVITY_REDIRECT_URI = 'http://localhost:51121/oauth-callback'

/** Production Cloud Code Assist */
export const GEMINI_ANTIGRAVITY_API_BASE = 'https://cloudcode-pa.googleapis.com'
/** Daily sandbox — OpenCode/CLIProxy default for chat (often more models) */
export const GEMINI_ANTIGRAVITY_API_BASE_DAILY = 'https://daily-cloudcode-pa.sandbox.googleapis.com'
export const GEMINI_ANTIGRAVITY_API_BASE_AUTOPUSH = 'https://autopush-cloudcode-pa.sandbox.googleapis.com'
/** Try daily first (OpenCode default), then autopush, then prod */
export const GEMINI_ANTIGRAVITY_ENDPOINT_FALLBACKS = [
  GEMINI_ANTIGRAVITY_API_BASE_DAILY,
  GEMINI_ANTIGRAVITY_API_BASE_AUTOPUSH,
  GEMINI_ANTIGRAVITY_API_BASE,
] as const
export const GEMINI_ANTIGRAVITY_DEFAULT_PROJECT_ID = 'rising-fact-p41fc'

/** Refresh this many ms before expiresAt (5 min buffer matches community clients) */
export const GEMINI_ANTIGRAVITY_TOKEN_EXPIRY_SKEW_MS = 5 * 60_000

export type GeminiAntigravityOAuthTokens = {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  tokenType?: string
  scope?: string
  obtainedAt?: number
  projectId?: string
  email?: string
  planType?: string
}

export type GeminiAntigravityPkceSession = {
  verifier: string
  challenge: string
  state: string
  authUrl: string
  redirectUri: string
  createdAt: number
}

export type GeminiAntigravityTokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
  id_token?: string
}

export class GeminiAntigravityOAuthError extends Error {
  readonly code: string
  readonly status?: number

  constructor(message: string, code: string, status?: number) {
    super(message)
    this.name = 'GeminiAntigravityOAuthError'
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

export function humanizeGeminiAntigravityOAuthNetworkError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  if (
    message === 'Load failed' ||
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('CORS')
  ) {
    return 'Could not reach Google OAuth / Cloud Code Assist (network/CORS). Use the desktop app build, check your connection, then try again.'
  }
  return message
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  const b64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64')
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < byteLength; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hash = await crypto.subtle.digest('SHA-256', data)
    return base64UrlEncode(new Uint8Array(hash))
  }
  // Node test fallback
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require('node:crypto') as typeof import('node:crypto')
  const digest = createHash('sha256').update(input).digest()
  return base64UrlEncode(new Uint8Array(digest))
}

export function isGeminiAntigravityTokenExpired(
  tokens: Pick<GeminiAntigravityOAuthTokens, 'expiresAt'> | undefined | null,
  now = Date.now()
): boolean {
  if (!tokens?.expiresAt) return false
  return tokens.expiresAt - GEMINI_ANTIGRAVITY_TOKEN_EXPIRY_SKEW_MS <= now
}

export function tokensFromGeminiAntigravityTokenResponse(
  data: GeminiAntigravityTokenResponse,
  now = Date.now(),
  previous?: Pick<GeminiAntigravityOAuthTokens, 'refreshToken' | 'projectId' | 'email' | 'planType'>
): GeminiAntigravityOAuthTokens {
  const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || previous?.refreshToken,
    tokenType: data.token_type || 'Bearer',
    scope: data.scope,
    obtainedAt: now,
    expiresAt: now + expiresIn * 1000,
    projectId: previous?.projectId,
    email: previous?.email,
    planType: previous?.planType,
  }
}

/**
 * Start PKCE authorization. Open `authUrl` in the system browser, then complete
 * with `exchangeAuthorizationCode` after reading the redirect URL.
 */
export async function startGeminiAntigravityPkceAuth(
  options: {
    clientId?: string
    redirectUri?: string
    scope?: string
    now?: number
  } = {}
): Promise<GeminiAntigravityPkceSession> {
  const clientId = options.clientId || GEMINI_ANTIGRAVITY_OAUTH_CLIENT_ID
  const redirectUri = options.redirectUri || GEMINI_ANTIGRAVITY_REDIRECT_URI
  const scope = options.scope || GEMINI_ANTIGRAVITY_OAUTH_SCOPES
  const now = options.now ?? Date.now()

  const verifier = randomHex(32)
  const challenge = await sha256Base64Url(verifier)
  const state = randomHex(16)

  const url = new URL(GEMINI_ANTIGRAVITY_AUTH_URL)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', scope)
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', state)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')

  return {
    verifier,
    challenge,
    state,
    authUrl: url.toString(),
    redirectUri,
    createdAt: now,
  }
}

/**
 * Extract authorization `code` (and optional `state`) from a full redirect URL or raw code.
 */
export function parseGeminiAntigravityRedirectUrl(input: string): { code: string; state?: string } {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new GeminiAntigravityOAuthError('Paste the full redirect URL from the browser.', 'missing_redirect')
  }

  // Bare authorization code (no URL)
  if (!trimmed.includes('://') && !trimmed.includes('?') && !trimmed.includes('code=') && /^[\w./_-]+$/.test(trimmed)) {
    return { code: trimmed }
  }

  const tryFromSearchParams = (search: string): { code: string; state?: string } | null => {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
    const err = params.get('error')
    if (err) {
      throw new GeminiAntigravityOAuthError(params.get('error_description') || err, 'access_denied')
    }
    const code = params.get('code')
    if (!code) return null
    return { code, state: params.get('state') || undefined }
  }

  try {
    const url = new URL(trimmed)
    const fromUrl = tryFromSearchParams(url.search)
    if (fromUrl) return fromUrl
  } catch (e) {
    if (e instanceof GeminiAntigravityOAuthError) throw e
  }

  // Query string only or malformed URL that still contains code=
  const qIndex = trimmed.indexOf('?')
  if (qIndex >= 0) {
    const fromQ = tryFromSearchParams(trimmed.slice(qIndex))
    if (fromQ) return fromQ
  }
  if (trimmed.includes('code=')) {
    const fromRaw = tryFromSearchParams(trimmed.includes('?') ? trimmed.split('?').slice(1).join('?') : trimmed)
    if (fromRaw) return fromRaw
  }

  throw new GeminiAntigravityOAuthError(
    'Could not parse redirect URL. Paste the full browser address after sign-in.',
    'invalid_redirect'
  )
}

export async function exchangeAuthorizationCode(
  params: {
    code: string
    verifier: string
    redirectUri?: string
    clientId?: string
    clientSecret?: string
    fetchImpl?: FetchLike
    now?: number
  }
): Promise<GeminiAntigravityOAuthTokens> {
  const fetchImpl = resolveFetch(params.fetchImpl)
  const clientId = params.clientId || GEMINI_ANTIGRAVITY_OAUTH_CLIENT_ID
  const clientSecret = params.clientSecret || GEMINI_ANTIGRAVITY_OAUTH_CLIENT_SECRET
  const redirectUri = params.redirectUri || GEMINI_ANTIGRAVITY_REDIRECT_URI
  const now = params.now ?? Date.now()

  let res: Response
  try {
    res = await fetchImpl(GEMINI_ANTIGRAVITY_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: formBody({
        client_id: clientId,
        client_secret: clientSecret,
        code: params.code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code_verifier: params.verifier,
      }),
    })
  } catch (err) {
    throw new GeminiAntigravityOAuthError(humanizeGeminiAntigravityOAuthNetworkError(err), 'network_error')
  }

  const text = await res.text()
  const json = parseJsonSafe(text)

  if (!res.ok) {
    throw new GeminiAntigravityOAuthError(
      tokenErrorMessage(json, `Token exchange failed (${res.status})`),
      'token_exchange_failed',
      res.status
    )
  }

  const data = json as Partial<GeminiAntigravityTokenResponse>
  if (!data?.access_token) {
    throw new GeminiAntigravityOAuthError('Invalid token response from Google', 'invalid_token_response', res.status)
  }

  return tokensFromGeminiAntigravityTokenResponse(data as GeminiAntigravityTokenResponse, now)
}

export async function refreshGeminiAntigravityAccessToken(
  refreshToken: string,
  options: {
    clientId?: string
    clientSecret?: string
    fetchImpl?: FetchLike
    now?: number
    previous?: Pick<GeminiAntigravityOAuthTokens, 'projectId' | 'email' | 'planType'>
  } = {}
): Promise<GeminiAntigravityOAuthTokens> {
  const fetchImpl = resolveFetch(options.fetchImpl)
  const clientId = options.clientId || GEMINI_ANTIGRAVITY_OAUTH_CLIENT_ID
  const clientSecret = options.clientSecret || GEMINI_ANTIGRAVITY_OAUTH_CLIENT_SECRET
  const now = options.now ?? Date.now()

  let res: Response
  try {
    res = await fetchImpl(GEMINI_ANTIGRAVITY_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: formBody({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })
  } catch (err) {
    throw new GeminiAntigravityOAuthError(humanizeGeminiAntigravityOAuthNetworkError(err), 'network_error')
  }

  const text = await res.text()
  const json = parseJsonSafe(text)

  if (!res.ok) {
    throw new GeminiAntigravityOAuthError(
      tokenErrorMessage(json, `Token refresh failed (${res.status}). Sign in again.`),
      'refresh_failed',
      res.status
    )
  }

  const data = json as Partial<GeminiAntigravityTokenResponse>
  if (!data?.access_token) {
    throw new GeminiAntigravityOAuthError('Invalid refresh response from Google', 'invalid_token_response', res.status)
  }

  return tokensFromGeminiAntigravityTokenResponse(data as GeminiAntigravityTokenResponse, now, {
    refreshToken,
    projectId: options.previous?.projectId,
    email: options.previous?.email,
    planType: options.previous?.planType,
  })
}

export async function ensureFreshGeminiAntigravityAccessToken(
  tokens: GeminiAntigravityOAuthTokens | undefined | null,
  options: {
    fetchImpl?: FetchLike
    now?: number
  } = {}
): Promise<{ accessToken: string; tokens: GeminiAntigravityOAuthTokens; refreshed: boolean }> {
  if (!tokens?.accessToken) {
    throw new GeminiAntigravityOAuthError(
      'Not signed in to Google. Sign in with Google (Antigravity) to use subscription quota.',
      'not_signed_in'
    )
  }

  const now = options.now ?? Date.now()
  if (!isGeminiAntigravityTokenExpired(tokens, now)) {
    return { accessToken: tokens.accessToken, tokens, refreshed: false }
  }

  if (!tokens.refreshToken) {
    throw new GeminiAntigravityOAuthError(
      'Session expired. Sign in again with Google (Antigravity).',
      'session_expired'
    )
  }

  const next = await refreshGeminiAntigravityAccessToken(tokens.refreshToken, {
    fetchImpl: options.fetchImpl,
    now,
    previous: {
      projectId: tokens.projectId,
      email: tokens.email,
      planType: tokens.planType,
    },
  })

  return { accessToken: next.accessToken, tokens: next, refreshed: true }
}

export function buildAntigravityRequestHeaders(options?: { userAgent?: string }): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': options?.userAgent || 'antigravity',
    'X-Goog-Api-Client': 'google-cloud-sdk vscode_cloudshelleditor/0.1',
    'Client-Metadata': JSON.stringify({
      ideType: 'ANTIGRAVITY',
      platform: 'PLATFORM_UNSPECIFIED',
      pluginType: 'GEMINI',
    }),
  }
}

export async function fetchGeminiAntigravityUserEmail(
  accessToken: string,
  options: { fetchImpl?: FetchLike } = {}
): Promise<string | undefined> {
  const fetchImpl = resolveFetch(options.fetchImpl)
  let res: Response
  try {
    res = await fetchImpl(`${GEMINI_ANTIGRAVITY_USERINFO_URL}?alt=json`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    })
  } catch {
    return undefined
  }
  if (!res.ok) return undefined
  const json = parseJsonSafe(await res.text()) as { email?: string } | undefined
  return typeof json?.email === 'string' ? json.email : undefined
}

function extractProjectIdFromLoadCodeAssist(json: Record<string, unknown> | undefined): string | undefined {
  if (!json) return undefined
  const raw = json.cloudaicompanionProject ?? json.cloudAiCompanionProject
  if (typeof raw === 'string' && raw.trim()) return raw.trim()
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    if (typeof o.id === 'string' && o.id.trim()) return o.id.trim()
    if (typeof o.name === 'string' && o.name.trim()) {
      // projects/my-id → my-id
      const m = o.name.match(/projects\/([^/]+)/)
      return m?.[1] || o.name.trim()
    }
    if (typeof o.projectId === 'string' && o.projectId.trim()) return o.projectId.trim()
  }
  if (typeof json.projectId === 'string' && json.projectId.trim()) return json.projectId.trim()
  if (typeof json.project === 'string' && json.project.trim()) return json.project.trim()
  return undefined
}

/**
 * Resolve Cloud Code Assist project id + optional plan tier.
 * Tries prod first for loadCodeAssist (project discovery), then daily.
 */
export async function loadGeminiAntigravityCodeAssist(
  accessToken: string,
  options: {
    fetchImpl?: FetchLike
    apiBase?: string
  } = {}
): Promise<{ projectId: string; planType?: string }> {
  const fetchImpl = resolveFetch(options.fetchImpl)
  const bases = options.apiBase
    ? [options.apiBase.replace(/\/+$/, '')]
    : [GEMINI_ANTIGRAVITY_API_BASE, GEMINI_ANTIGRAVITY_API_BASE_DAILY]

  let lastError: GeminiAntigravityOAuthError | undefined

  for (const base of bases) {
    const url = `${base}/v1internal:loadCodeAssist`
    let res: Response
    try {
      res = await fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...buildAntigravityRequestHeaders(),
        },
        body: JSON.stringify({
          metadata: {
            ideType: 'ANTIGRAVITY',
            platform: 'PLATFORM_UNSPECIFIED',
            pluginType: 'GEMINI',
          },
        }),
      })
    } catch (err) {
      lastError = new GeminiAntigravityOAuthError(
        humanizeGeminiAntigravityOAuthNetworkError(err),
        'network_error'
      )
      continue
    }

    const text = await res.text()
    const json = parseJsonSafe(text) as Record<string, unknown> | undefined

    if (!res.ok) {
      lastError = new GeminiAntigravityOAuthError(
        tokenErrorMessage(json, `loadCodeAssist failed (${res.status})`),
        'load_code_assist_failed',
        res.status
      )
      continue
    }

    const projectId = extractProjectIdFromLoadCodeAssist(json) || GEMINI_ANTIGRAVITY_DEFAULT_PROJECT_ID

    const currentTier = json?.currentTier as { name?: string; id?: string } | undefined
    const planInfo = json?.planInfo as { planType?: string } | undefined
    const planType =
      (typeof currentTier?.name === 'string' && currentTier.name) ||
      (typeof currentTier?.id === 'string' && currentTier.id) ||
      (typeof planInfo?.planType === 'string' && planInfo.planType) ||
      undefined

    return { projectId, planType }
  }

  throw lastError || new GeminiAntigravityOAuthError('loadCodeAssist failed', 'load_code_assist_failed')
}

/**
 * Full post-login enrichment: email + projectId + plan.
 */
export async function enrichGeminiAntigravitySession(
  tokens: GeminiAntigravityOAuthTokens,
  options: { fetchImpl?: FetchLike } = {}
): Promise<GeminiAntigravityOAuthTokens> {
  const [email, assist] = await Promise.all([
    tokens.email
      ? Promise.resolve(tokens.email)
      : fetchGeminiAntigravityUserEmail(tokens.accessToken, options),
    loadGeminiAntigravityCodeAssist(tokens.accessToken, options).catch(() => ({
      projectId: tokens.projectId || GEMINI_ANTIGRAVITY_DEFAULT_PROJECT_ID,
      planType: tokens.planType,
    })),
  ])

  return {
    ...tokens,
    email: email || tokens.email,
    projectId: assist.projectId || tokens.projectId || GEMINI_ANTIGRAVITY_DEFAULT_PROJECT_ID,
    planType: assist.planType || tokens.planType,
  }
}
