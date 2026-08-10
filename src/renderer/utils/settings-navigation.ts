/**
 * Pure helpers for settings entry/exit navigation.
 * Kept free of router imports so unit tests stay lightweight.
 */

/** Parent path within settings for mobile back navigation, or null at settings root. */
export function getSettingsParentPath(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] !== 'settings' || parts.length <= 1) {
    return null
  }
  if (parts.length === 2) {
    return '/settings'
  }
  return `/${parts.slice(0, -1).join('/')}`
}

/** Resolve where leaving settings should land given the cached session and storage validation result. */
export function resolveSettingsExitTarget(
  sessionId: string | null | undefined,
  sessionExists = true
): {
  to: '/session/$sessionId' | '/'
  params?: { sessionId: string }
} {
  if (sessionId && sessionId !== 'new' && sessionExists) {
    return { to: '/session/$sessionId', params: { sessionId } }
  }
  return { to: '/' }
}

/** Build the `/settings/*` path for open-settings navigations. */
export function resolveSettingsEntryPath(path?: string): string {
  const suffix = path ? (path.startsWith('/') ? path : `/${path}`) : '/provider'
  return `/settings${suffix === '/' ? '/provider' : suffix}`
}
