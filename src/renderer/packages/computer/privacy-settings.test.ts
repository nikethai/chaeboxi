import { describe, expect, it } from 'vitest'
import {
  permissionBadgeColor,
  permissionLabel,
  privacySettingsPathLabel,
  privacySettingsUrls,
} from './privacy-settings'

describe('privacy-settings helpers', () => {
  it('returns mac deep links for screen + accessibility (legacy first)', () => {
    const screen = privacySettingsUrls('Mac', 'screen-recording')
    const access = privacySettingsUrls('Mac', 'accessibility')
    expect(screen[0]).toContain('com.apple.preference.security?Privacy_ScreenCapture')
    expect(access[0]).toContain('com.apple.preference.security?Privacy_Accessibility')
    expect(screen.length).toBeGreaterThan(1)
  })

  it('returns windows privacy hub', () => {
    expect(privacySettingsUrls('Windows', 'screen-recording')[0]).toBe('ms-settings:privacy')
  })

  it('labels paths clearly', () => {
    expect(privacySettingsPathLabel('Mac', 'screen-recording')).toMatch(/Screen/)
    expect(privacySettingsPathLabel('Mac', 'accessibility')).toMatch(/Accessibility/)
  })

  it('maps status to badge + label', () => {
    expect(permissionBadgeColor('granted')).toBe('green')
    expect(permissionBadgeColor('denied')).toBe('red')
    expect(permissionLabel('granted')).toBe('Allowed')
    expect(permissionLabel('unknown')).toBe('Required')
    expect(permissionLabel('denied')).toBe('Blocked')
  })
})
