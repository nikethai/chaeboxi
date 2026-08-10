import { ModelProviderEnum } from '../types';

export function normalizeOpenAIApiHostAndPath(
  options: { apiHost?: string; apiPath?: string },
  defaults?: { apiHost?: string; apiPath?: string }
) {
  let { apiHost, apiPath } = options
  if (apiHost) {
    apiHost = apiHost.trim()
  }
  if (apiPath) {
    apiPath = apiPath.trim()
  }
  const DEFAULT_HOST = defaults?.apiHost ?? 'https://api.openai.com/v1'
  const DEFAULT_PATH = defaults?.apiPath ?? '/chat/completions'
  // apiHost ， apiHost apiPath
  if (!apiHost) {
    apiHost = DEFAULT_HOST
    apiPath = DEFAULT_PATH
    return { apiHost, apiPath }
  }
  // (legacy comment removed)
  if (apiHost.endsWith('/')) {
    apiHost = apiHost.slice(0, -1)
  }
  if (apiPath && !apiPath.startsWith('/')) {
    apiPath = '/' + apiPath
  }
  // https
  if (apiHost && !apiHost.startsWith('http://') && !apiHost.startsWith('https://')) {
    apiHost = 'https://' + apiHost
  }
  // (legacy comment)
  // (legacy comment removed)
  //   apiHost=https://my.proxy.com/v1/chat/completions
  if (apiHost.endsWith(DEFAULT_PATH)) {
    apiHost = apiHost.replace(DEFAULT_PATH, '')
    apiPath = DEFAULT_PATH
  }
  // OpenAI API， apiHost apiPath
  if (apiHost.endsWith('://api.openai.com') || apiHost.endsWith('://api.openai.com/v1')) {
    apiHost = DEFAULT_HOST
    apiPath = DEFAULT_PATH
    return { apiHost, apiPath }
  }
  // OpenRouter API， apiHost apiPath
  if (apiHost.endsWith('://openrouter.ai') || apiHost.endsWith('://openrouter.ai/api')) {
    apiHost = 'https://openrouter.ai/api/v1'
    apiPath = DEFAULT_PATH
    return { apiHost, apiPath }
  }
  // x API， apiHost apiPath
  if (apiHost.endsWith('://api.x.com') || apiHost.endsWith('://api.x.com/v1')) {
    apiHost = 'https://api.x.com/v1'
    apiPath = DEFAULT_PATH
    return { apiHost, apiPath }
  }
  // apiHost， apiHost /v1
  if (!apiHost.endsWith('/v1') && !apiPath) {
    apiHost = apiHost + '/v1'
    apiPath = DEFAULT_PATH
  }
  if (!apiPath) {
    apiPath = DEFAULT_PATH
  }
  return { apiHost, apiPath }
}

export function normalizeOpenAIResponsesHostAndPath(options: { apiHost?: string; apiPath?: string }) {
  const trimmedApiPath = options.apiPath?.trim()
  const hasCustomApiPath = !!trimmedApiPath && trimmedApiPath !== '/responses'
  const normalized = normalizeOpenAIApiHostAndPath(
    hasCustomApiPath ? { ...options, apiPath: trimmedApiPath } : { ...options, apiPath: undefined },
    { apiPath: '/responses' }
  )

  if (!hasCustomApiPath) {
    normalized.apiPath = '/responses'
  }

  return normalized
}

export function normalizeClaudeHost(apiHost: string) {
  apiHost = apiHost.trim()
  if (apiHost === 'https://api.anthropic.com') {
    apiHost = `${apiHost}/v1`
  }
  if (apiHost.endsWith('/')) {
    apiHost = apiHost.slice(0, apiHost.length - 1)
  }
  return {
    apiHost,
    apiPath: '/messages',
  }
}

export function normalizeGeminiHost(apiHost: string) {
  apiHost = apiHost.trim()
  if (apiHost.endsWith('/')) {
    apiHost = apiHost.slice(0, apiHost.length - 1)
  }
  apiHost = `${apiHost}/v1beta`
  return {
    apiHost,
    apiPath: '/models/[model]',
  }
}

export function normalizeAzureEndpoint(endpoint: string) {
  let origin = endpoint
  try {
    origin = new URL(endpoint.trim()).origin
  } catch (_error) {
    origin = `https://${origin}.openai.azure.com`
  }
  return {
    endpoint: `${origin}/openai`,
    apiPath: '/chat/completions',
  }
}

export function isOpenAICompatible(providerId: string, _modelId: string) {
  return (
    [
      ModelProviderEnum.OpenAI,
      ModelProviderEnum.SiliconFlow,
      ModelProviderEnum.OpenRouter,
      ModelProviderEnum.Ollama,
      ModelProviderEnum.ChatGLM6B,
      ModelProviderEnum.XAI,
      ModelProviderEnum.Groq,
      ModelProviderEnum.DeepSeek,
      ModelProviderEnum.LMStudio,
    ].includes(providerId as ModelProviderEnum) || providerId.startsWith('custom-provider-')
  )
}
