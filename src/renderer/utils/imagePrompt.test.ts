import type { ProviderSettings } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { composeImageGenerationPrompt } from './imagePrompt'

function makeProviderSettings(overrides: Partial<ProviderSettings> = {}): ProviderSettings {
  return {
    ...overrides,
  }
}

describe('composeImageGenerationPrompt', () => {
  it('returns the raw prompt when both prepend fields are empty', () => {
    expect(composeImageGenerationPrompt(makeProviderSettings(), 'sunset city skyline')).toBe('sunset city skyline')
  })

  it('prepends only the character fragment when present', () => {
    expect(
      composeImageGenerationPrompt(
        makeProviderSettings({
          imagePromptCharacterPrepend: '1girl, blue hair, school uniform',
        }),
        'standing in the rain',
      ),
    ).toBe('1girl, blue hair, school uniform, standing in the rain')
  })

  it('prepends only the positive tags fragment when present', () => {
    expect(
      composeImageGenerationPrompt(
        makeProviderSettings({
          imagePromptPositiveTagsPrepend: 'masterpiece, best quality',
        }),
        'forest shrine at dusk',
      ),
    ).toBe('masterpiece, best quality, forest shrine at dusk')
  })

  it('prepends both fragments in the expected order', () => {
    expect(
      composeImageGenerationPrompt(
        makeProviderSettings({
          imagePromptCharacterPrepend: '1girl, silver hair',
          imagePromptPositiveTagsPrepend: 'masterpiece, soft lighting',
        }),
        'looking at the viewer',
      ),
    ).toBe('1girl, silver hair, masterpiece, soft lighting, looking at the viewer')
  })

  it('drops whitespace-only values', () => {
    expect(
      composeImageGenerationPrompt(
        makeProviderSettings({
          imagePromptCharacterPrepend: '   ',
          imagePromptPositiveTagsPrepend: '\n\t',
        }),
        'portrait',
      ),
    ).toBe('portrait')
  })

  it('trims surrounding commas and spaces while preserving internal commas', () => {
    expect(
      composeImageGenerationPrompt(
        makeProviderSettings({
          imagePromptCharacterPrepend: ' , 1girl, blue eyes, ',
          imagePromptPositiveTagsPrepend: ', masterpiece, best quality , ',
        }),
        '  dramatic close-up  ',
      ),
    ).toBe('1girl, blue eyes, masterpiece, best quality, dramatic close-up')
  })
})
