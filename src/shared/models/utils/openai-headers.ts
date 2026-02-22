export interface CloudflareAccessSettings {
  cloudflareClientId?: string
  cloudflareClientSecret?: string
}

export function buildCloudflareAccessHeaders(
  options: CloudflareAccessSettings,
): Record<string, string> {
  const headers: Record<string, string> = {}
  if (options.cloudflareClientId) {
    headers['CF-Access-Client-Id'] = options.cloudflareClientId
  }
  if (options.cloudflareClientSecret) {
    headers['CF-Access-Client-Secret'] = options.cloudflareClientSecret
  }
  return headers
}

export function buildOpenAICompatibleHeaders(
  apiHost: string,
  options: CloudflareAccessSettings,
): Record<string, string> | undefined {
  const providerHeaders = apiHost.includes('openrouter.ai')
    ? {
        'HTTP-Referer': 'https://chatboxai.app',
        'X-Title': 'Chatbox AI',
      }
    : apiHost.includes('aihubmix.com')
      ? {
          'APP-Code': 'VAFU9221',
        }
      : undefined

  const headers = {
    ...providerHeaders,
    ...buildCloudflareAccessHeaders(options),
  }

  return Object.keys(headers).length > 0 ? headers : undefined
}

export function buildBearerAuthHeaders(
  apiKey: string,
  options: CloudflareAccessSettings,
): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    ...buildCloudflareAccessHeaders(options),
  }
}
