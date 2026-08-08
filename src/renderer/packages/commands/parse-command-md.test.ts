import { describe, expect, it } from 'vitest'
import { parseCommandMd } from './parse-command-md'

describe('parseCommandMd', () => {
  it('parses frontmatter command', () => {
    const cmd = parseCommandMd(
      `---
name: review
description: Review code
---

Look at the diff carefully.
`
    )
    expect(cmd.name).toBe('review')
    expect(cmd.description).toBe('Review code')
    expect(cmd.instructions).toContain('diff')
  })

  it('loose mode uses filename and normalizes colons', () => {
    const cmd = parseCommandMd('Do the thing.', {
      loose: true,
      fileBaseName: 'ck:plan',
      source: 'agent',
    })
    expect(cmd.name).toBe('ck-plan')
    expect(cmd.instructions).toContain('Do the thing')
  })
})
