import { describe, expect, it } from 'vitest'
import { filterSystemCommands, matchSystemSlashCommand } from './system-commands'

describe('system-commands', () => {
  it('matches /compact and aliases as whole-message commands', () => {
    expect(matchSystemSlashCommand('/compact')?.id).toBe('compact')
    expect(matchSystemSlashCommand('  /compact  ')?.id).toBe('compact')
    expect(matchSystemSlashCommand('/compress')?.id).toBe('compact')
    expect(matchSystemSlashCommand('/summarize')?.id).toBe('compact')
  })

  it('does not match prose or package-style mid-text tokens', () => {
    expect(matchSystemSlashCommand('please /compact later')).toBe(null)
    expect(matchSystemSlashCommand('/compact the chat now')).toBe(null)
    expect(matchSystemSlashCommand('hello')).toBe(null)
    expect(matchSystemSlashCommand('/')).toBe(null)
  })

  it('filters picker by query', () => {
    expect(filterSystemCommands('').map((c) => c.name)).toContain('compact')
    expect(filterSystemCommands('comp').map((c) => c.name)).toEqual(['compact'])
    expect(filterSystemCommands('zzz')).toEqual([])
  })
})
