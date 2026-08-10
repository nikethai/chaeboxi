/**
 * Map planId / planType / auth mode to human-readable plan labels.
 */

import type { ProviderSettings } from '../../types'
import { ModelProviderEnum } from '../../types/provider'
import { getQwenPreset } from '../plan-presets/qwen'
import type { ProviderPlanInfo } from './types'

const CODEX_PLAN_LABELS: Record<string, string> = {
  free: 'ChatGPT Free',
  plus: 'ChatGPT Plus',
  pro: 'ChatGPT Pro',
  team: 'ChatGPT Team',
  enterprise: 'ChatGPT Enterprise',
  business: 'ChatGPT Business',
  edu: 'ChatGPT Edu',
}

const GEMINI_PLAN_LABELS: Record<string, string> = {
  free: 'Antigravity Free',
  pro: 'Antigravity Pro',
  ultra: 'Antigravity Ultra',
  standard: 'Antigravity Standard',
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function maskAccount(hint?: string): string | undefined {
  if (!hint) return undefined
  const s = hint.trim()
  if (!s) return undefined
  if (s.includes('@')) {
    const [user, domain] = s.split('@')
    if (!domain) return s
    const safe = user.length <= 2 ? `${user[0] ?? ''}*` : `${user.slice(0, 2)}***`
    return `${safe}@${domain}`
  }
  if (s.length <= 8) return s
  return `${s.slice(0, 4)}…${s.slice(-4)}`
}

export function labelCodexPlanType(planType?: string): string {
  if (!planType) return 'ChatGPT (OAuth)'
  const key = planType.toLowerCase()
  return CODEX_PLAN_LABELS[key] ?? `ChatGPT ${titleCase(planType)}`
}

export function labelGeminiPlanType(planType?: string): string {
  if (!planType) return 'Gemini Antigravity'
  const key = planType.toLowerCase()
  return GEMINI_PLAN_LABELS[key] ?? `Antigravity ${titleCase(planType)}`
}

export function getPlanInfoForProvider(
  providerId: string,
  settings: ProviderSettings
): ProviderPlanInfo | undefined {
  if (providerId === ModelProviderEnum.OpenAI || providerId === ModelProviderEnum.OpenAIResponses) {
    const mode = settings.authMode
    if (mode === 'oauth' || settings.oauth?.accessToken) {
      return {
        label: labelCodexPlanType(settings.oauth?.planType),
        planId: settings.oauth?.planType,
        authMode: 'oauth',
        accountHint: maskAccount(settings.oauth?.accountId || settings.oauth?.email),
      }
    }
    if (settings.apiKey) {
      return {
        label: 'OpenAI Platform API',
        authMode: 'api_key',
      }
    }
  }

  if (providerId === ModelProviderEnum.Gemini) {
    if (settings.authMode === 'oauth' || settings.oauth?.accessToken) {
      return {
        label: labelGeminiPlanType(settings.oauth?.planType),
        planId: settings.oauth?.planType,
        authMode: 'oauth',
        accountHint: maskAccount(settings.oauth?.email),
      }
    }
    if (settings.apiKey) {
      return {
        label: 'Google AI Studio',
        authMode: 'api_key',
      }
    }
  }

  if (providerId === ModelProviderEnum.Qwen) {
    const planId = settings.planId
    const region = settings.region
    if (planId) {
      const preset = getQwenPreset(planId as 'token-plan' | 'coding-plan' | 'standard', (region as 'international' | 'china') || 'international')
      return {
        label: preset?.name ?? titleCase(planId),
        planId,
        region,
        authMode: settings.apiKey ? 'api_key' : 'none',
      }
    }
    if (settings.apiKey) {
      return {
        label: 'Qwen API',
        authMode: 'api_key',
      }
    }
  }

  if (providerId === ModelProviderEnum.XAI) {
    if (settings.authMode === 'oauth' || settings.oauth?.accessToken) {
      return {
        label: 'SuperGrok',
        planId: settings.oauth?.planType,
        authMode: 'oauth',
        accountHint: maskAccount(settings.oauth?.email || settings.oauth?.accountId),
      }
    }
    if (settings.apiKey) {
      return {
        label: 'xAI API',
        authMode: 'api_key',
      }
    }
  }

  return undefined
}
