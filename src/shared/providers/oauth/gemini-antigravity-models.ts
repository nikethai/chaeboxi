/**
 * Antigravity / Cloud Code Assist model catalog + chat model ID resolution.
 *
 * Cloud Code Assist model IDs differ from AI Studio. Wrong IDs → 404 NOT_FOUND.
 * Rules (from OpenCode antigravity-auth model-resolver):
 * - Gemini 3 Pro on Antigravity needs tier suffix: gemini-3-pro-low / gemini-3-pro-high
 * - Gemini 3 Flash uses bare name gemini-3-flash (+ thinkingLevel in config)
 * - gemini-3-*-preview is Gemini CLI style; map to Antigravity names
 */

import type { ProviderModelInfo } from '../../types'
import { defaultOAuthFetch } from '../../utils/desktop-http-fetch'
import {
  buildAntigravityRequestHeaders,
  GEMINI_ANTIGRAVITY_API_BASE,
  GeminiAntigravityOAuthError,
  humanizeGeminiAntigravityOAuthNetworkError,
} from './gemini-antigravity-oauth'

/**
 * Curated Antigravity chat models (gateway IDs that streamGenerateContent accepts).
 */
export const GEMINI_ANTIGRAVITY_DEFAULT_MODELS: ProviderModelInfo[] = [
  {
    modelId: 'gemini-3-flash',
    nickname: 'Gemini 3 Flash (Antigravity)',
    capabilities: ['vision', 'reasoning', 'tool_use'],
    contextWindow: 1_000_000,
    maxOutput: 65_536,
  },
  {
    modelId: 'gemini-3-pro-low',
    nickname: 'Gemini 3 Pro Low (Antigravity)',
    capabilities: ['vision', 'reasoning', 'tool_use'],
    contextWindow: 1_000_000,
    maxOutput: 65_535,
  },
  {
    modelId: 'gemini-3-pro-high',
    nickname: 'Gemini 3 Pro High (Antigravity)',
    capabilities: ['vision', 'reasoning', 'tool_use'],
    contextWindow: 1_000_000,
    maxOutput: 65_535,
  },
  {
    modelId: 'gemini-2.5-flash',
    nickname: 'Gemini 2.5 Flash (Antigravity)',
    capabilities: ['vision', 'reasoning', 'tool_use'],
    contextWindow: 1_000_000,
    maxOutput: 65_536,
  },
  {
    modelId: 'gemini-2.5-pro',
    nickname: 'Gemini 2.5 Pro (Antigravity)',
    capabilities: ['vision', 'reasoning', 'tool_use'],
    contextWindow: 1_000_000,
    maxOutput: 65_536,
  },
]

const TIER_SUFFIX = /-(minimal|low|medium|high)$/i

/**
 * Map catalog / Studio / marketing IDs → Antigravity streamGenerateContent model field.
 */
