import { describe, expect, it } from 'vitest'
import {
  buildRoomContinuePrompt,
  buildRoomProtocol,
  buildSpeakerTurnQueue,
  buildSynthesisProtocol,
  mergeRoomMembers,
  normalizeSessionAgentIds,
  resolveSpeakers,
  resolveSynthesisLead,
  shouldRunSynthesis,
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
    // Default rounds=1: every tagged agent speaks once
    expect(buildSpeakerTurnQueue(['a', 'b', 'c'])).toEqual(['a', 'b', 'c'])
    expect(buildSpeakerTurnQueue(['solo'], 2, 6)).toEqual(['solo'])
  })

  it('builds room protocol mentioning speaker and deferring final report', () => {
    const p = buildRoomProtocol('Code Assistant', ['Code Assistant', 'Deep Researcher'])
    expect(p).toContain('Code Assistant')
    expect(p).toContain('Deep Researcher')
    expect(p).toContain('Slack')
    expect(p).toContain('synthesis')
    expect(p).toContain('NOT available')
    expect(p).toContain('non-empty')
  })

  it('builds continue prompt naming the next speaker', () => {
    expect(buildRoomContinuePrompt('IT Expert')).toContain('IT Expert')
    expect(buildRoomContinuePrompt('IT Expert')).toContain('discussion')
    expect(buildRoomContinuePrompt('Code Assistant', 'synthesis')).toContain('Final answer')
  })

  it('builds synthesis protocol for lead', () => {
    const p = buildSynthesisProtocol('Task Planner', ['Task Planner', 'Code Assistant'])
    expect(p).toContain('Task Planner')
    expect(p).toContain('Code Assistant')
    expect(p).toContain('Final answer')
    expect(p).toContain('complete')
    expect(p).toContain('NOT available')
  })

  it('resolves synthesis lead as first speaker only when multi', () => {
    expect(resolveSynthesisLead(['a', 'b'])).toBe('a')
    expect(resolveSynthesisLead(['solo'])).toBeUndefined()
    expect(resolveSynthesisLead([])).toBeUndefined()
  })

  it('gates synthesis on multi speakers, completed turns, and interrupt', () => {
    expect(shouldRunSynthesis({ speakerCount: 2, completedDiscussionTurns: 2, interrupted: false })).toBe(true)
    expect(shouldRunSynthesis({ speakerCount: 1, completedDiscussionTurns: 1, interrupted: false })).toBe(false)
    expect(shouldRunSynthesis({ speakerCount: 2, completedDiscussionTurns: 0, interrupted: false })).toBe(false)
    expect(shouldRunSynthesis({ speakerCount: 2, completedDiscussionTurns: 3, interrupted: true })).toBe(false)
  })
})
