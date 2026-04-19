import { getSystemProviders } from '../providers'
import type { ProviderModelInfo, SessionSettings, Settings } from '../types'
import { ModelProviderEnum, ModelProviderType } from '../types'

const STRUCTURED_REASONING_REPLAY_PROVIDERS = new Set<string>([
  ModelProviderEnum.DeepSeek,
  ModelProviderEnum.Ollama,
  ModelProviderEnum.LMStudio,
  ModelProviderEnum.Groq,
  ModelProviderEnum.XAI,
  ModelProviderEnum.SiliconFlow,
  ModelProviderEnum.ChatGLM6B,
  ModelProviderEnum.Qwen,
])

function findProviderBaseInfo(providerId: string | undefined, globalSettings: Pick<Settings, 'customProviders'>) {
  if (!providerId) {
    return undefined
  }

  return [...getSystemProviders(), ...(globalSettings.customProviders || [])].find((provider) => provider.id === providerId)
}

function findModelInfo(
  sessionSettings: Partial<SessionSettings> | undefined,
  globalSettings: Pick<Settings, 'providers' | 'customProviders'>
): ProviderModelInfo | undefined {
  const providerId = sessionSettings?.provider
  const modelId = sessionSettings?.modelId

  if (!providerId || !modelId) {
    return undefined
  }

  return (
    globalSettings.providers?.[providerId]?.models?.find((model) => model.modelId === modelId) ||
    findProviderBaseInfo(providerId, globalSettings)?.defaultSettings?.models?.find((model) => model.modelId === modelId)
  )
}

export function supportsStructuredReasoningReplayTransport(
  providerId: string | undefined,
  globalSettings: Pick<Settings, 'customProviders'>
): boolean {
  if (!providerId) {
    return false
  }

  if (STRUCTURED_REASONING_REPLAY_PROVIDERS.has(providerId)) {
    return true
  }

  const providerBaseInfo = findProviderBaseInfo(providerId, globalSettings)
  return providerBaseInfo?.isCustom === true && providerBaseInfo.type === ModelProviderType.OpenAI
}

export function isReasoningReplayAvailable(
  sessionSettings: Partial<SessionSettings> | undefined,
  globalSettings: Pick<Settings, 'providers' | 'customProviders'>
): boolean {
  const modelInfo = findModelInfo(sessionSettings, globalSettings)

  if (!modelInfo?.capabilities?.includes('reasoning')) {
    return false
  }

  return supportsStructuredReasoningReplayTransport(sessionSettings?.provider, globalSettings)
}

export function shouldPreserveReasoningInContext(
  sessionSettings: Partial<SessionSettings> | undefined,
  globalSettings: Pick<Settings, 'providers' | 'customProviders'>
): boolean {
  return (sessionSettings?.preserveReasoningInContext ?? true) && isReasoningReplayAvailable(sessionSettings, globalSettings)
}
