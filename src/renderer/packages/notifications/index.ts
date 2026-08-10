import type { SystemNotificationsConfig } from '@shared/types'
import platform, { isCapacitorMobile } from '@/platform'
import { settingsStore } from '@/stores/settingsStore'
import { NotificationService } from './notification-service'
import { DEFAULT_NOTIFICATIONS_CONFIG, type NotifyEvent, type SystemNotificationKind } from './types'

export type { NotifyEvent, SystemNotificationKind, NotificationServiceDeps } from './types'
export { DEFAULT_NOTIFICATIONS_CONFIG } from './types'
export { evaluateNotificationPolicy, NotificationService } from './notification-service'

let appActive = true
let focusWired = false
let clickWired = false
let i18nWired = false

function wireI18n() {
  if (i18nWired) return
  i18nWired = true
  void import('@/i18n').then((mod) => {
    const i18n = mod.default
    notificationService.setDeps({
      t: (key, options) => i18n.t(key, options as Record<string, unknown>),
    })
  }).catch(() => {
    i18nWired = false
  })
}

function wireFocusTracking() {
  if (focusWired || typeof window === 'undefined') return
  focusWired = true

  const setActive = (active: boolean) => {
    appActive = active
  }

  // Web / Capacitor webview visibility
  const onVisibility = () => {
    // On mobile, document.hasFocus() is unreliable; visibility is enough
    if (isCapacitorMobile) {
      setActive(document.visibilityState === 'visible')
      return
    }
    setActive(document.visibilityState === 'visible' && document.hasFocus())
  }
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('focus', () => setActive(true))
  window.addEventListener('blur', () => setActive(false))
  onVisibility()

  // Desktop Tauri focus events
  try {
    platform.onWindowFocused(() => setActive(true))
  } catch {
    // ignore
  }

  // Capacitor native app state (background / foreground)
  if (isCapacitorMobile) {
    void import('@capacitor/app')
      .then(({ App }) =>
        App.addListener('appStateChange', ({ isActive }) => {
          setActive(isActive)
        })
      )
      .catch(() => {
        // plugin may be unavailable in pure web
      })
  }
}

function wireClickNavigation() {
  if (clickWired || typeof window === 'undefined') return
  clickWired = true
  if (!platform.onSystemNotificationClick) return

  platform.onSystemNotificationClick((payload) => {
    const sessionId = payload.sessionId
    if (!sessionId) return
    // Bring app forward on desktop when possible
    void platform.showMainWindow?.().catch(() => {})
    void import('@/router').then(({ router }) => {
      void router.navigate({ to: `/session/${sessionId}` as never })
    })
  })
}

function getNotificationsConfig(): SystemNotificationsConfig {
  const raw = settingsStore.getState().extension?.notifications
  return { ...DEFAULT_NOTIFICATIONS_CONFIG, ...raw }
}

export const notificationService = new NotificationService({
  getConfig: getNotificationsConfig,
  isAppActive: () => {
    wireFocusTracking()
    return appActive
  },
  getPermission: () => platform.getSystemNotificationPermission(),
  requestPermission: () => platform.requestSystemNotificationPermission(),
  show: (payload) => platform.showSystemNotification(payload),
})

/** Fire-and-forget notify with focus wiring + click routing initialized. */
export async function notifySystemEvent(event: NotifyEvent): Promise<boolean> {
  wireI18n()
  wireFocusTracking()
  wireClickNavigation()
  return notificationService.notify(event)
}

/** For tests: override app-active flag. */
export function __setAppActiveForTests(active: boolean) {
  appActive = active
}
