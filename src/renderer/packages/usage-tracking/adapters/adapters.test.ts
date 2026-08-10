import { describe, expect, it } from 'vitest'
import { ModelProviderEnum } from '@shared/types'
import { clearQuotaAdapters, findQuotaAdapter } from '@shared/providers/usage'
import { ensureQuotaAdaptersRegistered } from './index'
import { openaiCodexQuotaAdapter } from './openai-codex'
import { geminiAntigravityQuotaAdapter } from './gemini-antigravity'
import { qwenPlanQuotaAdapter } from './qwen-plan'
import { defaultQuotaAdapter } from './default'

describe('quota adapters', () => {
  it('registers specialized adapters', () => {
    clearQuotaAdapters()
    ensureQuotaAdaptersRegistered()
    const openai = findQuotaAdapter(ModelProviderEnum.OpenAI, {
      authMode: 'oauth',
      oauth: { accessToken: 'x' },
    })
    expect(openai?.id).toBe('openai-codex')

    const gemini = findQuotaAdapter(ModelProviderEnum.Gemini, {
      authMode: 'oauth',
      oauth: { accessToken: 'x' },
    })
    expect(gemini?.id).toBe('gemini-antigravity')

    const qwen = findQuotaAdapter(ModelProviderEnum.Qwen, { apiKey: 'k' })
    expect(qwen?.id).toBe('qwen-plan')

    const other = findQuotaAdapter(ModelProviderEnum.DeepSeek, { apiKey: 'k' })
    expect(other?.id).toBe('default')
  })

  it('openai adapter returns unknown (not fake %)', async () => {
    const q = await openaiCodexQuotaAdapter.fetchQuota({
      settings: { authMode: 'oauth', oauth: { accessToken: 't', planType: 'pro' } },
    })
    expect(q.state).toBe('unknown')
    expect(q.used).toBeUndefined()
    expect(q.limit).toBeUndefined()
  })

  it('gemini adapter uses catalog exhausted flags', async () => {
    const q = await geminiAntigravityQuotaAdapter.fetchQuota({
      settings: { authMode: 'oauth', oauth: { accessToken: 't' } },
      catalogHints: [
        { modelId: 'gemini-3-flash', exhausted: true },
        { modelId: 'gemini-2.5-pro', exhausted: false },
      ],
    })
    expect(q.state).toBe('partial')
    expect(q.source).toBe('model-catalog')
  })

  it('qwen adapter exposes plan identity via getPlan', () => {
    const plan = qwenPlanQuotaAdapter.getPlan({
      planId: 'token-plan',
      region: 'international',
      apiKey: 'sk',
    })
    expect(plan?.label).toBe('Token Plan')
  })

  it('default adapter is unsupported', async () => {
    const q = await defaultQuotaAdapter.fetchQuota({ settings: {} })
    expect(q.state).toBe('unsupported')
  })
})
