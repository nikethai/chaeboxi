import { describe, expect, it } from 'vitest'
import type { ProviderInfo } from '@shared/types'
import { getModelDisplayName } from './modelDisplayName'

const provider = {
  id: 'gemini',
  name: 'Gemini',
  models: [{ modelId: 'gemini-3.6-flash' }],
  defaultSettings: {
    models: [{ modelId: 'gemini-3.6-flash', nickname: 'Flash Fast' }],
  },
} as unknown as ProviderInfo

describe('getModelDisplayName', () => {
  it('prefers a configured nickname for an exact model ID', () => {
    expect(getModelDisplayName([provider], { provider: 'gemini', modelId: 'gemini-3.6-flash' })).toBe('Flash Fast')
  })

  it('uses a canonical alias only when the exact model ID is absent', () => {
    const canonicalProvider = {
      id: 'gemini',
      name: 'Gemini',
      models: [{ modelId: 'gemini-3-flash', nickname: 'Gemini 3 Flash' }],
      defaultSettings: { models: [] },
    } as unknown as ProviderInfo
    expect(getModelDisplayName([canonicalProvider], { provider: 'gemini', modelId: 'gemini-3.6-flash' })).toBe(
      'Gemini 3 Flash'
    )
  })

  it('preserves a distinct variant instead of collapsing it into the canonical flash alias', () => {
    const providerWithVariant = {
      id: 'gemini',
      name: 'Gemini',
      models: [
        { modelId: 'gemini-3-flash', nickname: 'Gemini 3 Flash' },
        { modelId: 'gemini-3.6-flash-medium', nickname: 'Gemini 3.6 Flash Medium' },
      ],
      defaultSettings: { models: [] },
    } as unknown as ProviderInfo
    expect(
      getModelDisplayName([providerWithVariant], { provider: 'gemini', modelId: 'gemini-3.6-flash-medium' })
    ).toBe('Gemini 3.6 Flash Medium')
  })

  it('keeps a distinct variant ID when it has no nickname', () => {
    const providerWithBareVariant = {
      id: 'gemini',
      name: 'Gemini',
      models: [
        { modelId: 'gemini-3-flash', nickname: 'Gemini 3 Flash' },
        { modelId: 'gemini-3.6-flash-medium' },
      ],
      defaultSettings: { models: [] },
    } as unknown as ProviderInfo
    expect(
      getModelDisplayName([providerWithBareVariant], { provider: 'gemini', modelId: 'gemini-3.6-flash-medium' })
    ).toBe('gemini-3.6-flash-medium')
  })

  it('falls back to the model ID when no nickname is configured', () => {
    expect(getModelDisplayName([], { provider: 'gemini', modelId: 'gemini-3.6-flash' })).toBe('gemini-3.6-flash')
  })
})
