import { ModelProviderEnum } from '@shared/types'
import { getQwenPreset } from '@shared/providers/plan-presets/qwen'
import type { ProviderQuotaAdapter } from '@shared/providers/usage'
import { getPlanInfoForProvider, unknownQuota } from '@shared/providers/usage'

export const qwenPlanQuotaAdapter: ProviderQuotaAdapter = {
  id: 'qwen-plan',
  supports(providerId) {
    return providerId === ModelProviderEnum.Qwen
  },
  getPlan(settings) {
    return getPlanInfoForProvider(ModelProviderEnum.Qwen, settings)
  },
  async fetchQuota({ settings }) {
    const planId = settings.planId
    const region = settings.region
    const preset = planId
      ? getQwenPreset(
          planId,
          (region as 'international' | 'china') || 'international'
        )
      : undefined

    if (planId === 'coding-plan' || planId === 'token-plan') {
      return unknownQuota(
        `${preset?.name ?? 'Qwen plan'} remaining quota is managed on QwenCloud. No stable public remaining-quota API is wired here; local usage below is this app only.`
      )
    }

    return unknownQuota(
      'Qwen pay-as-you-go usage is billed on QwenCloud / Model Studio. Local usage below is this app only.'
    )
  },
  getLinks(settings) {
    const preset = settings.planId
      ? getQwenPreset(
          settings.planId,
          (settings.region as 'international' | 'china') || 'international'
        )
      : undefined
    return {
      dashboardUrl: preset?.apiKeysUrl ?? 'https://home.qwencloud.com/api-keys',
      docsUrl: preset?.docsUrl ?? 'https://docs.qwencloud.com/',
    }
  },
}
