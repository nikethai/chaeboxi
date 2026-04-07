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
})
