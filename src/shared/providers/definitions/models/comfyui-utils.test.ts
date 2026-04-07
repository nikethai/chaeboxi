import { describe, expect, it } from 'vitest'
import { resolveComfyUIOption } from './comfyui-utils'

describe('resolveComfyUIOption', () => {
  it('returns exact matches unchanged', () => {
    expect(resolveComfyUIOption('waiNSFWIllustrious_v140.safetensors', ['waiNSFWIllustrious_v140.safetensors'])).toBe(
      'waiNSFWIllustrious_v140.safetensors',
    )
  })

  it('resolves checkpoint names without file extensions', () => {
    expect(
      resolveComfyUIOption('waiNSFWIllustrious_v140', [
        'JANKUTrainedNoobaiRouwei_v69.safetensors',
        'waiNSFWIllustrious_v140.safetensors',
      ]),
    ).toBe('waiNSFWIllustrious_v140.safetensors')
  })

  it('keeps the original value when basename matches are ambiguous', () => {
    expect(
      resolveComfyUIOption('model-a', ['model-a.safetensors', 'model-a.ckpt']),
    ).toBe('model-a')
  })
})
