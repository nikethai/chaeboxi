import { describe, expect, it } from 'vitest'
import {
  findQwenPresetByApiHost,
  getDefaultQwenPreset,
  getQwenPreset,
  isQwenPlanId,
  isQwenRegion,
  listQwenPlansForRegion,
  QWEN_PLAN_PRESETS,
} from './qwen'

describe('qwen plan presets', () => {
  it('includes international Token Plan with official OpenAI-compatible host', () => {
    const preset = getQwenPreset('token-plan', 'international')
    expect(preset).toBeDefined()
    expect(preset!.apiHost).toBe(
      'https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1'
    )
    expect(preset!.isPlanKey).toBe(true)
    expect(preset!.models.length).toBeGreaterThan(0)
    expect(preset!.models.some((m) => m.modelId === 'qwen3.7-plus')).toBe(true)
  })

  it('includes international Coding Plan host from QwenCloud docs', () => {
    const preset = getQwenPreset('coding-plan', 'international')
    expect(preset!.apiHost).toBe('https://coding-intl.dashscope.aliyuncs.com/compatible-mode/v1')
  })

  it('includes international and China standard hosts', () => {
    expect(getQwenPreset('standard', 'international')!.apiHost).toBe(
      'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
    )
    expect(getQwenPreset('standard', 'china')!.apiHost).toBe(
      'https://dashscope.aliyuncs.com/compatible-mode/v1'
    )
  })

  it('defaults Token Plan region to international when region omitted', () => {
    const preset = getQwenPreset('token-plan')
    expect(preset?.region).toBe('international')
  })

  it('returns undefined for unknown plan', () => {
    expect(getQwenPreset('unknown')).toBeUndefined()
    expect(getQwenPreset(undefined)).toBeUndefined()
  })

  it('lists international plans without China-only entries', () => {
    const plans = listQwenPlansForRegion('international')
    expect(plans.map((p) => p.planId)).toEqual(['token-plan', 'coding-plan', 'standard'])
    expect(plans.every((p) => p.region === 'international')).toBe(true)
  })

  it('lists china plans as standard only', () => {
    const plans = listQwenPlansForRegion('china')
    expect(plans).toHaveLength(1)
    expect(plans[0].planId).toBe('standard')
  })

  it('default preset is Token Plan international', () => {
    const d = getDefaultQwenPreset()
    expect(d.planId).toBe('token-plan')
    expect(d.region).toBe('international')
  })

  it('type guards', () => {
    expect(isQwenPlanId('token-plan')).toBe(true)
    expect(isQwenPlanId('nope')).toBe(false)
    expect(isQwenRegion('international')).toBe(true)
    expect(isQwenRegion('eu')).toBe(false)
  })

  it('every preset has unique planId+region and non-empty models', () => {
    const keys = QWEN_PLAN_PRESETS.map((p) => `${p.planId}:${p.region}`)
    expect(new Set(keys).size).toBe(keys.length)
    for (const p of QWEN_PLAN_PRESETS) {
      expect(p.apiHost.startsWith('https://')).toBe(true)
      expect(p.models.length).toBeGreaterThan(0)
    }
  })

  it('finds preset by apiHost with optional trailing slash', () => {
    const host = 'https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1'
    expect(findQwenPresetByApiHost(host)?.planId).toBe('token-plan')
    expect(findQwenPresetByApiHost(`${host}/`)?.planId).toBe('token-plan')
    expect(findQwenPresetByApiHost('https://example.com')).toBeUndefined()
  })
})
