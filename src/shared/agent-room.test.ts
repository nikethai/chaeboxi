import { describe, expect, it } from 'vitest'
import {
  buildRoomContinuePrompt,
  buildRoomProtocol,
  buildSpeakerTurnQueue,
  buildSynthesisProtocol,
  canKeepDiscussing,
  mergeRoomMembers,
  normalizeSessionAgentIds,
  resolveRoomLead,
  resolveSpeakers,
  resolveStanceLabel,
  resolveSynthesisLead,
  roomRoleAllowsTools,
  roundForQueueIndex,
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
    // Default rounds=2: every tagged agent speaks twice
    expect(buildSpeakerTurnQueue(['a', 'b', 'c'])).toEqual(['a', 'b', 'c', 'a', 'b', 'c'])
    expect(buildSpeakerTurnQueue(['solo'], 2, 6)).toEqual(['solo'])
  })

  it('maps queue index to round', () => {
    expect(roundForQueueIndex(0, 2)).toBe(1)
    expect(roundForQueueIndex(1, 2)).toBe(1)
    expect(roundForQueueIndex(2, 2)).toBe(2)
  })

  it('builds room protocol with stance and round-2 rebuttal rules', () => {
    const p = buildRoomProtocol('Code Assistant', ['Code Assistant', 'Deep Researcher'], {
      roomRound: 2,
      stanceLabel: 'Critic',
    })
    expect(p).toContain('Code Assistant')
    expect(p).toContain('Deep Researcher')
    expect(p).toContain('Team discussion')
    expect(p).toContain('round 2')
    expect(p).toContain('Critic')
    expect(p).toContain('agree, disagree, or extend')
    expect(p).toContain('NOT available')
    expect(p).toContain('Team answer')
    expect(p).toContain('mermaid')
  })

  it('builds continue prompt naming the next speaker and mermaid reminder', () => {
    expect(buildRoomContinuePrompt('IT Expert')).toContain('IT Expert')
    expect(buildRoomContinuePrompt('IT Expert')).toContain('discussion')
    expect(buildRoomContinuePrompt('IT Expert')).toContain('mermaid')
    expect(buildRoomContinuePrompt('Code Assistant', 'synthesis')).toContain('Team answer')
    expect(buildRoomContinuePrompt('Code Assistant', 'synthesis')).toContain('mermaid')
    expect(buildRoomContinuePrompt('Lead', 'do')).toContain('executor')
  })

  it('builds synthesis protocol for lead with mermaid diagram rules', () => {
    const p = buildSynthesisProtocol('Task Planner', ['Task Planner', 'Code Assistant'])
    expect(p).toContain('Task Planner')
    expect(p).toContain('Code Assistant')
    expect(p).toContain('Team answer')
    expect(p).toContain('complete')
    expect(p).toContain('NOT available')
    expect(p).toContain('mermaid')
    expect(p).toContain('sequenceDiagram')
  })

  it('resolves synthesis lead as first speaker only when multi', () => {
    expect(resolveSynthesisLead(['a', 'b'])).toBe('a')
    expect(resolveSynthesisLead(['a', 'b'], 'b')).toBe('b')
    expect(resolveSynthesisLead(['solo'])).toBeUndefined()
    expect(resolveSynthesisLead([])).toBeUndefined()
  })

  it('resolves room lead with override', () => {
    expect(resolveRoomLead(['a', 'b'], 'b')).toBe('b')
    expect(resolveRoomLead(['a', 'b'], 'z')).toBe('a')
  })

  it('stance labels for discuss', () => {
    expect(resolveStanceLabel(0, 2)).toBe('Proposer')
    expect(resolveStanceLabel(1, 2)).toBe('Critic')
    expect(resolveStanceLabel(2, 3)).toBe('Integrator')
  })

  it('gates synthesis on explicit request only', () => {
    expect(shouldRunSynthesis({ speakerCount: 2, completedDiscussionTurns: 2, interrupted: false })).toBe(false)
    expect(
      shouldRunSynthesis({ speakerCount: 2, completedDiscussionTurns: 2, interrupted: false, requested: true })
    ).toBe(true)
    expect(
      shouldRunSynthesis({ speakerCount: 1, completedDiscussionTurns: 1, interrupted: false, requested: true })
    ).toBe(false)
    expect(
      shouldRunSynthesis({ speakerCount: 2, completedDiscussionTurns: 0, interrupted: false, requested: true })
    ).toBe(false)
    expect(
      shouldRunSynthesis({ speakerCount: 2, completedDiscussionTurns: 3, interrupted: true, requested: true })
    ).toBe(false)
  })

  it('caps keep discussing', () => {
    expect(canKeepDiscussing(2, 3)).toBe(true)
    expect(canKeepDiscussing(3, 3)).toBe(false)
  })

  it('allows tools only on do/deliver', () => {
    expect(roomRoleAllowsTools('do')).toBe(true)
    expect(roomRoleAllowsTools('deliver')).toBe(true)
    expect(roomRoleAllowsTools('turn')).toBe(false)
    expect(roomRoleAllowsTools('synthesis')).toBe(false)
    expect(roomRoleAllowsTools('plan')).toBe(false)
  })
})
