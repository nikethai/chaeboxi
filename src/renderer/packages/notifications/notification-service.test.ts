import { describe, expect, test, vi } from 'vitest'
import { evaluateNotificationPolicy, NotificationService } from './notification-service'
import type { NotificationServiceDeps, NotifyEvent } from './types'

const baseEvent: NotifyEvent = {
  kind: 'generation_complete',
  sessionId: 's1',
  messageId: 'm1',
  sessionName: 'My chat',
}

function createService(overrides: Partial<NotificationServiceDeps> = {}) {
  const show = vi.fn(async () => {})
  const deps: NotificationServiceDeps = {
    getConfig: () => ({
      enabled: true,
      notifyOnGenerationComplete: true,
      notifyOnRoomComplete: true,
      notifyOnUpdateAvailable: true,
    }),
    isAppActive: () => false,
    getPermission: async () => 'granted',
    requestPermission: async () => 'granted',
    show,
    ...overrides,
  }
  return { service: new NotificationService(deps), show, deps }
}

describe('evaluateNotificationPolicy', () => {
  test('blocks when master toggle is off', () => {
    expect(
      evaluateNotificationPolicy(baseEvent, {
        config: { enabled: false },
        isAppActive: false,
      })
    ).toBe(false)
  })

  test('blocks when app is active', () => {
    expect(
      evaluateNotificationPolicy(baseEvent, {
        config: { enabled: true },
        isAppActive: true,
      })
    ).toBe(false)
  })

  test('blocks when kind is disabled', () => {
    expect(
      evaluateNotificationPolicy(baseEvent, {
        config: { enabled: true, notifyOnGenerationComplete: false },
        isAppActive: false,
      })
    ).toBe(false)
  })

  test('allows when enabled and inactive', () => {
    expect(
      evaluateNotificationPolicy(baseEvent, {
        config: { enabled: true },
        isAppActive: false,
      })
    ).toBe(true)
  })
})

describe('NotificationService', () => {
  test('shows notification when policy allows', async () => {
    const { service, show } = createService()
    const shown = await service.notify(baseEvent)
    expect(shown).toBe(true)
    expect(show).toHaveBeenCalledTimes(1)
    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.any(String),
        body: expect.stringContaining('My chat'),
        data: { sessionId: 's1', kind: 'generation_complete' },
      })
    )
  })

  test('skips when focused', async () => {
    const { service, show } = createService({ isAppActive: () => true })
    expect(await service.notify(baseEvent)).toBe(false)
    expect(show).not.toHaveBeenCalled()
  })

  test('skips when permission is default (no auto-request)', async () => {
    const { service, show } = createService({ getPermission: async () => 'default' })
    expect(await service.notify(baseEvent)).toBe(false)
    expect(show).not.toHaveBeenCalled()
  })

  test('dedupes same event within TTL', async () => {
    const { service, show } = createService()
    expect(await service.notify(baseEvent)).toBe(true)
    expect(await service.notify(baseEvent)).toBe(false)
    expect(show).toHaveBeenCalledTimes(1)
  })

  test('update_available has no session body leak surface', async () => {
    const { service, show } = createService()
    await service.notify({ kind: 'update_available' })
    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { sessionId: undefined, kind: 'update_available' },
      })
    )
  })
})
