import { describe, expect, it } from 'vitest'
import { toggleAgentSelection, toSessionAgentFieldsFromSelection } from './new-chat-agents'

describe('new-chat-agents', () => {
  it('toggles add and remove', () => {
    expect(toggleAgentSelection([], 'a').next).toEqual(['a'])
    expect(toggleAgentSelection(['a'], 'b').next).toEqual(['a', 'b'])
    expect(toggleAgentSelection(['a', 'b'], 'a').next).toEqual(['b'])
  })

  it('rejects at cap', () => {
    const r = toggleAgentSelection(['a', 'b', 'c'], 'd', 3)
    expect(r.next).toEqual(['a', 'b', 'c'])
    expect(r.rejected).toBe('at_cap')
  })

  it('dual-writes copilotId as first selected', () => {
    expect(toSessionAgentFieldsFromSelection(['x', 'y'])).toEqual({
      agentIds: ['x', 'y'],
      copilotId: 'x',
    })
    expect(toSessionAgentFieldsFromSelection([])).toEqual({
      agentIds: undefined,
      copilotId: undefined,
    })
  })
})
