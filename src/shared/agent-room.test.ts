import { describe, expect, it } from 'vitest'
import {
  buildRoomProtocol,
  buildSpeakerTurnQueue,
  mergeRoomMembers,
  normalizeSessionAgentIds,
  resolveSpeakers,
  toSessionAgentFields,
} from './agent-room'

describe('agent-room', () => {
  it('normalizes copilotId into agentIds', () => {
    expect(normalizeSessionAgentIds({ copilotId: 'a' })).toEqual(['a'])
    expect(normalizeSessionAgentIds({ agentIds: ['b', 'c'], copilotId: 'a' })).toEqual(['b', 'c'])
    expect(normalizeSessionAgentIds({})).toEqual([])
  })

  it('merges room members with cap and uniqueness', () => {
    expect(mergeRoomMembers(['a'], ['b', 'a', 'c'], 3)).toEqual(['a', 'b', 'c'])
    expect(mergeRoomMembers(['a', 'b', 'c'], ['d'], 3)).toEqual(['a', 'b', 'c'])
  })

  it('resolves speakers from mentions or room', () => {
    expect(resolveSpeakers(['a', 'b'], ['b'])).toEqual(['b'])
    expect(resolveSpeakers(['a', 'b'], [])).toEqual(['a', 'b'])
    expect(resolveSpeakers(['a', 'b'], undefined)).toEqual(['a', 'b'])
  })

  it('dual-writes copilotId as first agent', () => {
    expect(toSessionAgentFields(['x', 'y'])).toEqual({ agentIds: ['x', 'y'], copilotId: 'x' })
    expect(toSessionAgentFields([])).toEqual({ agentIds: undefined, copilotId: undefined })
  })

  it('builds turn queue for rounds with max turns', () => {
    expect(buildSpeakerTurnQueue(['a', 'b'], 2, 6)).toEqual(['a', 'b', 'a', 'b'])
    expect(buildSpeakerTurnQueue(['a', 'b', 'c'], 2, 4)).toEqual(['a', 'b', 'c', 'a'])
    expect(buildSpeakerTurnQueue(['solo'], 2, 6)).toEqual(['solo'])
  })

  it('builds room protocol mentioning speaker', () => {
    const p = buildRoomProtocol('Code Assistant', ['Code Assistant', 'Deep Researcher'])
    expect(p).toContain('Code Assistant')
    expect(p).toContain('Deep Researcher')
    expect(p).toContain('Slack')
  })
})
