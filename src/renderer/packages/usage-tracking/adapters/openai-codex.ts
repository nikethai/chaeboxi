import { ModelProviderEnum } from '@shared/types'
import type { ProviderQuotaAdapter } from '@shared/providers/usage'
import { getPlanInfoForProvider, unknownQuota } from '@shared/providers/usage'

export const openaiCodexQuotaAdapter: ProviderQuotaAdapter = {
  id: 'openai-codex',
  supports(providerId, settings) {
    if (providerId !== ModelProviderEnum.OpenAI && providerId !== ModelProviderEnum.OpenAIResponses) {
      return false
    }
    return Boolean(settings.oauth?.accessToken || settings.apiKey)
  },
  getPlan(settings) {
    return getPlanInfoForProvider(ModelProviderEnum.OpenAI, settings)
  },
  async fetchQuota({ settings }) {
    // No stable public remaining-quota API for ChatGPT Plus/Pro via Codex OAuth.
    // Rate-limit headers (if captured later) would yield partial known RPM/TPM — not subscription %.
    if (settings.authMode === 'oauth' || settings.oauth?.accessToken) {
      return unknownQuota(
        'ChatGPT subscription remaining quota is not exposed via a stable public API. Local usage below is measured in this app only. Exhausted status is set when the provider returns a quota error.'
      )
    }
    return unknownQuota(
      'OpenAI Platform usage is shown on platform.openai.com. Rate limits may appear after requests; subscription meters are not available here.'
    )
  },
  getLinks(settings) {
    if (settings.authMode === 'oauth' || settings.oauth?.accessToken) {
      return {
        dashboardUrl: 'https://chatgpt.com/',
        docsUrl: 'https://help.openai.com/en/articles/6950777-what-is-chatgpt-plus',
      }
    }
    return {
      dashboardUrl: 'https://platform.openai.com/usage',
      docsUrl: 'https://platform.openai.com/docs/guides/rate-limits',
    }
  },
}
