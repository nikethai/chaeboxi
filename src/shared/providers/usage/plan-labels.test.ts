import { describe, expect, it } from 'vitest'
import { ModelProviderEnum } from '../../types/provider'
import { getPlanInfoForProvider, labelCodexPlanType, labelGeminiPlanType } from './plan-labels'

describe('plan labels', () => {
  it('labels Codex plan types', () => {
    expect(labelCodexPlanType('pro')).toBe('ChatGPT Pro')
    expect(labelCodexPlanType('plus')).toBe('ChatGPT Plus')
    expect(labelCodexPlanType(undefined)).toContain('ChatGPT')
  })

  it('labels Gemini plan types', () => {
    expect(labelGeminiPlanType('ultra')).toBe('Antigravity Ultra')
  })

  it('builds OpenAI OAuth plan info', () => {
    const plan = getPlanInfoForProvider(ModelProviderEnum.OpenAI, {
      authMode: 'oauth',
      oauth: { accessToken: 'tok', planType: 'pro', accountId: 'acct_12345678' },
    })
    expect(plan?.label).toBe('ChatGPT Pro')
    expect(plan?.authMode).toBe('oauth')
  })

  it('builds Qwen plan info from planId', () => {
    const plan = getPlanInfoForProvider(ModelProviderEnum.Qwen, {
      planId: 'coding-plan',
      region: 'international',
      apiKey: 'sk-sp-test',
    })
    expect(plan?.label).toBe('Coding Plan')
    expect(plan?.planId).toBe('coding-plan')
  })

  it('builds SuperGrok OAuth plan info', () => {
    const plan = getPlanInfoForProvider(ModelProviderEnum.XAI, {
      authMode: 'oauth',
      oauth: { accessToken: 'tok' },
    })
    expect(plan?.label).toBe('SuperGrok')
  })
})