export function resolveAntigravityChatModelId(modelId: string): string {
  let id = (modelId || '').trim()
  if (!id) return 'gemini-2.5-flash'

  id = id
    .replace(/^google\//i, '')
    .replace(/^models\//, '')
    .replace(/^antigravity-/i, '')
    .trim()

  const lower = id.toLowerCase()

  // Image models: only pro-image family is known on Antigravity
  if (/image|imagen/i.test(lower) && !/gemini-3.*pro.*image/i.test(lower)) {
    // Keep as-is; will 404 if unsupported — better than silent remaps to flash
    return id
  }

  // Gemini 3.x Flash (3, 3.1, 3.6, …) → bare gemini-3-flash (+ thinkingLevel in body)
  if (/^gemini-3(\.\d+)?-flash/i.test(lower)) {
    const tier = lower.match(TIER_SUFFIX)?.[1]
    // Flash: strip tier from model name (tier becomes thinkingLevel)
    if (tier) return 'gemini-3-flash'
    if (lower.includes('preview')) return 'gemini-3-flash'
    if (lower === 'gemini-3-flash') return 'gemini-3-flash'
    // gemini-3.6-flash → gemini-3-flash
    return 'gemini-3-flash'
  }

  // Gemini 3.x Pro → must include -low / -high for Antigravity API
  if (/^gemini-3(\.\d+)?-pro/i.test(lower)) {
    if (/-(low|high)$/i.test(lower)) {
      // Normalize gemini-3.1-pro-high → gemini-3-pro-high (API often wants unversioned base)
      if (/^gemini-3\.\d+-pro-(low|high)$/i.test(lower)) {
        const tier = lower.endsWith('high') ? 'high' : 'low'
        return `gemini-3-pro-${tier}`
      }
      return lower.replace(/^gemini-3\.\d+-pro/i, 'gemini-3-pro')
    }
    // preview / bare pro → default low
    return 'gemini-3-pro-low'
  }

  // Gemini 2.x pass-through (common CLI ids)
  if (/^gemini-2/i.test(lower)) {
    return id.replace(/-preview$/i, '') || id
  }

  return id
}

/** Thinking level for Gemini 3 request generationConfig (OpenCode convention). */
export function resolveAntigravityThinkingLevel(modelId: string): 'minimal' | 'low' | 'medium' | 'high' | undefined {
  const lower = (modelId || '').toLowerCase()
  if (!lower.includes('gemini-3')) return undefined
  const tier = lower.match(TIER_SUFFIX)?.[1]?.toLowerCase()
  if (tier === 'minimal' || tier === 'low' || tier === 'medium' || tier === 'high') {
    return tier
  }
  // Flash / Pro without tier: default low
  return 'low'
}

function isGeminiModelId(id: string): boolean {
  const lower = id.toLowerCase()
  if (lower.includes('claude') || lower.includes('opus') || lower.includes('sonnet')) return false
  if (lower.includes('gpt-oss') || lower.includes('gpt_oss')) return false
  return lower.includes('gemini') || lower.startsWith('antigravity-gemini')
}

function normalizeCatalogModelId(id: string): string {
  return id
    .replace(/^google\//i, '')
    .replace(/^models\//, '')
    .replace(/^antigravity-/i, '')
    .trim()
}

function inferCapabilities(modelId: string): ProviderModelInfo['capabilities'] {
  const caps = new Set<NonNullable<ProviderModelInfo['capabilities']>[number]>()
  caps.add('vision')
  caps.add('tool_use')
  if (/pro|reason|think|high|low|flash/i.test(modelId)) caps.add('reasoning')
  return Array.from(caps)
}

/**
 * Fetch available models from Cloud Code Assist (Gemini family only).
 * Catalog may list more models than streamGenerateContent accepts; chat still
 * remaps via resolveAntigravityChatModelId.
 */
export async function fetchGeminiAntigravityModels(
  accessToken: string,
  projectId: string,
  options: {
    fetchImpl?: typeof fetch
    apiBase?: string
  } = {}
): Promise<ProviderModelInfo[]> {
  if (!accessToken) {
    throw new GeminiAntigravityOAuthError('Missing Google credentials for model list.', 'not_signed_in')
  }
  if (!projectId) {
    throw new GeminiAntigravityOAuthError('Missing Cloud Code project id.', 'missing_project')
  }

  const fetchImpl = options.fetchImpl || defaultOAuthFetch()
  const base = (options.apiBase || GEMINI_ANTIGRAVITY_API_BASE).replace(/\/+$/, '')
  const url = `${base}/v1internal:fetchAvailableModels`

  let res: Response
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...buildAntigravityRequestHeaders(),
      },
      body: JSON.stringify({ project: projectId }),
    })
  } catch (err) {
    throw new GeminiAntigravityOAuthError(humanizeGeminiAntigravityOAuthNetworkError(err), 'network_error')
  }

  const text = await res.text()
  let json:
    | {
        models?: Record<
          string,
          {
            displayName?: string
            quotaInfo?: { isExhausted?: boolean }
          }
        >
      }
    | undefined
  try {
    json = JSON.parse(text) as typeof json
  } catch {
    json = undefined
  }

  if (!res.ok) {
    throw new GeminiAntigravityOAuthError(
      `Failed to list Antigravity models: ${text || res.status}`,
      'models_failed',
      res.status
    )
  }

  const entries = json?.models && typeof json.models === 'object' ? Object.entries(json.models) : []
  const models: ProviderModelInfo[] = []
  const seen = new Set<string>()

  for (const [rawId, info] of entries) {
    if (!isGeminiModelId(rawId)) continue
    const catalogId = normalizeCatalogModelId(rawId)
    if (!catalogId || seen.has(catalogId)) continue
    if (info?.quotaInfo?.isExhausted === true) continue

    // Prefer chat-ready id so picker shows what we will actually send
    const chatId = resolveAntigravityChatModelId(catalogId)
    if (seen.has(chatId)) continue
    seen.add(catalogId)
    seen.add(chatId)

    const display =
      (typeof info?.displayName === 'string' && info.displayName.trim()) || catalogId
    models.push({
      modelId: chatId,
      nickname: display.includes('Antigravity') ? display : `${display} (Antigravity)`,
      type: 'chat',
      capabilities: inferCapabilities(chatId),
    })
  }

  return models
}

/**
 * After oauth login: remote catalog wins; never keep AI Studio-only lists.
 */
export function resolveModelsAfterAntigravityLogin(
  remote: ProviderModelInfo[] | undefined,
  _previous: ProviderModelInfo[] | undefined
): ProviderModelInfo[] {
  if (remote && remote.length > 0) {
    // De-dupe by chat model id
    const byId = new Map<string, ProviderModelInfo>()
    for (const m of remote) {
      const id = resolveAntigravityChatModelId(m.modelId)
      if (!byId.has(id)) {
        byId.set(id, { ...m, modelId: id })
      }
    }
    return Array.from(byId.values())
  }
  return GEMINI_ANTIGRAVITY_DEFAULT_MODELS.map((m) => ({ ...m }))
}

export function mergeGeminiAntigravityModels(
  existing: ProviderModelInfo[] | undefined,
  remote: ProviderModelInfo[],
  options: { replaceAll?: boolean } = {}
): ProviderModelInfo[] {
  if (options.replaceAll || !existing?.length) {
    return remote.length ? remote : GEMINI_ANTIGRAVITY_DEFAULT_MODELS.map((m) => ({ ...m }))
  }

  const byId = new Map<string, ProviderModelInfo>()
  for (const m of existing) byId.set(m.modelId, m)
  for (const m of remote) {
    const prev = byId.get(m.modelId)
    byId.set(m.modelId, prev ? { ...prev, ...m, nickname: m.nickname || prev.nickname } : m)
  }
  return Array.from(byId.values())
}
