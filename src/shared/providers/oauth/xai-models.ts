/**
 * Live xAI model catalog via GET /v1/models (OAuth or API key bearer).
 * Uses desktop-aware fetch so Tauri webview is not blocked by CORS.
 */

import type { ProviderModelInfo } from '../../types'
import { defaultOAuthFetch } from '../../utils/desktop-http-fetch'
import { humanizeOAuthNetworkError, XAI_API_BASE, XaiOAuthError } from './xai-oauth'

/** Known capability seeds for popular Grok model id patterns */
const CAPABILITY_HINTS: Array<{ match: RegExp; capabilities: NonNullable<ProviderModelInfo['capabilities']> }> = [
  { match: /reason/i, capabilities: ['reasoning', 'tool_use'] },
  { match: /vision|image/i, capabilities: ['vision'] },
  { match: /build|code/i, capabilities: ['tool_use'] },
]

function inferCapabilities(modelId: string): ProviderModelInfo['capabilities'] {
  const caps = new Set<NonNullable<ProviderModelInfo['capabilities']>[number]>()
  for (const hint of CAPABILITY_HINTS) {
    if (hint.match.test(modelId)) {
      for (const c of hint.capabilities) caps.add(c)
    }
  }
  // Most chat Grok models support tools; don't force if image-only / voice-only ids
  if (!/image|video|tts|voice|embed|whisper|transcri/i.test(modelId)) {
    caps.add('tool_use')
  }
  return caps.size ? Array.from(caps) : undefined
}

type ModelsListJson = {
  data?: Array<{
    id?: string
    object?: string
    created?: number
    owned_by?: string
  }>
}

/**
 * Fetch model ids from xAI and map to ProviderModelInfo.
 */
export async function fetchXaiModels(
  bearerToken: string,
  options: {
    fetchImpl?: typeof fetch
    apiBase?: string
  } = {}
): Promise<ProviderModelInfo[]> {
  if (!bearerToken) {
    throw new XaiOAuthError('Missing xAI credentials for model list.', 'not_signed_in')
  }

  const fetchImpl = options.fetchImpl || defaultOAuthFetch()
  const base = (options.apiBase || XAI_API_BASE).replace(/\/+$/, '')
  const url = `${base}/models`

  let res: Response
  try {
    res = await fetchImpl(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        Accept: 'application/json',
      },
    })
  } catch (err) {
    throw new XaiOAuthError(humanizeOAuthNetworkError(err), 'network_error')
  }

  const text = await res.text()
  let json: ModelsListJson | undefined
  try {
    json = JSON.parse(text) as ModelsListJson
  } catch {
    json = undefined
  }

  if (!res.ok) {
    const msg =
      json && typeof json === 'object' && 'error' in (json as object)
        ? String((json as { error?: { message?: string } }).error?.message || text)
        : text || `HTTP ${res.status}`
    throw new XaiOAuthError(`Failed to list xAI models: ${msg}`, 'models_failed', res.status)
  }

  const data = Array.isArray(json?.data) ? json!.data! : []
  const models: ProviderModelInfo[] = []
  const seen = new Set<string>()

  for (const item of data) {
    const id = typeof item?.id === 'string' ? item.id.trim() : ''
    if (!id || seen.has(id)) continue
    seen.add(id)
    models.push({
      modelId: id,
      type: 'chat',
      capabilities: inferCapabilities(id),
    })
  }

  // Prefer stable sort: reasoning/build first, then alpha
  models.sort((a, b) => {
    const score = (id: string) => {
      if (/build/i.test(id)) return 0
      if (/reason/i.test(id)) return 1
      if (/fast/i.test(id)) return 2
      return 3
    }
    const d = score(a.modelId) - score(b.modelId)
    return d !== 0 ? d : a.modelId.localeCompare(b.modelId)
  })

  return models
}

/**
 * Merge remote catalog into local list: keep local nickname/capabilities when same id,
 * append new remote models, drop nothing unless replaceAll.
 */
export function mergeXaiModels(
  local: ProviderModelInfo[] | undefined,
  remote: ProviderModelInfo[],
  options: { replaceAll?: boolean } = {}
): ProviderModelInfo[] {
  if (options.replaceAll || !local?.length) {
    // Keep user nicknames when replacing if same id exists
    if (!local?.length) return remote
    const localMap = new Map(local.map((m) => [m.modelId, m]))
    return remote.map((r) => {
      const prev = localMap.get(r.modelId)
      if (!prev) return r
      return {
        ...r,
        nickname: prev.nickname || r.nickname,
        capabilities: prev.capabilities?.length ? prev.capabilities : r.capabilities,
        contextWindow: prev.contextWindow ?? r.contextWindow,
        maxOutput: prev.maxOutput ?? r.maxOutput,
      }
    })
  }

  const remoteMap = new Map(remote.map((m) => [m.modelId, m]))
  const merged: ProviderModelInfo[] = []
  const seen = new Set<string>()

  for (const m of local) {
    const r = remoteMap.get(m.modelId)
    if (r) {
      merged.push({
        ...r,
        nickname: m.nickname || r.nickname,
        capabilities: m.capabilities?.length ? m.capabilities : r.capabilities,
        contextWindow: m.contextWindow ?? r.contextWindow,
        maxOutput: m.maxOutput ?? r.maxOutput,
      })
    } else {
      merged.push(m)
    }
    seen.add(m.modelId)
  }

  for (const r of remote) {
    if (!seen.has(r.modelId)) {
      merged.push(r)
      seen.add(r.modelId)
    }
  }

  return merged
}
