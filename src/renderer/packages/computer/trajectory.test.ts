import { describe, expect, it } from 'vitest'
import {
  exportComputerTrajectoryText,
  getComputerTrajectory,
  isAppAllowedByAllowlist,
  recordComputerTrajectory,
  resetComputerTrajectory,
  summarizeToolArgs,
} from './trajectory'

describe('trajectory buffer', () => {
  it('records and exports', () => {
    resetComputerTrajectory('s1')
    recordComputerTrajectory('s1', { tool: 'computer_open_app', summary: 'name=WhatsApp', ok: true })
    recordComputerTrajectory('s1', { tool: 'computer_click', summary: 'x=1,y=2', ok: true })
    expect(getComputerTrajectory('s1')).toHaveLength(2)
    const text = exportComputerTrajectoryText('s1')
    expect(text).toContain('computer_open_app')
    expect(text).toContain('WhatsApp')
  })
})

describe('allowlist', () => {
  it('allows all when empty', () => {
    expect(isAppAllowedByAllowlist('Finder', [])).toBe(true)
    expect(isAppAllowedByAllowlist('Finder', undefined)).toBe(true)
  })
  it('filters when set', () => {
    expect(isAppAllowedByAllowlist('WhatsApp', ['WhatsApp', 'Calculator'])).toBe(true)
    expect(isAppAllowedByAllowlist('Finder', ['WhatsApp'])).toBe(false)
  })
})

describe('summarizeToolArgs', () => {
  it('redacts long type payloads', () => {
    expect(summarizeToolArgs('computer_type', { text: 'a'.repeat(100) })).toBe('textLen=100')
    expect(summarizeToolArgs('computer_open_app', { name: 'X' })).toBe('name=X')
  })
})
