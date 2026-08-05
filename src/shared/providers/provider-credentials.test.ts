import { describe, expect, it } from 'vitest'
import { hasProviderCredentials } from './provider-credentials'

describe('hasProviderCredentials', () => {
  it('accepts api key', () => {
    expect(hasProviderCredentials({ apiKey: 'xai-123' })).toBe(true)
  })

  it('accepts oauth access token without api key', () => {
    expect(hasProviderCredentials({ oauth: { accessToken: 'at' } })).toBe(true)
  })

  it('rejects empty / missing', () => {
    expect(hasProviderCredentials(undefined)).toBe(false)
    expect(hasProviderCredentials({})).toBe(false)
    expect(hasProviderCredentials({ apiKey: '   ' })).toBe(false)
    expect(hasProviderCredentials({ oauth: {} })).toBe(false)
  })
})
