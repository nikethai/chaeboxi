/**
 * Live ChatGPT / Codex (WHAM) model catalog via GET /models?client_version=…
 */

import type { ProviderModelInfo } from '../../types'
import { defaultOAuthFetch } from '../../utils/desktop-http-fetch'
import {
  humanizeOpenAICodexOAuthNetworkError,
  OPENAI_CODEX_WHAM_API_BASE,
  OpenAICodexOAuthError,
} from './openai-codex-oauth'

/** Seed models when remote list fails or before first sign-in */
export const OPENAI_CODEX_DEFAULT_MODELS: ProviderModelInfo[] = [
  {
    modelId: 'gpt-5.6-sol',
    nickname: 'GPT-5.6 Sol',
    capabilities: ['vision', 'tool_use', 'reasoning'],
    contextWindow: 272_000,
  },
  {
    modelId: 'gpt-5.6-terra',
    nickname: 'GPT-5.6 Terra',
    capabilities: ['vision', 'tool_use', 'reasoning'],
    contextWindow: 272_000,
  },
  {
    modelId: 'gpt-5.6-luna',
    nickname: 'GPT-5.6 Luna',
    capabilities: ['vision', 'tool_use', 'reasoning'],
    contextWindow: 272_000,
  },
  {
    modelId: 'gpt-5.5',
    nickname: 'GPT-5.5',
    capabilities: ['vision', 'tool_use', 'reasoning'],
    contextWindow: 272_000,
  },
  {
    modelId: 'gpt-5.4',
    nickname: 'GPT-5.4',
    capabilities: ['vision', 'tool_use', 'reasoning'],
    contextWindow: 128_000,
  },
  {
    modelId: 'gpt-5.4-mini',
    nickname: 'GPT-5.4 Mini',
    capabilities: ['vision', 'tool_use'],
    contextWindow: 128_000,
  },
]

const CAPABILITY_HINTS: Array<{ match: RegExp; capabilities: NonNullable<ProviderModelInfo['capabilities']> }> = [
  { match: /reason|sol|terra|luna|codex|o\d/i, capabilities: ['reasoning', 'tool_use'] },
  { match: /vision|image/i, capabilities: ['vision'] },
]

function inferCapabilities(modelId: string): ProviderModelInfo['capabilities'] {
  const caps = new Set<NonNullable<ProviderModelInfo['capabilities']>[number]>()
  for (const hint of CAPABILITY_HINTS) {
    if (hint.match.test(modelId)) {
      for (const c of hint.capabilities) caps.add(c)
    }
  }
  if (!/image|video|tts|voice|embed|whisper|transcri|review/i.test(modelId)) {
    caps.add('tool_use')
    caps.add('vision')
  }
  return caps.size ? Array.from(caps) : undefined
}

type WhamModelsJson = {
  models?: Array<{
    slug?: string
    id?: string
    display_name?: string
    displayName?: string
  }>
}

/**
 * Fetch subscription model catalog from WHAM.
 */
export async function fetchOpenAICodexModels(
  bearerToken: string,
  options: {
    fetchImpl?: typeof fetch
    apiBase?: string
    accountId?: string
    clientVersion?: string
  } = {}
): Promise<ProviderModelInfo[]> {
  if (!bearerToken) {
    throw new OpenAICodexOAuthError('Missing ChatGPT credentials for model list.', 'not_signed_in')
  }

  const fetchImpl = options.fetchImpl || defaultOAuthFetch()
  const base = (options.apiBase || OPENAI_CODEX_WHAM_API_BASE).replace(/\/+$/, '')
  const version = options.clientVersion || 'chaeboxi'
  const url = `${base}/models?client_version=${encodeURIComponent(version)}`

  const headers: Record<string, string> = {
    Authorization: `Bearer ${bearerToken}`,
    Accept: 'application/json',
  }
  if (options.accountId) {
    headers['ChatGPT-Account-Id'] = options.accountId
  }

  let res: Response
  try {
    res = await fetchImpl(url, { method: 'GET', headers })
  } catch (err) {
    throw new OpenAICodexOAuthError(humanizeOpenAICodexOAuthNetworkError(err), 'network_error')
  }

  const text = await res.text()
  let json: WhamModelsJson | undefined
  try {
    json = JSON.parse(text) as WhamModelsJson
  } catch {
    json = undefined
  }

  if (!res.ok) {
    const msg =
      (json && typeof json === 'object' && 'error' in (json as object)
        ? JSON.stringify((json as { error?: unknown }).error)
        : undefined) || text.slice(0, 200) || `Model list failed (${res.status})`
    throw new OpenAICodexOAuthError(msg, 'models_failed', res.status)
  }

  const rows = json?.models || []
  const models: ProviderModelInfo[] = []
  for (const row of rows) {
    const modelId = row.slug || row.id
    if (!modelId || typeof modelId !== 'string') continue
    // Skip internal / non-chat tools
    if (/auto-review|embed|whisper|tts/i.test(modelId)) continue
    models.push({
      modelId,
      nickname: row.display_name || row.displayName || modelId,
      capabilities: inferCapabilities(modelId),
    })
  }
  return models
}

/**
 * Merge remote WHAM models into existing provider model list.
 */
export function mergeOpenAICodexModels(
  existing: ProviderModelInfo[] | undefined,
  remote: ProviderModelInfo[],
  options: { replaceAll?: boolean } = {}
): ProviderModelInfo[] {
  if (options.replaceAll || !existing?.length) {
    return remote.length ? remote : OPENAI_CODEX_DEFAULT_MODELS
  }
  const byId = new Map(existing.map((m) => [m.modelId, m]))
  for (const m of remote) {
    const prev = byId.get(m.modelId)
    byId.set(m.modelId, prev ? { ...prev, ...m, nickname: m.nickname || prev.nickname } : m)
  }
  return Array.from(byId.values())
}
