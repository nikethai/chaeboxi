import { describe, expect, it } from 'vitest'
import { isValidSkillName, normalizeSkillName, parseSkillMd, serializeSkillMd, SkillParseError } from './parse-skill-md'
import { getBuiltinSkills } from './builtins'
import { extractSkillNamesFromText, getActiveSkillDollarQuery, stripSkillDollarTokens } from './dollar-tokens'
import { buildSkillContextBlocks, resolveSkillActivations, scoreSkillsForText } from './activation'

describe('isValidSkillName', () => {
  it('accepts kebab-case names', () => {
    expect(isValidSkillName('code-review')).toBe(true)
    expect(isValidSkillName('pdf')).toBe(true)
  })
  it('rejects invalid names', () => {
    expect(isValidSkillName('Code-Review')).toBe(false)
    expect(isValidSkillName('-pdf')).toBe(false)
    expect(isValidSkillName('pdf-')).toBe(false)
    expect(isValidSkillName('pdf--x')).toBe(false)
    expect(isValidSkillName('')).toBe(false)
  })
})

describe('normalizeSkillName', () => {
  it('normalizes ecosystem names', () => {
    expect(normalizeSkillName('ckm:write')).toBe('ckm-write')
    expect(normalizeSkillName('CK:Plan')).toBe('ck-plan')
  })
})

describe('parseSkillMd loose', () => {
  it('accepts colon names from agent folders', () => {
    const skill = parseSkillMd(
      `---
name: ckm:write
description: Write creative copy for marketing.
---

# Body
`,
      { loose: true, folderName: 'write', source: 'agent', origin: 'claude' }
    )
    expect(skill.name).toBe('ckm-write')
    expect(skill.source).toBe('agent')
    expect(skill.origin).toBe('claude')
  })
})

describe('parseSkillMd', () => {
  it('parses valid SKILL.md', () => {
    const skill = parseSkillMd(`---
name: my-skill
description: Does something useful when user asks.
---

# Body

Do the thing.
`)
    expect(skill.name).toBe('my-skill')
    expect(skill.description).toContain('Does something')
    expect(skill.instructions).toContain('Do the thing')
    expect(skill.source).toBe('user')
  })

  it('throws without frontmatter', () => {
    expect(() => parseSkillMd('# no fm')).toThrow(SkillParseError)
  })

  it('throws on bad name', () => {
    expect(() =>
      parseSkillMd(`---
name: BAD_NAME
description: x
---
body
`)
    ).toThrow(SkillParseError)
  })

  it('roundtrips via serialize', () => {
    const original = parseSkillMd(`---
name: round-trip
description: Test description here.
---

Instructions line.
`)
    const again = parseSkillMd(serializeSkillMd(original))
    expect(again.name).toBe(original.name)
    expect(again.description).toBe(original.description)
    expect(again.instructions).toContain('Instructions')
  })
})

describe('builtins', () => {
  it('loads three valid builtins', () => {
    const builtins = getBuiltinSkills()
    expect(builtins.length).toBe(3)
    for (const b of builtins) {
      expect(isValidSkillName(b.name)).toBe(true)
      expect(b.source).toBe('builtin')
      expect(b.enabled).toBe(true)
    }
  })
})

describe('dollar tokens', () => {
  it('extracts skill names and ignores currency', () => {
    expect(extractSkillNamesFromText('fix $100 and $code-review please')).toEqual(['code-review'])
  })

  it('strips skill tokens', () => {
    expect(stripSkillDollarTokens('Review this $code-review now')).toBe('Review this now')
  })

  it('detects active query at end', () => {
    expect(getActiveSkillDollarQuery('hello $cod')).toBe('cod')
    expect(getActiveSkillDollarQuery('hello $')).toBe('')
    expect(getActiveSkillDollarQuery('hello $100')).toBe(null)
    expect(getActiveSkillDollarQuery('no trigger')).toBe(null)
  })

  it('replaces active partial with completed skill token', async () => {
    const { replaceActiveSkillDollarWithToken } = await import('./dollar-tokens')
    expect(replaceActiveSkillDollarWithToken('use $cod', 'code-review')).toBe('use $code-review ')
    expect(replaceActiveSkillDollarWithToken('$', 'writing-editor')).toBe('$writing-editor ')
  })
})

describe('activation', () => {
  const skills = getBuiltinSkills()

  it('resolves explicit skills', () => {
    const acts = resolveSkillActivations({
      skills,
      explicitSkillIds: ['builtin:code-review', 'writing-editor'],
      autoSkills: false,
    })
    expect(acts.map((a) => a.name).sort()).toEqual(['code-review', 'writing-editor'])
    expect(acts.every((a) => a.mode === 'explicit')).toBe(true)
  })

  it('auto-selects from user text', () => {
    const acts = resolveSkillActivations({
      skills,
      userText: 'Please review this PR for bugs and security issues',
      autoSkills: true,
    })
    expect(acts.some((a) => a.name === 'code-review' && a.mode === 'auto')).toBe(true)
    expect(acts.some((a) => a.name === 'writing-editor')).toBe(false)
  })

  it('respects auto off', () => {
    const acts = resolveSkillActivations({
      skills,
      userText: 'Please review this PR for bugs',
      autoSkills: false,
    })
    expect(acts).toHaveLength(0)
  })

  it('scores research text toward deep-research', () => {
    const ranked = scoreSkillsForText('research this topic and cite sources with evidence', skills)
    expect(ranked[0]?.skill.name).toBe('deep-research')
  })

  it('does not auto-pick code-review for pure grammar fixes', () => {
    const acts = resolveSkillActivations({
      skills,
      userText: 'Help correct grammar and improve this sentence about a web page',
      autoSkills: true,
    })
    expect(acts.map((a) => a.name)).toEqual(['writing-editor'])
  })

  it('builds context blocks with catalog and active body', () => {
    const acts = resolveSkillActivations({
      skills,
      explicitSkillIds: ['builtin:code-review'],
      autoSkills: false,
    })
    const map = new Map(skills.map((s) => [s.id, s]))
    const block = buildSkillContextBlocks(skills, acts, map)
    expect(block).toContain('## Available skills')
    expect(block).toContain('code-review:')
    expect(block).toContain('## Active skills')
    expect(block).toContain('Code Review')
  })
})
