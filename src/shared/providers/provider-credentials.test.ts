import { ModelProviderEnum } from '../types'
import { describe, expect, it } from 'vitest'
import { hasProviderCredentials, isProviderListedInSettings } from './provider-credentials'

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

describe('isProviderListedInSettings', () => {
  it('lists custom providers always', () => {
    expect(isProviderListedInSettings({ id: 'custom-1', isCustom: true }, {})).toBe(true)
  })

  it('lists cloud builtins only with credentials', () => {
    expect(isProviderListedInSettings({ id: ModelProviderEnum.OpenAI }, {})).toBe(false)
    expect(isProviderListedInSettings({ id: ModelProviderEnum.OpenAI }, { apiKey: 'sk' })).toBe(true)
  })
})
