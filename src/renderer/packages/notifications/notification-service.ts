import {
  DEFAULT_NOTIFICATIONS_CONFIG,
  type NotificationServiceDeps,
  type NotifyEvent,
  type SystemNotificationKind,
} from './types'

const DEDUPE_TTL_MS = 30_000

function defaultTranslate(key: string, options?: Record<string, unknown>): string {
  // Fallback English when i18n is not wired (tests / early boot)
  const name = typeof options?.name === 'string' && options.name.trim() ? options.name.trim() : ''
  switch (key) {
    case 'notifications.generationComplete.title':
      return 'Reply ready'
    case 'notifications.generationComplete.body':
      return name ? `${name} finished generating` : 'Generation finished'
    case 'notifications.roomComplete.title':
      return 'Team room finished'
    case 'notifications.roomComplete.body':
      return name ? `${name} team room completed` : 'Team room completed'
    case 'notifications.updateAvailable.title':
      return 'Update ready'
    case 'notifications.updateAvailable.body':
      return 'A Chaeboxi update is ready to install'
    default:
      return key
  }
}

function kindEnabled(kind: SystemNotificationKind, config: typeof DEFAULT_NOTIFICATIONS_CONFIG): boolean {
  switch (kind) {
    case 'generation_complete':
      return config.notifyOnGenerationComplete !== false
    case 'room_complete':
      return config.notifyOnRoomComplete !== false
    case 'update_available':
      return config.notifyOnUpdateAvailable !== false
    default:
      return false
  }
}

function buildCopy(
  event: NotifyEvent,
  t: (key: string, options?: Record<string, unknown>) => string
): { title: string; body: string } {
  // Prefer session name; generic fallback avoids empty "{{name}} …" strings
  const name = event.sessionName?.trim() || undefined
  switch (event.kind) {
    case 'generation_complete':
      return {
        title: t('notifications.generationComplete.title'),
        body: name
          ? t('notifications.generationComplete.body', { name })
          : 'Generation finished',
      }
    case 'room_complete':
      return {
        title: t('notifications.roomComplete.title'),
        body: name ? t('notifications.roomComplete.body', { name }) : 'Team room completed',
      }
    case 'update_available':
      return {
        title: t('notifications.updateAvailable.title'),
        body: t('notifications.updateAvailable.body'),
      }
  }
}

/**
 * Policy layer for local OS notifications: settings, focus suppress, dedupe.
 * Does not include message content in payloads.
 */
export class NotificationService {
  private readonly recent = new Map<string, number>()
  private deps: NotificationServiceDeps

  constructor(deps: NotificationServiceDeps) {
    this.deps = deps
  }

  /** Replace deps (e.g. after i18n init or platform swap in tests). */
  setDeps(deps: Partial<NotificationServiceDeps>) {
    this.deps = { ...this.deps, ...deps }
  }

  private dedupeKey(event: NotifyEvent): string {
    return [event.kind, event.sessionId ?? '', event.messageId ?? ''].join(':')
  }

  private isDuplicate(key: string, now: number): boolean {
    const prev = this.recent.get(key)
    if (prev !== undefined && now - prev < DEDUPE_TTL_MS) {
      return true
    }
    this.recent.set(key, now)
    // Opportunistic prune
    if (this.recent.size > 100) {
      for (const [k, ts] of this.recent) {
        if (now - ts >= DEDUPE_TTL_MS) {
          this.recent.delete(k)
        }
      }
    }
    return false
  }

  /**
   * Whether this event would be shown (for tests). Does not call platform show.
   */
  shouldNotify(event: NotifyEvent, now = Date.now()): boolean {
    const config = { ...DEFAULT_NOTIFICATIONS_CONFIG, ...this.deps.getConfig() }
    if (!config.enabled) return false
    if (!kindEnabled(event.kind, config)) return false
    if (this.deps.isAppActive()) return false
    if (this.isDuplicate(this.dedupeKey(event), now)) return false
    return true
  }

  /**
   * Attempt to show a system notification for the event.
   * No-ops when disabled, app focused, duplicate, or permission not granted.
   */
  async notify(event: NotifyEvent): Promise<boolean> {
    const config = { ...DEFAULT_NOTIFICATIONS_CONFIG, ...this.deps.getConfig() }
    if (!config.enabled) return false
    if (!kindEnabled(event.kind, config)) return false
    if (this.deps.isAppActive()) return false

    const now = Date.now()
    const key = this.dedupeKey(event)
    // Check duplicate without writing yet — write only if we actually show
    const prev = this.recent.get(key)
    if (prev !== undefined && now - prev < DEDUPE_TTL_MS) {
      return false
    }

    let permission = await this.deps.getPermission()
    if (permission === 'unsupported') return false
    if (permission === 'default') {
      // Do not auto-request on event; user must enable in Settings
      return false
    }
    if (permission !== 'granted') return false

    const t = this.deps.t ?? defaultTranslate
    const { title, body } = buildCopy(event, t)

    try {
      await this.deps.show({
        title,
        body,
        data: {
          sessionId: event.sessionId,
          kind: event.kind,
        },
      })
      this.recent.set(key, now)
      return true
    } catch (err) {
      console.warn('[notifications] show failed', err)
      return false
    }
  }

  async requestPermission(): Promise<'granted' | 'denied' | 'default' | 'unsupported'> {
    return this.deps.requestPermission()
  }

  async getPermission(): Promise<'granted' | 'denied' | 'default' | 'unsupported'> {
    return this.deps.getPermission()
  }
}

/** Test helper: pure should-notify without mutating service dedupe via notify(). */
export function evaluateNotificationPolicy(
  event: NotifyEvent,
  opts: {
    config?: Partial<typeof DEFAULT_NOTIFICATIONS_CONFIG>
    isAppActive: boolean
    recentKeys?: string[]
    now?: number
  }
): boolean {
  const config = { ...DEFAULT_NOTIFICATIONS_CONFIG, ...opts.config }
  if (!config.enabled) return false
  if (!kindEnabled(event.kind, config)) return false
  if (opts.isAppActive) return false
  const key = [event.kind, event.sessionId ?? '', event.messageId ?? ''].join(':')
  if (opts.recentKeys?.includes(key)) return false
  return true
}
