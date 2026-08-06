import type { Settings } from '@shared/types'
import { getExtensionSettings } from '@/stores/settingActions'

/**
 * Whether web search can run with current extension settings
 * (provider selected and required credentials present).
 */
export function isWebSearchConfigured(extensionWebSearch?: Settings['extension']['webSearch']): boolean {
  const ws = extensionWebSearch ?? getExtensionSettings().webSearch
  if (!ws?.provider) {
    return false
  }

  switch (ws.provider) {
    case 'build-in':
    case 'bing':
    case 'duckduckgo':
      return true
    case 'serper':
      return Boolean(ws.serperApiKey?.trim())
    case 'google':
      return Boolean(ws.googleApiKey?.trim() && ws.googleCseId?.trim())
    case 'tavily':
      return Boolean(ws.tavilyApiKey?.trim())
    case 'exa':
      return Boolean(ws.exaApiKey?.trim())
    default:
      return false
  }
}
