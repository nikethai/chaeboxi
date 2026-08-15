import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDesktopAwareFetch, hasDesktopHttpTransport } from '../../utils/desktop-http-fetch'
import {
  ensureFreshAccessToken,
  humanizeOAuthNetworkError,
  isXaiTokenExpired,
  pollDeviceAuth,
  pollDeviceAuthOnce,
  refreshAccessToken,
  startDeviceAuth,
  tokensFromTokenResponse,
  XAI_DEVICE_CODE_URL,
  XAI_TOKEN_URL,
  XaiOAuthError,
} from './xai-oauth'
import {
  ensureXaiBearer,
  resolveXaiAuthMode,
  resolveXaiBearer,
  settingsPatchFromOAuthTokens,
  settingsPatchSignOutOAuth,
} from './xai-auth'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('xai-oauth', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tokensFromTokenResponse sets expiresAt from expires_in', () => {
    const now = 1_700_000_000_000
    const tokens = tokensFromTokenResponse(
      {
        access_token: 'at',
        refresh_token: 'rt',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'openid',
      },
      now
    )
    expect(tokens.accessToken).toBe('at')
    expect(tokens.refreshToken).toBe('rt')
    expect(tokens.expiresAt).toBe(now + 3600_000)
    expect(tokens.obtainedAt).toBe(now)
  })

  it('isXaiTokenExpired respects skew window', () => {
    const now = 1_000_000
    expect(isXaiTokenExpired({ expiresAt: now + 120_000 }, now)).toBe(false)
    expect(isXaiTokenExpired({ expiresAt: now + 30_000 }, now)).toBe(true)
    expect(isXaiTokenExpired({}, now)).toBe(false)
  })

  it('startDeviceAuth parses device code response', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toBe(XAI_DEVICE_CODE_URL)
      return jsonResponse({
        device_code: 'dc',
        user_code: 'ABCD-EFGH',
        verification_uri: 'https://accounts.x.ai/oauth2/device',
        verification_uri_complete: 'https://accounts.x.ai/oauth2/device?user_code=ABCD-EFGH',
        expires_in: 1800,
        interval: 5,
      })
    })

    const device = await startDeviceAuth({ fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(device.user_code).toBe('ABCD-EFGH')
    expect(device.device_code).toBe('dc')
    expect(device.interval).toBe(5)
  })

  it('pollDeviceAuthOnce returns pending then success', async () => {
    const pending = await pollDeviceAuthOnce('dc', {
      fetchImpl: (async () => jsonResponse({ error: 'authorization_pending' }, 400)) as unknown as typeof fetch,
    })
    expect(pending.status).toBe('pending')

    const success = await pollDeviceAuthOnce('dc', {
      now: 1000,
      fetchImpl: (async () =>
        jsonResponse({
          access_token: 'access',
          refresh_token: 'refresh',
          expires_in: 60,
          token_type: 'Bearer',
        })) as unknown as typeof fetch,
    })
    expect(success.status).toBe('success')
    if (success.status === 'success') {
      expect(success.tokens.accessToken).toBe('access')
      expect(success.tokens.expiresAt).toBe(1000 + 60_000)
    }
  })

  it('pollDeviceAuth loops until success', async () => {
    let n = 0
    const fetchImpl = vi.fn(async () => {
      n += 1
      if (n < 3) return jsonResponse({ error: 'authorization_pending' }, 400)
      return jsonResponse({
        access_token: 'ok',
        refresh_token: 'r',
        expires_in: 100,
      })
    })

    const tokens = await pollDeviceAuth(
      { device_code: 'dc', expires_in: 100, interval: 0 },
      {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        sleep: async () => {},
        now: (() => {
          let t = 0
          return () => {
            t += 1
            return t
          }
        })(),
      }
    )
    expect(tokens.accessToken).toBe('ok')
    expect(n).toBe(3)
  })

  it('refreshAccessToken keeps previous refresh token if omitted', async () => {
    const tokens = await refreshAccessToken('old-rt', {
      now: 5000,
      fetchImpl: (async () =>
        jsonResponse({
          access_token: 'new-at',
          expires_in: 10,
        })) as unknown as typeof fetch,
    })
    expect(tokens.accessToken).toBe('new-at')
    expect(tokens.refreshToken).toBe('old-rt')
  })

  it('ensureFreshAccessToken refreshes near expiry', async () => {
    const now = 10_000
    const result = await ensureFreshAccessToken(
      {
        accessToken: 'old',
        refreshToken: 'rt',
        expiresAt: now + 10_000, // within skew
      },
      {
        now,
        fetchImpl: (async (url: string) => {
          expect(url).toBe(XAI_TOKEN_URL)
          return jsonResponse({
            access_token: 'fresh',
            refresh_token: 'rt2',
            expires_in: 3600,
          })
        }) as unknown as typeof fetch,
      }
    )
    expect(result.refreshed).toBe(true)
    expect(result.accessToken).toBe('fresh')
    expect(result.tokens.refreshToken).toBe('rt2')
  })

  it('ensureFreshAccessToken throws not_signed_in without tokens', async () => {
    await expect(ensureFreshAccessToken(undefined)).rejects.toBeInstanceOf(XaiOAuthError)
  })

  it('humanizeOAuthNetworkError maps Load failed', () => {
    expect(humanizeOAuthNetworkError(new TypeError('Load failed'))).toMatch(/auth\.x\.ai/)
  })

  it('startDeviceAuth surfaces network errors as XaiOAuthError', async () => {
    await expect(
      startDeviceAuth({
        fetchImpl: (async () => {
          throw new TypeError('Load failed')
        }) as unknown as typeof fetch,
      })
    ).rejects.toMatchObject({ code: 'network_error' })
  })
})

