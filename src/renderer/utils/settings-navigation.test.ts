import { describe, expect, it } from 'vitest'
import { getSettingsParentPath, resolveSettingsEntryPath, resolveSettingsExitTarget } from './settings-navigation'

describe('getSettingsParentPath', () => {
  it('returns null at settings root', () => {
    expect(getSettingsParentPath('/settings')).toBeNull()
    expect(getSettingsParentPath('/settings/')).toBeNull()
  })

  it('returns settings root for first-level pages', () => {
    expect(getSettingsParentPath('/settings/provider')).toBe('/settings')
    expect(getSettingsParentPath('/settings/general')).toBe('/settings')
    expect(getSettingsParentPath('/settings/chat')).toBe('/settings')
  })

  it('returns parent for nested provider pages', () => {
    expect(getSettingsParentPath('/settings/provider/openai')).toBe('/settings/provider')
    expect(getSettingsParentPath('/settings/provider/custom-id')).toBe('/settings/provider')
  })

  it('returns null for non-settings paths', () => {
    expect(getSettingsParentPath('/')).toBeNull()
    expect(getSettingsParentPath('/session/abc')).toBeNull()
  })
})

describe('resolveSettingsExitTarget', () => {
  it('returns last session when available', () => {
    expect(resolveSettingsExitTarget('sess-1')).toEqual({
      to: '/session/$sessionId',
      params: { sessionId: 'sess-1' },
    })
  })

  it('falls back to home without a session', () => {
    expect(resolveSettingsExitTarget(null)).toEqual({ to: '/' })
    expect(resolveSettingsExitTarget(undefined)).toEqual({ to: '/' })
    expect(resolveSettingsExitTarget('')).toEqual({ to: '/' })
  })
})

describe('resolveSettingsEntryPath', () => {
  it('defaults to provider settings', () => {
    expect(resolveSettingsEntryPath()).toBe('/settings/provider')
    expect(resolveSettingsEntryPath('/')).toBe('/settings/provider')
  })

  it('normalizes absolute and relative suffixes', () => {
    expect(resolveSettingsEntryPath('/mcp')).toBe('/settings/mcp')
    expect(resolveSettingsEntryPath('chat')).toBe('/settings/chat')
    expect(resolveSettingsEntryPath('/provider/openai')).toBe('/settings/provider/openai')
  })
})
