import { describe, expect, it } from 'vitest'
import { buildComfyUIWorkflow, COMFYUI_WILDCARD_PLACEHOLDER } from './comfyui-workflow'

describe('buildComfyUIWorkflow', () => {
  it('uses the ComfyUI wildcard placeholder expected by the server', () => {
    const workflow = buildComfyUIWorkflow({
      checkpoint: 'waiNSFWIllustrious_v140.safetensors',
      lora: 'none',
      prompt: '1girl',
    })

    expect(workflow['22'].inputs['Select to add Wildcard']).toBe(COMFYUI_WILDCARD_PLACEHOLDER)
  })

  it('chains multiple loras with separate model and clip strengths', () => {
    const workflow = buildComfyUIWorkflow({
      checkpoint: 'waiNSFWIllustrious_v140.safetensors',
      loras: [
        {
          name: 'style-a.safetensors',
          strengthModel: 0.8,
          strengthClip: 0.3,
        },
        {
          name: 'style-b.safetensors',
          strengthModel: 1.1,
          strengthClip: 0.9,
        },
      ],
      prompt: '1girl',
    })

    expect(workflow['58'].inputs).toMatchObject({
      lora_name: 'style-a.safetensors',
      strength_model: 0.8,
      strength_clip: 0.3,
      model: ['4', 0],
      clip: ['4', 1],
    })
    expect(workflow['59'].inputs).toMatchObject({
      lora_name: 'style-b.safetensors',
      strength_model: 1.1,
      strength_clip: 0.9,
      model: ['58', 0],
      clip: ['58', 1],
    })
    expect(workflow['22'].inputs.model).toEqual(['59', 0])
    expect(workflow['22'].inputs.clip).toEqual(['59', 1])
    expect(workflow['7'].inputs.clip).toEqual(['59', 1])
  })

  it('uses legacy single-lora strength for both model and clip', () => {
    const workflow = buildComfyUIWorkflow({
      checkpoint: 'waiNSFWIllustrious_v140.safetensors',
      lora: 'legacy-style.safetensors',
      loraStrength: 0.65,
      prompt: '1girl',
    })

    expect(workflow['58'].inputs).toMatchObject({
      lora_name: 'legacy-style.safetensors',
      strength_model: 0.65,
      strength_clip: 0.65,
    })
    expect(workflow['7'].inputs.clip).toEqual(['58', 1])
  })

  it('bypasses lora nodes when no loras are configured', () => {
    const workflow = buildComfyUIWorkflow({
      checkpoint: 'waiNSFWIllustrious_v140.safetensors',
      loras: [],
      prompt: '1girl',
    })

    expect(workflow['58']).toBeUndefined()
    expect(workflow['22'].inputs.model).toEqual(['4', 0])
    expect(workflow['22'].inputs.clip).toEqual(['4', 1])
    expect(workflow['7'].inputs.clip).toEqual(['4', 1])
  })
})
