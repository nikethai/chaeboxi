import type { ProviderModelInfo } from '../../types'

/** QwenCloud / Model Studio plan identifiers stored on ProviderSettings */
export type QwenPlanId = 'token-plan' | 'coding-plan' | 'standard'

/** Region for QwenCloud / DashScope endpoints */
export type QwenRegion = 'international' | 'china'

export interface QwenPlanPreset {
  planId: QwenPlanId
  region: QwenRegion
  /** Display label key-friendly English name (UI may translate) */
  name: string
  description: string
  apiHost: string
  models: ProviderModelInfo[]
  /** Placeholder / hint for key field */
  keyHint: string
  /** Whether key is typically plan-specific (sk-sp-…) */
  isPlanKey: boolean
  apiKeysUrl: string
  docsUrl: string
}

const TOKEN_PLAN_INTL_HOST = 'https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1'
const CODING_PLAN_INTL_HOST = 'https://coding-intl.dashscope.aliyuncs.com/compatible-mode/v1'
const STANDARD_INTL_HOST = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
const STANDARD_CHINA_HOST = 'https://dashscope.aliyuncs.com/compatible-mode/v1'

const QWENCLOUD_API_KEYS_URL = 'https://home.qwencloud.com/api-keys'
const TOKEN_PLAN_DOCS_URL = 'https://docs.qwencloud.com/token-plan/personal/token-plan-personal-quickstart'
const CODING_PLAN_DOCS_URL = 'https://docs.qwencloud.com/coding-plan/overview'
const STANDARD_DOCS_URL = 'https://docs.qwencloud.com/api-reference/preparation/api-key'

/** Seed models for QwenCloud Token Plan (Personal) — editable in UI; catalog may drift */
const TOKEN_PLAN_MODELS: ProviderModelInfo[] = [
  { modelId: 'qwen3.8-max', capabilities: ['reasoning', 'tool_use'] },
  { modelId: 'qwen3.8-max-preview', capabilities: ['reasoning', 'tool_use'] },
  { modelId: 'qwen3.7-max', capabilities: ['reasoning', 'tool_use'] },
  { modelId: 'qwen3.7-plus', capabilities: ['reasoning', 'tool_use'] },
  { modelId: 'qwen3.6-flash', capabilities: ['reasoning'] },
]

const CODING_PLAN_MODELS: ProviderModelInfo[] = [
  { modelId: 'qwen3.7-plus', capabilities: ['reasoning', 'tool_use'] },
  { modelId: 'qwen3.6-plus', capabilities: ['reasoning', 'tool_use'] },
  { modelId: 'qwen3.5-plus', capabilities: ['reasoning'] },
  { modelId: 'qwen3-coder-plus', capabilities: ['reasoning', 'tool_use'] },
  { modelId: 'qwen3-coder-next', capabilities: ['reasoning', 'tool_use'] },
]

const STANDARD_MODELS: ProviderModelInfo[] = [
  { modelId: 'qwen3.5-plus', capabilities: ['reasoning'] },
  { modelId: 'qwen3-coder-plus', capabilities: ['reasoning', 'tool_use'] },
  { modelId: 'qwen3-max-2026-01-23', capabilities: ['reasoning'] },
]

/**
 * Built-in Qwen plan presets.
 * Official hosts from QwenCloud docs (OpenAI-compatible only).
 */
export const QWEN_PLAN_PRESETS: QwenPlanPreset[] = [
  {
    planId: 'token-plan',
    region: 'international',
    name: 'Token Plan',
    description: 'QwenCloud subscription credits with a dedicated endpoint',
    apiHost: TOKEN_PLAN_INTL_HOST,
    models: TOKEN_PLAN_MODELS,
    keyHint: 'sk-sp-… (Token Plan key from QwenCloud)',
    isPlanKey: true,
    apiKeysUrl: QWENCLOUD_API_KEYS_URL,
    docsUrl: TOKEN_PLAN_DOCS_URL,
  },
  {
    planId: 'coding-plan',
    region: 'international',
    name: 'Coding Plan',
    description: 'Fixed monthly coding quota (QwenCloud)',
    apiHost: CODING_PLAN_INTL_HOST,
    models: CODING_PLAN_MODELS,
    keyHint: 'sk-sp-… (Coding Plan key from QwenCloud)',
    isPlanKey: true,
    apiKeysUrl: QWENCLOUD_API_KEYS_URL,
    docsUrl: CODING_PLAN_DOCS_URL,
  },
  {
    planId: 'standard',
    region: 'international',
    name: 'Standard API Key',
    description: 'Pay-as-you-go QwenCloud / Model Studio (International)',
    apiHost: STANDARD_INTL_HOST,
    models: STANDARD_MODELS,
    keyHint: 'QwenCloud or Model Studio API key',
    isPlanKey: false,
    apiKeysUrl: QWENCLOUD_API_KEYS_URL,
    docsUrl: STANDARD_DOCS_URL,
  },
  {
    planId: 'standard',
    region: 'china',
    name: 'Standard API Key (China)',
    description: 'Pay-as-you-go DashScope (China)',
    apiHost: STANDARD_CHINA_HOST,
    models: STANDARD_MODELS,
    keyHint: 'DashScope API key',
    isPlanKey: false,
    apiKeysUrl: 'https://bailian.console.aliyun.com/',
    docsUrl: 'https://help.aliyun.com/zh/model-studio/get-api-key',
  },
]

export function getQwenPreset(planId?: string | null, region?: string | null): QwenPlanPreset | undefined {
  if (!planId) {
    return undefined
  }
  const resolvedRegion = region || (planId === 'token-plan' || planId === 'coding-plan' ? 'international' : 'china')
  return QWEN_PLAN_PRESETS.find((p) => p.planId === planId && p.region === resolvedRegion)
}

/** Match a saved apiHost back to a preset (best-effort for UI). */
export function findQwenPresetByApiHost(apiHost?: string | null): QwenPlanPreset | undefined {
  if (!apiHost?.trim()) {
    return undefined
  }
  const normalized = apiHost.trim().replace(/\/+$/, '')
  return QWEN_PLAN_PRESETS.find((p) => p.apiHost.replace(/\/+$/, '') === normalized)
}

/** Plans shown in the UI plan selector (unique planIds for a given region) */
export function listQwenPlansForRegion(region: QwenRegion): QwenPlanPreset[] {
  if (region === 'china') {
    return QWEN_PLAN_PRESETS.filter((p) => p.region === 'china')
  }
  // International: token-plan, coding-plan, standard (not china standard)
  return QWEN_PLAN_PRESETS.filter((p) => p.region === 'international')
}

export function getDefaultQwenPreset(): QwenPlanPreset {
  return QWEN_PLAN_PRESETS[0] // Token Plan international — primary QwenCloud path
}

export function isQwenPlanId(value: unknown): value is QwenPlanId {
  return value === 'token-plan' || value === 'coding-plan' || value === 'standard'
}

export function isQwenRegion(value: unknown): value is QwenRegion {
  return value === 'international' || value === 'china'
}
