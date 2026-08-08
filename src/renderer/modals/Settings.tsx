import { getDefaultStore } from 'jotai'
import { router } from '@/router'
import { currentSessionIdAtom } from '@/stores/atoms'
import { getSettingsParentPath, resolveSettingsEntryPath, resolveSettingsExitTarget } from '@/utils/settings-navigation'

export { getSettingsParentPath }

/**
 * Open Settings as a full-page route under `/settings/*`.
 * Desktop and mobile share the same navigation model (not a modal).
 */
export function navigateToSettings(path?: string) {
  const to = resolveSettingsEntryPath(path)
  // TanStack typed routes: cast because path is dynamic (provider id, etc.)
  void router.navigate({ to: to as '/settings/provider' })
}

/**
 * Leave settings and return to the last chat session, or home if none.
 * Prefer this over history.back() so deep links and cold entry always exit cleanly.
 */
export function closeSettings() {
  const sessionId = getDefaultStore().get(currentSessionIdAtom)
  const target = resolveSettingsExitTarget(sessionId)
  if (target.to === '/session/$sessionId' && target.params) {
    void router.navigate({ to: target.to, params: target.params })
    return
  }
  void router.navigate({ to: '/' })
}
