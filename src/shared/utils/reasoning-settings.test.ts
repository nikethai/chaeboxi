import { describe, expect, it } from 'vitest'
import { settings as getDefaultSettings } from '../defaults'
import type { SessionSettings } from '../types'
import { applyOpenAIReasoningEffort, getReasoningDropdownValue } from './reasoning-settings'

describe('reasoning settings helpers', () => {
  it('reads the default global reasoning effort as a dropdown value', () => {
    const settings = getDefaultSettings()
    expect(getReasoningDropdownValue(settings)).toBe('medium')
  })

  it('maps undefined reasoning effort to the disabled dropdown option', () => {
    const session: SessionSettings = {
      provider: 'openai',
      modelId: 'gpt-4o',
    }
    expect(getReasoningDropdownValue(session)).toBe('null')
  })

  it('applies a selected reasoning effort while preserving other provider options', () => {
    const session: SessionSettings = {
      provider: 'openai',
      modelId: 'gpt-4o',
      providerOptions: {
        google: {
          thinkingConfig: {
            thinkingBudget: 2048,
            includeThoughts: true,
          },
        },
      },
    }

    expect(applyOpenAIReasoningEffort(session, 'high')).toEqual({
      google: {
        thinkingConfig: {
          thinkingBudget: 2048,
          includeThoughts: true,
        },
      },
      openai: {
        reasoningEffort: 'high',
      },
    })
  })

  it('clears the openai reasoning effort when the disabled option is selected', () => {
    const settings = getDefaultSettings()
    expect(applyOpenAIReasoningEffort(settings, 'null')).toEqual({
      openai: {
        reasoningEffort: undefined,
      },
    })
  })
})
