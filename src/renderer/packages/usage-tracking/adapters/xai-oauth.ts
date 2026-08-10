import { ModelProviderEnum } from '@shared/types'
import type { ProviderQuotaAdapter } from '@shared/providers/usage'
import { getPlanInfoForProvider, unknownQuota } from '@shared/providers/usage'

export const xaiOAuthQuotaAdapter: ProviderQuotaAdapter = {
  id: 'xai-oauth',
  supports(providerId, settings) {
    if (providerId !== ModelProviderEnum.XAI) return false
    return Boolean(settings.oauth?.accessToken || settings.apiKey)
  },
  getPlan(settings) {
    return getPlanInfoForProvider(ModelProviderEnum.XAI, settings)
  },
  async fetchQuota({ settings }) {
    if (settings.authMode === 'oauth' || settings.oauth?.accessToken) {
      return unknownQuota(
        'SuperGrok remaining quota is not exposed via a stable public API. Exhausted status is set when the provider returns a quota error. Local usage is measured in this app.'
      )
    }
    return unknownQuota(
      'xAI API usage is available on console.x.ai. Local usage below is this app only.'
    )
  },
  getLinks(settings) {
    if (settings.authMode === 'oauth' || settings.oauth?.accessToken) {
      return {
        dashboardUrl: 'https://console.x.ai/',
        docsUrl: 'https://docs.x.ai/',
      }
    }
    return {
      dashboardUrl: 'https://console.x.ai/',
      docsUrl: 'https://docs.x.ai/docs',
    }
  },
}
