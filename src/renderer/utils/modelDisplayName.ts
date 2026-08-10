import type { ProviderInfo, ProviderModelInfo } from '@shared/types'

export type SelectedModel = {
  provider: string
  modelId: string
}

/**
 * True for image/video/paint models that should not appear in the chat composer picker.
 * (Provider catalogs often tag these as `chat` because the API schema only has chat|embedding|rerank.)
 */
export function isNonChatComposerModel(model: Pick<ProviderModelInfo, 'modelId' | 'type'>): boolean {
  if (model.type === 'embedding' || model.type === 'rerank') return true
  const id = (model.modelId || '').toLowerCase()
  if (!id) return false
  return (
    id.includes('imagine-image') ||
    id.includes('imagine-video') ||
    id.includes('grok-imagine') ||
    id.includes('grok-2-image') ||
    id.includes('dall-e') ||
    id.includes('gpt-image') ||
    id.includes('imagen') ||
    /(?:^|[-_/])(image|video|tts|whisper|embed|embedding|rerank)(?:[-_/]|$)/i.test(id)
  )
}

/** Brand tokens that should not be title-cased letter-by-letter. */
const BRAND_TOKENS: Record<string, string> = {
  grok: 'Grok',
  gpt: 'GPT',
  claude: 'Claude',
  gemini: 'Gemini',
  qwen: 'Qwen',
  deepseek: 'DeepSeek',
  llama: 'Llama',
  mistral: 'Mistral',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  xai: 'xAI',
  o1: 'o1',
  o3: 'o3',
  o4: 'o4',
  tts: 'TTS',
  stt: 'STT',
  llm: 'LLM',
  api: 'API',
  ui: 'UI',
  sdk: 'SDK',
  cli: 'CLI',
  ai: 'AI',
  vl: 'VL',
  vlm: 'VLM',
}

/**
 * Product-facing model label. Prefer nickname; otherwise humanize API ids like
 * `grok-4.20-0309-non-reasoning` → `Grok 4.20`.
 */
export function formatModelDisplayName(modelId: string, nickname?: string | null): string {
  if (nickname?.trim()) return nickname.trim()
  if (!modelId?.trim()) return ''

  let id = modelId.trim()
  const slash = id.lastIndexOf('/')
  if (slash >= 0) id = id.slice(slash + 1)

  // Drop calendar / build stamps: -2024-03-09, -20240309, -0309 (MMDD)
  id = id.replace(/(?:[-_])\d{4}-\d{2}-\d{2}(?=[-_]|$)/g, '')
  id = id.replace(/(?:[-_])\d{8}(?=[-_]|$)/g, '')
  id = id.replace(/(?:[-_])(\d{4})(?=[-_]|$)/g, (full, digits: string) => {
    const mm = Number(digits.slice(0, 2))
    const dd = Number(digits.slice(2, 4))
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) return ''
    return full
  })

  // Non-reasoning is the default product path — drop the noise.
  id = id.replace(/(?:[-_])+non(?:[-_])+reasoning/gi, '')
  // Keep a short Reasoning tag when present
  const isReasoning = /(?:[-_])reasoning(?:[-_]|$)/i.test(id)
  id = id.replace(/(?:[-_])+reasoning(?=[-_]|$)/gi, '')

  const tokens = id
    .split(/[-_]+/)
    .map((t) => t.trim())
    .filter(Boolean)

  const pretty = tokens.map((part) => {
    if (/^\d+(\.\d+)+$/.test(part) || /^\d+$/.test(part)) return part
    const lower = part.toLowerCase()
    if (BRAND_TOKENS[lower]) return BRAND_TOKENS[lower]
    if (part.length <= 3 && part === part.toUpperCase()) return part
    // multi-agent → Multi-agent
    if (lower.includes('-')) {
      return lower
        .split('-')
        .map((s, i) => (i === 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s))
        .join('-')
    }
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
  })

  if (isReasoning) pretty.push('Reasoning')

  return pretty.join(' ').replace(/\s+/g, ' ').trim() || modelId
}

export function getModelDisplayName(providers: ProviderInfo[], model?: SelectedModel): string {
  if (!model?.modelId) {
    return ''
  }

  const provider = providers.find((item) => item.id === model.provider)
  const models = [...(provider?.models || []), ...(provider?.defaultSettings?.models || [])]
  const normalizeModelId = (modelId: string) =>
    modelId
      .trim()
      .replace(/^google\//i, '')
      .replace(/^models\//i, '')
      .replace(/^antigravity-/i, '')
      .replace(/^gemini-3(?:\.\d+)?-flash$/i, 'gemini-3-flash')
      .replace(/^gemini-3(?:\.\d+)?-pro-(low|high)$/i, 'gemini-3-pro-$1')

  const exactModels = models.filter((item) => item.modelId === model.modelId)
  const exactModel = exactModels.find((item) => Boolean(item.nickname)) || exactModels[0]
  if (exactModel) {
    return formatModelDisplayName(exactModel.modelId, exactModel.nickname)
  }

  const normalizedTarget = normalizeModelId(model.modelId)
  const aliasModels = models.filter((item) => normalizeModelId(item.modelId) === normalizedTarget)
  const aliasModel = aliasModels.find((item) => Boolean(item.nickname)) || aliasModels[0]

  return formatModelDisplayName(aliasModel?.modelId || model.modelId, aliasModel?.nickname)
}
