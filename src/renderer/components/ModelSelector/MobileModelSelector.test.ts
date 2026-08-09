import { describe, expect, test } from 'vitest'
import { shouldShowProviderSetup } from './mobileModelSelectorUtils'

describe('shouldShowProviderSetup', () => {
  test('keeps the Auto fallback available when no providers are configured', () => {
    expect(shouldShowProviderSetup({ search: '', providerCount: 0, showAuto: true })).toBe(false)
  })

  test('shows setup guidance only when the picker has no provider or Auto fallback', () => {
    expect(shouldShowProviderSetup({ search: '', providerCount: 0, showAuto: false })).toBe(true)
  })

  test('does not show setup guidance for an empty filtered search', () => {
    expect(shouldShowProviderSetup({ search: 'missing', providerCount: 0, showAuto: false })).toBe(false)
  })
})
