import { describe, expect, it } from 'vitest'
import { settings as getDefaultSettings } from '../defaults'
import { ModelProviderEnum, ModelProviderType, type Settings } from '../types'
import { isReasoningReplayAvailable, shouldPreserveReasoningInContext } from './reasoning-replay'

describe('reasoning replay helpers', () => {
  it('reports replay as available for supported reasoning transports', () => {
    const globalSettings = getDefaultSettings()

    expect(
      isReasoningReplayAvailable(
        {
          provider: ModelProviderEnum.Qwen,
          modelId: 'qwen3.7-plus',
        },
        globalSettings
      )
    ).toBe(true)
  })

  it('disables replay for unsupported transports even when the model supports reasoning', () => {
    const globalSettings = getDefaultSettings()

    expect(
      isReasoningReplayAvailable(
        {
          provider: ModelProviderEnum.OpenAI,
          modelId: 'o3-mini',
        },
        {
          ...globalSettings,
          providers: {
            ...globalSettings.providers,
            [ModelProviderEnum.OpenAI]: {
              models: [{ modelId: 'o3-mini', capabilities: ['reasoning'] }],
            },
          },
        }
      )
    ).toBe(false)
  })

  it('enables replay for custom OpenAI-compatible providers but not custom OpenAI Responses providers', () => {
    const globalSettings: Settings = {
      ...getDefaultSettings(),
      customProviders: [
        {
          id: 'custom-openai',
          name: 'Custom OpenAI',
          type: ModelProviderType.OpenAI,
          isCustom: true,
          defaultSettings: {
            models: [{ modelId: 'reasoner', capabilities: ['reasoning'] }],
          },
        },
        {
          id: 'custom-responses',
          name: 'Custom Responses',
          type: ModelProviderType.OpenAIResponses,
          isCustom: true,
          defaultSettings: {
            models: [{ modelId: 'reasoner', capabilities: ['reasoning'] }],
          },
        },
      ],
    }

    expect(
      shouldPreserveReasoningInContext(
        {
          provider: 'custom-openai',
          modelId: 'reasoner',
          preserveReasoningInContext: true,
        },
        globalSettings
      )
    ).toBe(true)

    expect(
      shouldPreserveReasoningInContext(
        {
          provider: 'custom-responses',
          modelId: 'reasoner',
          preserveReasoningInContext: true,
        },
        globalSettings
      )
    ).toBe(false)
  })
})
