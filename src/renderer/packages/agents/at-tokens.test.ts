import { describe, expect, it } from 'vitest'
import { fuzzyScoreAgent, getActiveAgentAtQuery, stripActiveAgentAtToken } from './at-tokens'

describe('agent at-tokens', () => {
  it('detects active @ query', () => {
    expect(getActiveAgentAtQuery('hello @cod')).toBe('cod')
    expect(getActiveAgentAtQuery('hello @')).toBe('')
    expect(getActiveAgentAtQuery('no trigger')).toBe(null)
    expect(getActiveAgentAtQuery('email@x.com')).toBe(null)
  })

  it('strips active @ token', () => {
    expect(stripActiveAgentAtToken('talk to @cod')).toBe('talk to')
    expect(stripActiveAgentAtToken('@')).toBe('')
  })

  it('fuzzy scores agent names', () => {
    expect(fuzzyScoreAgent('Code Assistant', 'code')).toBeGreaterThan(0)
    expect(fuzzyScoreAgent('Code Assistant', 'zzz')).toBe(0)
  })
})