describe('desktop-http-fetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('routes through the desktop streaming command when available', async () => {
    const body = JSON.stringify({
      device_code: 'dc',
      user_code: 'AB',
      verification_uri: 'https://accounts.x.ai/oauth2/device',
      expires_in: 100,
    })
    const bodyBase64 = btoa(body)

    let nextCallbackId = 1
    const callbacks: Record<number, (raw: unknown) => void> = {}
    const invoke = vi.fn().mockImplementation((_cmd: string, args: { request: unknown; onChunk: { id: number } }) => {
      // Deliver the whole body as one chunk, then the end-of-body sentinel.
      const channelId = args.onChunk.id
      callbacks[channelId]?.({ index: 0, message: bodyBase64 })
      callbacks[channelId]?.({ index: 1, message: '' })
      return Promise.resolve({
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    vi.stubGlobal('window', {
      __TAURI_INTERNALS__: {
        invoke,
        transformCallback: (cb: (raw: unknown) => void) => {
          const id = nextCallbackId++
          callbacks[id] = cb
          return id
        },
        invokeCallback: (id: number, raw: unknown) => {
          callbacks[id]?.(raw)
        },
        unregisterCallback: (id: number) => {
          delete callbacks[id]
        },
      },
      desktopAPI: { invoke },
    })

    expect(hasDesktopHttpTransport()).toBe(true)
    const desktopFetch = createDesktopAwareFetch()
    const res = await desktopFetch(XAI_DEVICE_CODE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'client_id=test',
    })
    expect(invoke).toHaveBeenCalledWith(
      'http_request_stream',
      expect.objectContaining({
        request: expect.objectContaining({
          url: XAI_DEVICE_CODE_URL,
          method: 'POST',
        }),
        onChunk: expect.anything(),
      }),
      undefined
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ device_code: 'dc' })
  })
})
describe('xai-auth dual mode', () => {
  it('resolveXaiAuthMode prefers explicit mode and migrates key-only installs', () => {
    expect(resolveXaiAuthMode({ apiKey: 'k' })).toBe('api_key')
    expect(resolveXaiAuthMode({ authMode: 'oauth', apiKey: 'k' })).toBe('oauth')
    expect(resolveXaiAuthMode({ oauth: { accessToken: 't' } })).toBe('oauth')
    expect(resolveXaiAuthMode({})).toBe('oauth')
  })

  it('resolveXaiBearer picks oauth vs api key', () => {
    expect(resolveXaiBearer({ authMode: 'oauth', oauth: { accessToken: 'oa' }, apiKey: 'ak' })).toBe('oa')
    expect(resolveXaiBearer({ authMode: 'api_key', oauth: { accessToken: 'oa' }, apiKey: 'ak' })).toBe('ak')
  })

  it('settings patches for sign-in and sign-out', () => {
    const patch = settingsPatchFromOAuthTokens({
      accessToken: 'a',
      refreshToken: 'r',
      expiresAt: 1,
    })
    expect(patch.authMode).toBe('oauth')
    expect(patch.oauth?.accessToken).toBe('a')

    const out = settingsPatchSignOutOAuth()
    expect(out.oauth).toBeUndefined()
    expect(out.authMode).toBe('oauth')
  })

  it('ensureXaiBearer returns api key without network', async () => {
    const r = await ensureXaiBearer({ authMode: 'api_key', apiKey: 'secret' })
    expect(r.bearer).toBe('secret')
    expect(r.settingsPatch).toBeUndefined()
  })

  it('ensureXaiBearer oauth path returns patch when refreshed', async () => {
    const now = 1_000_000
    const r = await ensureXaiBearer(
      {
        authMode: 'oauth',
        oauth: {
          accessToken: 'old',
          refreshToken: 'rt',
          expiresAt: now + 5_000,
        },
      },
      {
        now,
        fetchImpl: (async () =>
          jsonResponse({
            access_token: 'new',
            refresh_token: 'rt',
            expires_in: 3600,
          })) as unknown as typeof fetch,
      }
    )
    expect(r.bearer).toBe('new')
    expect(r.settingsPatch?.oauth?.accessToken).toBe('new')
  })
})
