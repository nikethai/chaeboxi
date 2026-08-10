import type { SystemNotificationsConfig } from '@shared/types'

export type SystemNotificationKind = 'generation_complete' | 'room_complete' | 'update_available'

export type NotifyEvent = {
  kind: SystemNotificationKind
  sessionId?: string
  messageId?: string
  /** Display name for body only — never message content */
  sessionName?: string
}

export type NotificationServiceDeps = {
  getConfig: () => SystemNotificationsConfig | undefined
  isAppActive: () => boolean
  getPermission: () => Promise<'granted' | 'denied' | 'default' | 'unsupported'>
  requestPermission: () => Promise<'granted' | 'denied' | 'default' | 'unsupported'>
  show: (payload: {
    title: string
    body?: string
    data?: { sessionId?: string; kind?: string }
  }) => Promise<void>
  t?: (key: string, options?: Record<string, unknown>) => string
}

export const DEFAULT_NOTIFICATIONS_CONFIG: SystemNotificationsConfig = {
  enabled: false,
  notifyOnGenerationComplete: true,
  notifyOnRoomComplete: true,
  notifyOnUpdateAvailable: true,
}
