import { toSessionAgentFieldsFromSelection } from '@shared/new-chat-agents'
import type { Session } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { NewChatSearchSchema, seedNewChatSession } from './newChatSearch'

const base = { id: 'new', name: 'Untitled', type: 'chat', messages: [] } as unknown as Session

describe('seedNewChatSession', () => {
  it('maps scopeId to projectId', () => {
    expect(seedNewChatSession(base, { scopeId: 'p1' }).projectId).toBe('p1')
  })

  it('leaves projectId unset for everywhere and for no scope', () => {
    expect(seedNewChatSession(base, { scopeId: 'everywhere' }).projectId).toBeUndefined()
    expect(seedNewChatSession(base, { scopeId: '' }).projectId).toBeUndefined()
    expect(seedNewChatSession(base, {}).projectId).toBeUndefined()
  })

  it('sets agent fields from copilotId', () => {
    const s = seedNewChatSession(base, { copilotId: 'c1' })
    expect(s.copilotId).toBe('c1')
    expect(s).toMatchObject(toSessionAgentFieldsFromSelection(['c1']))
  })

  it('never clears what the user already picked', () => {
    const s = { ...base, copilotId: 'c9', projectId: 'p9' } as Session
    expect(seedNewChatSession(s, {})).toEqual(s)
  })
})

describe('NewChatSearchSchema', () => {
  it('keeps prefill and drops unknown keys', () => {
    expect(NewChatSearchSchema.parse({ prefill: 'x', other: 1 })).toEqual({ prefill: 'x' })
  })
})
