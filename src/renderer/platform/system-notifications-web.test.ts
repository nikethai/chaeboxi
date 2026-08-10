import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  getWebOrCapacitorNotificationPermission,
  isCapacitorNativeRuntime,
  showWebOrCapacitorNotification,
} from './system-notifications-web'

describe('system-notifications-web', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  test('isCapacitorNativeRuntime is false without Capacitor', () => {
    expect(isCapacitorNativeRuntime()).toBe(false)
  })

  test('get permission returns a valid status', async () => {
    const perm = await getWebOrCapacitorNotificationPermission(false)
    expect(['unsupported', 'default', 'denied', 'granted']).toContain(perm)
  })

  test('show uses browser Notification when granted', async () => {
    const instances: Array<{ title: string; options?: NotificationOptions; close: () => void }> = []
    const NotificationMock = vi.fn(function NotificationCtor(
      this: unknown,
      title: string,
      options?: NotificationOptions
    ) {
      const instance = {
        title,
        options,
        close: vi.fn(),
        onclick: null as null | (() => void),
      }
      instances.push(instance)
      return instance
    })
    Object.defineProperty(NotificationMock, 'permission', {
      value: 'granted',
      configurable: true,
    })

    const win = {
      isSecureContext: true,
      focus: vi.fn(),
      Notification: NotificationMock,
    }
    vi.stubGlobal('window', win)
    vi.stubGlobal('Notification', NotificationMock)

    await showWebOrCapacitorNotification(
      {
        title: 'Reply ready',
        body: 'Chat finished',
        data: { sessionId: 's1', kind: 'generation_complete' },
      },
      false
    )

    expect(NotificationMock).toHaveBeenCalledWith(
      'Reply ready',
      expect.objectContaining({
        body: 'Chat finished',
        data: { sessionId: 's1', kind: 'generation_complete' },
      })
    )
    expect(instances).toHaveLength(1)
  })
})
