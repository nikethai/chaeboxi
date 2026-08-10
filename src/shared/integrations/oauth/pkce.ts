/**
 * Generic OAuth PKCE helpers for integration connectors (desktop-first).
 * No hosted broker — client id may come from connector default or user override.
 */

export type PkceSession = {
  verifier: string
  challenge: string
  state: string
  authUrl: string
  redirectUri: string
  createdAt: number
  connectorId: string
  clientId: string
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  const b64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64')
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomBytes(byteLength: number): Uint8Array {
  const bytes = new Uint8Array(byteLength)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < byteLength; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return bytes
}

export function randomUrlSafe(byteLength = 32): string {
  return base64UrlEncode(randomBytes(byteLength))
}

async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hash = await crypto.subtle.digest('SHA-256', data)
    return base64UrlEncode(new Uint8Array(hash))
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require('node:crypto') as typeof import('node:crypto')
  const digest = createHash('sha256').update(input).digest()
  return base64UrlEncode(new Uint8Array(digest))
}

export type BuildAuthUrlInput = {
  connectorId: string
  authorizationUrl: string
  clientId: string
  redirectUri: string
  scopes: string[]
  usesPkce?: boolean
  extraAuthParams?: Record<string, string>
}

export async function createPkceAuthSession(input: BuildAuthUrlInput): Promise<PkceSession> {
  const verifier = randomUrlSafe(32)
  const challenge = input.usesPkce === false ? '' : await sha256Base64Url(verifier)
  const state = randomUrlSafe(16)
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    scope: input.scopes.join(' '),
    state,
    ...(input.usesPkce === false
      ? {}
      : {
          code_challenge: challenge,
          code_challenge_method: 'S256',
        }),
    ...(input.extraAuthParams || {}),
  })
  const authUrl = `${input.authorizationUrl}?${params.toString()}`
  return {
    verifier,
    challenge,
    state,
    authUrl,
    redirectUri: input.redirectUri,
    createdAt: Date.now(),
    connectorId: input.connectorId,
    clientId: input.clientId,
  }
}

/** Parse ?code=&state= from redirect URL or raw query. */
export function parseOAuthRedirect(input: string): { code?: string; state?: string; error?: string } {
  try {
    const url = input.includes('://') ? new URL(input) : new URL(input, 'http://localhost')
    return {
      code: url.searchParams.get('code') || undefined,
      state: url.searchParams.get('state') || undefined,
      error: url.searchParams.get('error') || url.searchParams.get('error_description') || undefined,
    }
  } catch {
    // bare code paste
    if (/^[A-Za-z0-9._~-]+$/.test(input.trim())) {
      return { code: input.trim() }
    }
    return { error: 'Invalid redirect URL' }
  }
}

export type TokenExchangeResult = {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  tokenType?: string
  scope?: string
  raw: Record<string, unknown>
}

export async function exchangeAuthorizationCode(options: {
  tokenUrl: string
  clientId: string
  clientSecret?: string
  code: string
  redirectUri: string
  codeVerifier?: string
  fetchImpl?: typeof fetch
}): Promise<TokenExchangeResult> {
  const fetchFn = options.fetchImpl || fetch
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: options.clientId,
    code: options.code,
    redirect_uri: options.redirectUri,
  })
  if (options.clientSecret) body.set('client_secret', options.clientSecret)
  if (options.codeVerifier) body.set('code_verifier', options.codeVerifier)

  const res = await fetchFn(options.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  })
  const text = await res.text()
  let json: Record<string, unknown> = {}
  try {
    json = JSON.parse(text) as Record<string, unknown>
  } catch {
    // GitHub may return form-encoded
    const form = new URLSearchParams(text)
    form.forEach((v, k) => {
      json[k] = v
    })
  }
  if (!res.ok || json.error) {
    const msg =
      (typeof json.error_description === 'string' && json.error_description) ||
      (typeof json.error === 'string' && json.error) ||
      `Token exchange failed (${res.status})`
    throw new Error(msg)
  }
  const accessToken = String(json.access_token || '')
  if (!accessToken) throw new Error('Token response missing access_token')
  const expiresIn = typeof json.expires_in === 'number' ? json.expires_in : Number(json.expires_in)
  return {
    accessToken,
    refreshToken: typeof json.refresh_token === 'string' ? json.refresh_token : undefined,
    expiresAt: Number.isFinite(expiresIn) && expiresIn > 0 ? Date.now() + expiresIn * 1000 : undefined,
    tokenType: typeof json.token_type === 'string' ? json.token_type : undefined,
    scope: typeof json.scope === 'string' ? json.scope : undefined,
    raw: json,
  }
}

export async function refreshAccessToken(options: {
  tokenUrl: string
  clientId: string
  clientSecret?: string
  refreshToken: string
  fetchImpl?: typeof fetch
}): Promise<TokenExchangeResult> {
  const fetchFn = options.fetchImpl || fetch
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: options.clientId,
    refresh_token: options.refreshToken,
  })
  if (options.clientSecret) body.set('client_secret', options.clientSecret)

  const res = await fetchFn(options.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  })
  const text = await res.text()
  let json: Record<string, unknown> = {}
  try {
    json = JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error(`Token refresh failed (${res.status})`)
  }
  if (!res.ok || json.error) {
    const msg =
      (typeof json.error_description === 'string' && json.error_description) ||
      (typeof json.error === 'string' && json.error) ||
      `Token refresh failed (${res.status})`
    throw new Error(msg)
  }
  const accessToken = String(json.access_token || '')
  if (!accessToken) throw new Error('Refresh response missing access_token')
  const expiresIn = typeof json.expires_in === 'number' ? json.expires_in : Number(json.expires_in)
  return {
    accessToken,
    refreshToken:
      typeof json.refresh_token === 'string' ? json.refresh_token : options.refreshToken,
    expiresAt: Number.isFinite(expiresIn) && expiresIn > 0 ? Date.now() + expiresIn * 1000 : undefined,
    tokenType: typeof json.token_type === 'string' ? json.token_type : undefined,
    scope: typeof json.scope === 'string' ? json.scope : undefined,
    raw: json,
  }
}
