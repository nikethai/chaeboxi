import { describe, expect, it, vi } from 'vitest'
import {
  ensureGeminiAntigravityBearer,
  resolveGeminiAuthMode,
  settingsPatchFromGeminiAntigravityTokens,
  settingsPatchSignOutGeminiAntigravityOAuth,
} from './gemini-antigravity-auth'
import {
  exchangeAuthorizationCode,
  ensureFreshGeminiAntigravityAccessToken,
  GeminiAntigravityOAuthError,
  isGeminiAntigravityTokenExpired,
  parseGeminiAntigravityRedirectUrl,
  refreshGeminiAntigravityAccessToken,
  startGeminiAntigravityPkceAuth,
  tokensFromGeminiAntigravityTokenResponse,
} from './gemini-antigravity-oauth'
import {
  fetchGeminiAntigravityModels,
  GEMINI_ANTIGRAVITY_DEFAULT_MODELS,
  mergeGeminiAntigravityModels,
  resolveAntigravityChatModelId,
  resolveModelsAfterAntigravityLogin,
} from './gemini-antigravity-models'
import { createAntigravityFetch } from '../definitions/models/gemini-antigravity'

function mockFetch(handler: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    return handler(url, init)
  }) as unknown as typeof fetch
}

describe('gemini-antigravity-oauth', () => {
  it('startGeminiAntigravityPkceAuth builds PKCE auth URL', async () => {
    const session = await startGeminiAntigravityPkceAuth()
    expect(session.verifier.length).toBeGreaterThan(10)
    expect(session.challenge.length).toBeGreaterThan(10)
    expect(session.state.length).toBeGreaterThan(5)
    expect(session.authUrl).toContain('accounts.google.com')
    expect(session.authUrl).toContain('code_challenge=')
    expect(session.authUrl).toContain('code_challenge_method=S256')
    expect(session.authUrl).toContain('access_type=offline')
  })

  it('parseGeminiAntigravityRedirectUrl extracts code from full URL', () => {
    const r = parseGeminiAntigravityRedirectUrl(
      'http://localhost:51121/oauth-callback?code=abc123&state=xyz'
    )
    expect(r.code).toBe('abc123')
    expect(r.state).toBe('xyz')
  })

  it('parseGeminiAntigravityRedirectUrl accepts bare code', () => {
    expect(parseGeminiAntigravityRedirectUrl('onlycode').code).toBe('onlycode')
  })

  it('parseGeminiAntigravityRedirectUrl surfaces OAuth error', () => {
    expect(() =>
      parseGeminiAntigravityRedirectUrl('http://localhost:51121/oauth-callback?error=access_denied')
    ).toThrow(GeminiAntigravityOAuthError)
  })

  it('tokensFromGeminiAntigravityTokenResponse computes expiresAt', () => {
    const now = 1_000_000
    const t = tokensFromGeminiAntigravityTokenResponse(
      { access_token: 'a', refresh_token: 'r', expires_in: 100 },
      now
    )
    expect(t.accessToken).toBe('a')
    expect(t.refreshToken).toBe('r')
    expect(t.expiresAt).toBe(now + 100_000)
  })

  it('isGeminiAntigravityTokenExpired respects skew', () => {
    const now = 10_000
    expect(isGeminiAntigravityTokenExpired({ expiresAt: now + 10_000_000 }, now)).toBe(false)
    expect(isGeminiAntigravityTokenExpired({ expiresAt: now + 1000 }, now)).toBe(true)
  })

  it('exchangeAuthorizationCode posts code_verifier', async () => {
    const fetchImpl = mockFetch(async (url, init) => {
      expect(url).toContain('oauth2.googleapis.com/token')
      const body = String(init?.body || '')
      expect(body).toContain('code=thecode')
      expect(body).toContain('code_verifier=ver')
      expect(body).toContain('grant_type=authorization_code')
      return new Response(JSON.stringify({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }), {
        status: 200,
      })
    })
    const tokens = await exchangeAuthorizationCode({
      code: 'thecode',
      verifier: 'ver',
      fetchImpl,
      now: 1000,
    })
    expect(tokens.accessToken).toBe('at')
    expect(tokens.refreshToken).toBe('rt')
  })

  it('refreshGeminiAntigravityAccessToken keeps previous projectId', async () => {
    const fetchImpl = mockFetch(async () => {
      return new Response(JSON.stringify({ access_token: 'new', expires_in: 60 }), { status: 200 })
    })
    const tokens = await refreshGeminiAntigravityAccessToken('rt', {
      fetchImpl,
      now: 5000,
      previous: { projectId: 'proj-1', email: 'a@b.com' },
    })
    expect(tokens.accessToken).toBe('new')
    expect(tokens.refreshToken).toBe('rt')
    expect(tokens.projectId).toBe('proj-1')
    expect(tokens.email).toBe('a@b.com')
  })

  it('ensureFreshGeminiAntigravityAccessToken refreshes when expired', async () => {
    const fetchImpl = mockFetch(async () => {
      return new Response(JSON.stringify({ access_token: 'fresh', expires_in: 3600 }), { status: 200 })
    })
    const result = await ensureFreshGeminiAntigravityAccessToken(
      {
        accessToken: 'old',
        refreshToken: 'rt',
        expiresAt: Date.now() - 1000,
        projectId: 'p1',
      },
      { fetchImpl }
    )
    expect(result.refreshed).toBe(true)
    expect(result.accessToken).toBe('fresh')
  })

  it('ensureFreshGeminiAntigravityAccessToken throws when not signed in', async () => {
    await expect(ensureFreshGeminiAntigravityAccessToken(undefined)).rejects.toBeInstanceOf(
      GeminiAntigravityOAuthError
    )
  })
})

