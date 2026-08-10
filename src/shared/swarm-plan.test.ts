import { describe, expect, it } from 'vitest'
import { hasActiveSwarmBoard, isSwarmUserInterrupt, parseSwarmPlanFromText } from './swarm-plan'

describe('swarm-plan', () => {
  it('parses fenced JSON task list', () => {
    const text = `Here is the plan:
\`\`\`json
{"tasks":[{"title":"Research competitors","assignee":"Researcher"},{"title":"Draft outline","dependsOn":["Research competitors"]}]}
\`\`\`
`
    const drafts = parseSwarmPlanFromText(text)
    expect(drafts).toHaveLength(2)
    expect(drafts[0]).toMatchObject({ title: 'Research competitors', assigneeHint: 'Researcher' })
    expect(drafts[1].dependsOnTitles).toEqual(['Research competitors'])
  })

  it('parses bare array of tasks', () => {
    const text = 'Plan: [{"title":"Step A"},{"title":"Step B"}]'
    expect(parseSwarmPlanFromText(text).map((d) => d.title)).toEqual(['Step A', 'Step B'])
  })

  it('returns empty for prose without plan', () => {
    expect(parseSwarmPlanFromText('Just chatting about architecture.')).toEqual([])
  })

  it('parses markdown bullet lists as fallback', () => {
    const text = `
Here is the breakdown:
- Research Hermes SDK APIs
- Design Pi SDK integration
- Critique architecture trade-offs
`
    const drafts = parseSwarmPlanFromText(text)
    expect(drafts.map((d) => d.title)).toEqual([
      'Research Hermes SDK APIs',
      'Design Pi SDK integration',
      'Critique architecture trade-offs',
    ])
  })

  it('detects active swarm board', () => {
    expect(hasActiveSwarmBoard([{ status: 'done' }])).toBe(false)
    expect(hasActiveSwarmBoard([{ status: 'pending' }])).toBe(true)
  })

  describe('isSwarmUserInterrupt', () => {
    it('does not treat starter user message as interrupt', () => {
      expect(
        isSwarmUserInterrupt({
          baselineMsgCount: 1,
          baselineLastId: 'u1',
          messages: [{ id: 'u1', role: 'user' }],
        })
      ).toBe(false)
    })

    it('does not interrupt after assistant plan reply', () => {
      expect(
        isSwarmUserInterrupt({
          baselineMsgCount: 1,
          baselineLastId: 'u1',
          messages: [
            { id: 'u1', role: 'user' },
            { id: 'a1', role: 'assistant' },
          ],
        })
      ).toBe(false)
    })

    it('detects new user message mid-swarm', () => {
      expect(
        isSwarmUserInterrupt({
          baselineMsgCount: 1,
          baselineLastId: 'u1',
          messages: [
            { id: 'u1', role: 'user' },
            { id: 'a1', role: 'assistant' },
            { id: 'u2', role: 'user' },
          ],
        })
      ).toBe(true)
    })
  })
})
