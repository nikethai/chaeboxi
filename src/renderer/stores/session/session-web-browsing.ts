import { isWebSearchConfigured } from '@/packages/web-search/is-configured'
import { uiStore } from '../uiStore'

/**
 * Session-level web browsing flag.
 * Explicit map override wins; otherwise default ON when search is configured
 * so the model can auto-use web tools (modern chat UX).
 */
export function getSessionWebBrowsing(sessionId: string, _provider?: string | undefined): boolean {
  const sessionValue = uiStore.getState().sessionWebBrowsingMap[sessionId]
  if (sessionValue !== undefined) {
    return sessionValue
  }
  return isWebSearchConfigured()
}
