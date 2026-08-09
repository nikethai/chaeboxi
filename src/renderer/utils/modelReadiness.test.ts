import type { ProviderInfo, ProviderModelInfo } from '@shared/types'
import { describe, expect, test } from 'vitest'
import { getModelReadiness } from './modelReadiness'

const model = (modelId: string, capabilities: ProviderModelInfo['capabilities'] = []): ProviderModelInfo => ({
  modelId,
  capabilities,
})

const provider = (id: string, models: ProviderModelInfo[]): ProviderInfo =>
  ({
    id,
    name: id,
    type: 'openai',
    isCustom: false,
    models,
  }) as ProviderInfo

describe('getModelReadiness', () => {
  test('marks an absent selection as requiring setup', () => {
    expect(getModelReadiness(undefined, [provider('openai', [model('gpt-4o')])])).toEqual({
      status: 'setup-required',
    })
  })

  test('marks a selected provider absent from configured providers as unavailable', () => {
    expect(getModelReadiness({ provider: 'openai', modelId: 'gpt-4o' }, [])).toEqual({
      status: 'provider-unavailable',
      providerId: 'openai',
    })
  })

  test('marks a removed selected model as unavailable', () => {
    expect(getModelReadiness({ provider: 'openai', modelId: 'gpt-4o' }, [provider('openai', [])])).toEqual({
      status: 'model-unavailable',
      providerId: 'openai',
      modelId: 'gpt-4o',
    })
  })

  test('marks an explicitly non-vision model incompatible only when vision is required', () => {
    expect(
      getModelReadiness({ provider: 'openai', modelId: 'gpt-4o-mini' }, [provider('openai', [model('gpt-4o-mini')])], {
        requiresVision: true,
      })
    ).toEqual({
      status: 'capability-required',
      providerId: 'openai',
      modelId: 'gpt-4o-mini',
      capability: 'vision',
    })
  })

  test('does not block an available model when its capability metadata is unknown', () => {
    expect(
      getModelReadiness(
        { provider: 'openai', modelId: 'gpt-4o' },
        [provider('openai', [{ modelId: 'gpt-4o' }])],
        { requiresVision: true }
      )
    ).toEqual({
      status: 'ready',
      providerId: 'openai',
      modelId: 'gpt-4o',
    })
  })

  test('marks an available selected model ready', () => {
    expect(getModelReadiness({ provider: 'openai', modelId: 'gpt-4o' }, [provider('openai', [model('gpt-4o')])])).toEqual({
      status: 'ready',
      providerId: 'openai',
      modelId: 'gpt-4o',
    })
  })
})
