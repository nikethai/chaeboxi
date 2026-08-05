import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ensureFreshOpenAICodexAccessToken,
  extractChatGPTClaims,
  isOpenAICodexTokenExpired,
  OpenAICodexOAuthError,
  OPENAI_CODEX_DEVICE_CODE_URL,
  OPENAI_CODEX_DEVICE_TOKEN_URL,
  OPENAI_CODEX_TOKEN_URL,
  pollOpenAICodexDeviceAuthOnce,
  startOpenAICodexDeviceAuth,
  tokensFromCodexAuthJson,
  tokensFromOpenAICodexTokenResponse,
} from './openai-codex-oauth'
import {
  ensureOpenAICodexBearer,
  resolveOpenAIAuthMode,
  resolveOpenAIBearer,
  settingsPatchFromOpenAICodexTokens,
  settingsPatchSignOutOpenAICodexOAuth,
} from './openai-codex-auth'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Minimal unsigned JWT for claim extraction tests */
function fakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${header}.${body}.sig`
}

describe('openai-codex-oauth', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tokensFromOpenAICodexTokenResponse sets expiresAt and claims', () => {
    const now = 1_700_000_000_000
    const idToken = fakeJwt({
      'https://api.openai.com/auth': {
        chatgpt_account_id: 'acct-1',
        chatgpt_plan_type: 'pro',
      },
    })
    const tokens = tokensFromOpenAICodexTokenResponse(
      {
        access_token: 'at',
        refresh_token: 'rt',
        expires_in: 3600,
        token_type: 'Bearer',
        id_token: idToken,
      },
      now
    )
    expect(tokens.accessToken).toBe('at')
    expect(tokens.refreshToken).toBe('rt')
    expect(tokens.expiresAt).toBe(now + 3600_000)
    expect(tokens.accountId).toBe('acct-1')
    expect(tokens.planType).toBe('pro')
  })

  it('isOpenAICodexTokenExpired respects skew window', () => {
    const now = 1_000_000
    expect(isOpenAICodexTokenExpired({ expiresAt: now + 120_000 }, now)).toBe(false)
    expect(isOpenAICodexTokenExpired({ expiresAt: now + 30_000 }, now)).toBe(true)
    expect(isOpenAICodexTokenExpired({}, now)).toBe(false)
  })

  it('extractChatGPTClaims reads namespaced auth claim', () => {
    const token = fakeJwt({
      'https://api.openai.com/auth': {
        chatgpt_account_id: 'a',
        chatgpt_plan_type: 'plus',
      },
    })
    expect(extractChatGPTClaims(token)).toEqual({
      accountId: 'a',
      planType: 'plus',
      userId: undefined,
    })
  })

  it('startOpenAICodexDeviceAuth sends client_id only and parses OpenAI deviceauth response', async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe(OPENAI_CODEX_DEVICE_CODE_URL)
      expect(new Headers(init?.headers).get('Content-Type')).toContain('application/json')
      const body = JSON.parse(String(init?.body))
      expect(body).toEqual({ client_id: expect.any(String) })
      expect(body.code_challenge).toBeUndefined()
      return jsonResponse({
        device_auth_id: 'deviceauth_abc',
        user_code: 'ABCD-EFGH',
        interval: '5',
        expires_at: new Date(Date.now() + 1800_000).toISOString(),
      })
    })

    const device = await startOpenAICodexDeviceAuth({ fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(device.user_code).toBe('ABCD-EFGH')
    expect(device.device_auth_id).toBe('deviceauth_abc')
    expect(device.device_code).toBe('deviceauth_abc')
    expect(device.verification_uri).toContain('auth.openai.com')
    expect(device.interval).toBe(5)
    expect(device.expires_in).toBeGreaterThan(60)
  })

  it('startOpenAICodexDeviceAuth rejects form-style 400 with readable message', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        {
          error: {
            message: "[{'type': 'model_attributes_type', 'loc': ('body',), 'msg': 'Input should be a valid dictionary'}]",
            type: 'invalid_request_error',
          },
        },
        400
      )
    )
    await expect(
      startOpenAICodexDeviceAuth({ fetchImpl: fetchImpl as unknown as typeof fetch })
    ).rejects.toMatchObject({
      code: 'device_code_failed',
      status: 400,
    })
  })

  it('pollOpenAICodexDeviceAuthOnce treats 403 as pending (Codex CLI)', async () => {
    const pending = await pollOpenAICodexDeviceAuthOnce(
      { device_auth_id: 'dc', device_code: 'dc', user_code: 'ABCD' },
      {
        fetchImpl: (async () => jsonResponse({ error: 'forbidden' }, 403)) as unknown as typeof fetch,
      }
    )
    expect(pending.status).toBe('pending')
  })

  it('pollOpenAICodexDeviceAuthOnce uses server code_verifier for token exchange', async () => {
    let call = 0
    const success = await pollOpenAICodexDeviceAuthOnce(
      { device_auth_id: 'dc', device_code: 'dc', user_code: 'ABCD' },
      {
        now: 1000,
        fetchImpl: (async (url: string, init?: RequestInit) => {
          call++
          if (String(url) === OPENAI_CODEX_DEVICE_TOKEN_URL) {
            const body = JSON.parse(String(init?.body))
            expect(body).toEqual({ device_auth_id: 'dc', user_code: 'ABCD' })
            // Server returns PKCE verifier (Codex CLI protocol)
            return jsonResponse({
              authorization_code: 'auth-code-long-enough-value',
              code_challenge: 'ch',
              code_verifier: 'server-issued-verifier',
            })
          }
          if (String(url) === OPENAI_CODEX_TOKEN_URL) {
            const form = String(init?.body)
            expect(form).toContain('code_verifier=server-issued-verifier')
            expect(form).toContain('code=auth-code-long-enough-value')
            return jsonResponse({
              access_token: 'access',
              refresh_token: 'refresh',
              expires_in: 60,
              token_type: 'Bearer',
            })
          }
          return jsonResponse({}, 404)
        }) as unknown as typeof fetch,
      }
    )
    expect(success.status).toBe('success')
    if (success.status === 'success') {
      expect(success.tokens.accessToken).toBe('access')
      expect(success.tokens.expiresAt).toBe(1000 + 60_000)
    }
    expect(call).toBe(2)
  })

  it('ensureFreshOpenAICodexAccessToken refreshes near expiry', async () => {
    const now = 1_000_000
    const tokens = {
      accessToken: 'old',
      refreshToken: 'rt',
      expiresAt: now + 10_000,
      accountId: 'acct',
    }
    const result = await ensureFreshOpenAICodexAccessToken(tokens, {
      now,
      fetchImpl: (async () =>
        jsonResponse({
          access_token: 'new',
          expires_in: 3600,
          token_type: 'Bearer',
        })) as unknown as typeof fetch,
    })
    expect(result.refreshed).toBe(true)
    expect(result.accessToken).toBe('new')
    expect(result.tokens.refreshToken).toBe('rt')
    expect(result.tokens.accountId).toBe('acct')
  })

  it('resolveOpenAIAuthMode prefers explicit mode and migrates key-only installs', () => {
    expect(resolveOpenAIAuthMode({ apiKey: 'k' })).toBe('api_key')
    expect(resolveOpenAIAuthMode({ authMode: 'oauth', apiKey: 'k' })).toBe('oauth')
    expect(resolveOpenAIAuthMode({ oauth: { accessToken: 't' } })).toBe('oauth')
    expect(resolveOpenAIAuthMode({})).toBe('api_key')
  })

  it('resolveOpenAIBearer never falls back to apiKey in oauth mode', () => {
    expect(
      resolveOpenAIBearer({ authMode: 'oauth', oauth: { accessToken: 'oa' }, apiKey: 'ak' })
    ).toBe('oa')
    expect(
      resolveOpenAIBearer({ authMode: 'oauth', apiKey: 'ak' })
    ).toBe('')
    expect(
      resolveOpenAIBearer({ authMode: 'api_key', oauth: { accessToken: 'oa' }, apiKey: 'ak' })
    ).toBe('ak')
  })

  it('settings patches set oauth mode and clear tokens', () => {
    const patch = settingsPatchFromOpenAICodexTokens({
      accessToken: 'a',
      refreshToken: 'r',
      accountId: 'id',
      planType: 'pro',
    })
    expect(patch.authMode).toBe('oauth')
    expect(patch.oauth?.accessToken).toBe('a')
    expect(patch.oauth?.accountId).toBe('id')

    const out = settingsPatchSignOutOpenAICodexOAuth()
    expect(out.oauth).toBeUndefined()
    expect(out.authMode).toBe('oauth')
  })

  it('ensureOpenAICodexBearer returns api key without network', async () => {
    const r = await ensureOpenAICodexBearer({ authMode: 'api_key', apiKey: 'secret' })
    expect(r.bearer).toBe('secret')
    expect(r.settingsPatch).toBeUndefined()
  })

  it('ensureOpenAICodexBearer oauth path returns patch when refreshed', async () => {
    const now = Date.now()
    const r = await ensureOpenAICodexBearer(
      {
        authMode: 'oauth',
        oauth: {
          accessToken: 'old',
          refreshToken: 'rt',
          expiresAt: now - 1000,
          accountId: 'acct',
        },
      },
      {
        now,
        fetchImpl: (async () =>
          jsonResponse({
            access_token: 'new',
            expires_in: 3600,
          })) as unknown as typeof fetch,
      }
    )
    expect(r.bearer).toBe('new')
    expect(r.settingsPatch?.oauth?.accessToken).toBe('new')
  })

  it('ensureOpenAICodexBearer oauth without token throws', async () => {
    await expect(ensureOpenAICodexBearer({ authMode: 'oauth' })).rejects.toBeInstanceOf(OpenAICodexOAuthError)
  })

  it('tokensFromCodexAuthJson reads Codex CLI auth.json shape', () => {
    const tokens = tokensFromCodexAuthJson(
      {
        auth_mode: 'chatgpt',
        tokens: {
          access_token: 'at',
          refresh_token: 'rt',
          account_id: 'acct-1',
        },
      },
      1_000_000
    )
    expect(tokens.accessToken).toBe('at')
    expect(tokens.refreshToken).toBe('rt')
    expect(tokens.accountId).toBe('acct-1')
  })
})
