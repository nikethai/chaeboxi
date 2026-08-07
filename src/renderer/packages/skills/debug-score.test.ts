import { describe, expect, it } from 'vitest'
import { getBuiltinSkills } from './builtins'
import { resolveSkillActivations, scoreSkillsForText } from './activation'
import { getActiveSkillDollarQuery } from './dollar-tokens'

describe('auto skill routing', () => {
  const skills = getBuiltinSkills()

  it('activates only writing-editor for grammar requests', () => {
    const text =
      'Help e correct grammar and improve: Because the page are using difference region of https://www.example.com/'
    const ranked = scoreSkillsForText(text, skills)
    expect(ranked[0]?.skill.name).toBe('writing-editor')

    const acts = resolveSkillActivations({ skills, userText: text, autoSkills: true })
    expect(acts.map((a) => a.name)).toEqual(['writing-editor'])
    expect(acts.every((a) => a.mode === 'auto')).toBe(true)
  })

  it('activates code-review for PR review requests', () => {
    const text = 'Please review this PR for bugs and security issues'
    const acts = resolveSkillActivations({ skills, userText: text, autoSkills: true })
    expect(acts.some((a) => a.name === 'code-review')).toBe(true)
    expect(acts.some((a) => a.name === 'writing-editor')).toBe(false)
  })

  it('does not auto-activate on weak generic messages', () => {
    const text = 'Hello, how are you today?'
    const acts = resolveSkillActivations({ skills, userText: text, autoSkills: true })
    expect(acts).toHaveLength(0)
  })

  it('detects $ at start of empty draft', () => {
    expect(getActiveSkillDollarQuery('$')).toBe('')
    expect(getActiveSkillDollarQuery('')).toBe(null)
  })
})