describe('gemini-antigravity-auth', () => {
  it('resolveGeminiAuthMode prefers explicit mode and defaults to api_key', () => {
    expect(resolveGeminiAuthMode({ authMode: 'oauth' })).toBe('oauth')
    expect(resolveGeminiAuthMode({ authMode: 'api_key' })).toBe('api_key')
    expect(resolveGeminiAuthMode({ apiKey: 'k' })).toBe('api_key')
    expect(resolveGeminiAuthMode({ oauth: { accessToken: 't' } })).toBe('oauth')
    expect(resolveGeminiAuthMode({})).toBe('api_key')
  })

  it('settings patches set oauth mode and clear on sign-out', () => {
    const patch = settingsPatchFromGeminiAntigravityTokens({
      accessToken: 'a',
      refreshToken: 'r',
      projectId: 'p',
      email: 'u@g.com',
    })
    expect(patch.authMode).toBe('oauth')
    expect(patch.oauth?.projectId).toBe('p')
    expect(patch.oauth?.email).toBe('u@g.com')

    const out = settingsPatchSignOutGeminiAntigravityOAuth()
    expect(out.oauth).toBeUndefined()
    expect(out.authMode).toBe('oauth')
  })

  it('ensureGeminiAntigravityBearer returns api key without network', async () => {
    const r = await ensureGeminiAntigravityBearer({ authMode: 'api_key', apiKey: 'secret' })
    expect(r.bearer).toBe('secret')
    expect(r.settingsPatch).toBeUndefined()
  })

  it('ensureGeminiAntigravityBearer oauth path returns patch when refreshed', async () => {
    const fetchImpl = mockFetch(async () => {
      return new Response(JSON.stringify({ access_token: 'new', expires_in: 3600 }), { status: 200 })
    })
    const r = await ensureGeminiAntigravityBearer(
      {
        authMode: 'oauth',
        oauth: {
          accessToken: 'old',
          refreshToken: 'rt',
          expiresAt: Date.now() - 1,
          projectId: 'proj',
        },
      },
      { fetchImpl }
    )
    expect(r.bearer).toBe('new')
    expect(r.projectId).toBe('proj')
    expect(r.settingsPatch?.oauth?.accessToken).toBe('new')
  })

  it('ensureGeminiAntigravityBearer oauth without token throws', async () => {
    await expect(ensureGeminiAntigravityBearer({ authMode: 'oauth' })).rejects.toBeInstanceOf(
      GeminiAntigravityOAuthError
    )
  })
})

