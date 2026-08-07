import { ModelProviderEnum, ModelProviderType, type ProviderInfo } from '@shared/types'
import { describe, expect, test } from 'vitest'
import { listAvailableImageModels, parseImageModelValue } from './available-image-models'

describe('listAvailableImageModels', () => {
  test('lists gemini image models from configured provider', () => {
    const providers = [
      {
        id: ModelProviderEnum.Gemini,
        name: 'Google Gemini',
        models: [
          { modelId: 'gemini-2.5-flash-image', nickname: 'Nano Banana' },
          { modelId: 'gemini-2.5-pro' },
        ],
      },
    ] as ProviderInfo[]

    const list = listAvailableImageModels(providers)
    expect(list.some((m) => m.modelId === 'gemini-2.5-flash-image')).toBe(true)
    expect(list.some((m) => m.modelId === 'gemini-2.5-pro')).toBe(false)
  })

  test('lists openai gpt-image models', () => {
    const providers = [
      {
        id: ModelProviderEnum.OpenAI,
        name: 'OpenAI',
        models: [{ modelId: 'gpt-image-1' }, { modelId: 'gpt-4o' }],
      },
    ] as ProviderInfo[]

    const list = listAvailableImageModels(providers)
    expect(list.map((m) => m.modelId)).toContain('gpt-image-1')
    expect(list.map((m) => m.modelId)).not.toContain('gpt-4o')
  })

  test('heuristic picks flash-image style ids not in static list', () => {
    const providers = [
      {
        id: ModelProviderEnum.Gemini,
        name: 'Google Gemini',
        models: [{ modelId: 'gemini-experimental-flash-image-v2' }],
      },
    ] as ProviderInfo[]

    const list = listAvailableImageModels(providers)
    expect(list.some((m) => m.modelId === 'gemini-experimental-flash-image-v2')).toBe(true)
  })

  test('lists xAI grok-imagine image models', () => {
    const providers = [
      {
        id: ModelProviderEnum.XAI,
        name: 'xAI',
        models: [
          { modelId: 'grok-imagine-image' },
          { modelId: 'grok-imagine-image-quality' },
          { modelId: 'grok-4-1-fast-reasoning' },
        ],
      },
    ] as ProviderInfo[]

    const list = listAvailableImageModels(providers)
    expect(list.map((m) => m.modelId)).toContain('grok-imagine-image')
    expect(list.map((m) => m.modelId)).toContain('grok-imagine-image-quality')
    expect(list.map((m) => m.modelId)).not.toContain('grok-4-1-fast-reasoning')
  })

  test('custom gemini type providers are included', () => {
    const providers = [
      {
        id: 'my-gemini',
        name: 'My Gemini',
        isCustom: true,
        type: ModelProviderType.Gemini,
        models: [{ modelId: 'gemini-2.5-flash-image' }],
      },
    ] as ProviderInfo[]

    const list = listAvailableImageModels(providers)
    expect(list[0]?.providerId).toBe('my-gemini')
  })
})

describe('parseImageModelValue', () => {
  test('parses provider:model', () => {
    expect(parseImageModelValue('gemini:gemini-2.5-flash-image')).toEqual({
      providerId: 'gemini',
      modelId: 'gemini-2.5-flash-image',
    })
  })

  test('rejects bad values', () => {
    expect(parseImageModelValue('nocolon')).toBeNull()
    expect(parseImageModelValue(':onlymodel')).toBeNull()
  })
})
