import { ModelProviderEnum } from '@shared/types'
import type { ProviderQuotaAdapter, ProviderQuotaSnapshot } from '@shared/providers/usage'
import { getPlanInfoForProvider, unknownQuota } from '@shared/providers/usage'
import {
  GEMINI_ANTIGRAVITY_API_BASE,
  buildAntigravityRequestHeaders,
} from '@shared/providers/oauth/gemini-antigravity-oauth'
import { defaultOAuthFetch } from '@shared/providers/oauth/desktop-http-fetch'
import { resolveAntigravityChatModelId } from '@shared/providers/oauth/gemini-antigravity-models'

async function fetchAntigravityCatalogHints(
  accessToken: string,
  projectId: string,
  signal?: AbortSignal
): Promise<Array<{ modelId: string; exhausted?: boolean; label?: string }>> {
  const fetchImpl = defaultOAuthFetch()
  const base = GEMINI_ANTIGRAVITY_API_BASE.replace(/\/+$/, '')
  const url = `${base}/v1internal:fetchAvailableModels`
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...buildAntigravityRequestHeaders(),
    },
    body: JSON.stringify({ project: projectId }),
    signal,
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Antigravity catalog failed: ${res.status}`)
  }
  let json: {
    models?: Record<string, { displayName?: string; quotaInfo?: { isExhausted?: boolean } }>
  }
  try {
    json = JSON.parse(text) as typeof json
  } catch {
    return []
  }
  const hints: Array<{ modelId: string; exhausted?: boolean; label?: string }> = []
  const seen = new Set<string>()
  for (const [rawId, info] of Object.entries(json.models ?? {})) {
    if (!/gemini/i.test(rawId)) continue
    const chatId = resolveAntigravityChatModelId(rawId)
    if (seen.has(chatId)) continue
    seen.add(chatId)
    hints.push({
      modelId: chatId,
      exhausted: info?.quotaInfo?.isExhausted === true,
      label: typeof info?.displayName === 'string' ? info.displayName : chatId,
    })
  }
  return hints
}

export const geminiAntigravityQuotaAdapter: ProviderQuotaAdapter = {
  id: 'gemini-antigravity',
  supports(providerId, settings) {
    if (providerId !== ModelProviderEnum.Gemini) return false
    return Boolean(settings.oauth?.accessToken || settings.apiKey)
  },
  getPlan(settings) {
    return getPlanInfoForProvider(ModelProviderEnum.Gemini, settings)
  },
  async fetchQuota({ settings, catalogHints, signal }): Promise<ProviderQuotaSnapshot> {
    if (settings.authMode !== 'oauth' && !settings.oauth?.accessToken) {
      return unknownQuota(
        'Google AI Studio usage is managed in Google Cloud / AI Studio. Remaining free-tier quota is not mirrored here.'
      )
    }

    let hints = catalogHints
    if ((!hints || hints.length === 0) && settings.oauth?.accessToken && settings.oauth?.projectId) {
      try {
        hints = await fetchAntigravityCatalogHints(
          settings.oauth.accessToken,
          settings.oauth.projectId,
          signal
        )
      } catch {
        // fall through to unknown
      }
    }

    if (hints && hints.length > 0) {
      const exhausted = hints.filter((m) => m.exhausted)
      if (exhausted.length > 0) {
        return {
          state: exhausted.length === hints.length ? 'exhausted' : 'partial',
          source: 'model-catalog',
          updatedAt: Date.now(),
          models: hints,
          detail:
            exhausted.length === hints.length
              ? 'All listed Antigravity models report exhausted quota.'
              : `${exhausted.length} model(s) report exhausted quota in the catalog.`,
        }
      }
      return {
        state: 'partial',
        source: 'model-catalog',
        updatedAt: Date.now(),
        models: hints,
        detail: 'Antigravity model catalog has no exhausted flags right now. Exact remaining % is not provided.',
      }
    }

    return unknownQuota(
      'Antigravity remaining quota % is not fully exposed. Sign in with project access to detect exhausted models. Local usage is measured in this app.'
    )
  },
  getLinks() {
    return {
      dashboardUrl: 'https://one.google.com/ai',
      docsUrl: 'https://ai.google.dev/gemini-api/docs',
    }
  },
}