describe('gemini-antigravity-models', () => {
  it('mergeGeminiAntigravityModels replaceAll uses remote or defaults', () => {
    const mergedEmpty = mergeGeminiAntigravityModels(undefined, [], { replaceAll: true })
    expect(mergedEmpty.map((m) => m.modelId)).toEqual(GEMINI_ANTIGRAVITY_DEFAULT_MODELS.map((m) => m.modelId))
    const remote = [{ modelId: 'gemini-2.5-flash', type: 'chat' as const }]
    expect(mergeGeminiAntigravityModels([{ modelId: 'old' }], remote, { replaceAll: true })).toEqual(remote)
  })

  it('resolveAntigravityChatModelId maps Studio / marketing ids to gateway ids', () => {
    expect(resolveAntigravityChatModelId('gemini-3-pro-preview')).toBe('gemini-3-pro-low')
    expect(resolveAntigravityChatModelId('gemini-3-flash-preview')).toBe('gemini-3-flash')
    expect(resolveAntigravityChatModelId('gemini-3.6-flash')).toBe('gemini-3-flash')
    expect(resolveAntigravityChatModelId('antigravity-gemini-3-pro-high')).toBe('gemini-3-pro-high')
    expect(resolveAntigravityChatModelId('gemini-3-pro-high')).toBe('gemini-3-pro-high')
    expect(resolveAntigravityChatModelId('gemini-3-pro')).toBe('gemini-3-pro-low')
  })

  it('resolveModelsAfterAntigravityLogin never keeps Studio list when remote empty', () => {
    const studio = [{ modelId: 'gemini-3-pro-preview', type: 'chat' as const }]
    const out = resolveModelsAfterAntigravityLogin(undefined, studio)
    expect(out.some((m) => m.modelId === 'gemini-3-pro-preview')).toBe(false)
    expect(out.length).toBeGreaterThan(0)
    const remote = [{ modelId: 'gemini-3-pro-high', type: 'chat' as const }]
    expect(resolveModelsAfterAntigravityLogin(remote, studio)).toEqual(remote)
  })

  it('fetchGeminiAntigravityModels filters non-Gemini and normalizes ids', async () => {
    const fetchImpl = mockFetch(async () => {
      return new Response(
        JSON.stringify({
          models: {
            'gemini-2.5-flash': { displayName: 'Flash' },
            'antigravity-gemini-3-pro': { displayName: 'Pro' },
            'claude-opus-4': { displayName: 'Claude' },
          },
        }),
        { status: 200 }
      )
    })
    const models = await fetchGeminiAntigravityModels('tok', 'proj', { fetchImpl })
    expect(models.map((m) => m.modelId).sort()).toEqual(['gemini-2.5-flash', 'gemini-3-pro-low'])
    expect(models.find((m) => m.modelId === 'gemini-2.5-flash')?.nickname).toContain('Flash')
  })
})

describe('createAntigravityFetch', () => {
  it('wraps generateContent body in Cloud Code envelope and tries daily first', async () => {
    const urls: string[] = []
    const inner = mockFetch(async (url, init) => {
      urls.push(url)
      expect(url).toContain('streamGenerateContent')
      const body = JSON.parse(String(init?.body || '{}')) as {
        project: string
        model: string
        request: { contents: unknown[] }
      }
      expect(body.project).toBe('my-proj')
      expect(body.model).toBe('gemini-2.5-flash')
      expect(body.request.contents).toEqual([{ role: 'user' }])
      const headers = init?.headers as Record<string, string>
      expect(headers.Authorization || headers.authorization).toBe('Bearer tok')
      return new Response('data: {"response":{"candidates":[]}}\n\n', {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    })

    const fetchFn = createAntigravityFetch({
      accessToken: 'tok',
      projectId: 'my-proj',
      innerFetch: inner,
    })

    const res = await fetchFn(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse',
      {
        method: 'POST',
        body: JSON.stringify({ contents: [{ role: 'user' }] }),
      }
    )
    expect(res.ok).toBe(true)
    expect(urls[0]).toContain('daily-cloudcode-pa.sandbox.googleapis.com')
    const text = await res.text()
    expect(text).toContain('candidates')
    expect(text).not.toContain('"response"')
  })

  it('maps gemini-3.6-flash to gemini-3-flash in envelope', async () => {
    const inner = mockFetch(async (_url, init) => {
      const body = JSON.parse(String(init?.body || '{}')) as { model: string }
      expect(body.model).toBe('gemini-3-flash')
      return new Response(JSON.stringify({ response: { candidates: [] } }), { status: 200 })
    })
    const fetchFn = createAntigravityFetch({
      accessToken: 'tok',
      projectId: 'p',
      endpointFallbacks: ['https://cloudcode-pa.googleapis.com'],
      innerFetch: inner,
    })
    await fetchFn(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
      { method: 'POST', body: JSON.stringify({ contents: [] }) }
    )
  })
})
