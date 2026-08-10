import { describe, expect, it } from 'vitest'
import { mentionClassName, mentionKind, MENTION_TOKEN_RE } from './mention-tokens'

describe('mention-tokens', () => {
  it('classifies token kinds', () => {
    expect(mentionKind('@product-manager')).toBe('agent')
    expect(mentionKind('$code-review')).toBe('skill')
    expect(mentionKind('#work-jira')).toBe('account')
    expect(mentionKind('@mem:q3-notes')).toBe('mem')
    expect(mentionKind('plain')).toBe('plain')
  })

  it('builds CSS class names for msg and composer', () => {
    expect(mentionClassName('@alice', 'msg')).toBe('msg-mention msg-mention-agent')
    expect(mentionClassName('$skill', 'composer')).toBe('composer-mention composer-mention-skill')
  })

  it('matches mention tokens in text', () => {
    const text = 'hey @alice use $code-review and #work with @mem:prefs'
    const re = new RegExp(MENTION_TOKEN_RE.source, MENTION_TOKEN_RE.flags)
    const hits: string[] = []
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      hits.push(m[0])
    }
    expect(hits).toEqual(['@alice', '$code-review', '#work', '@mem:prefs'])
  })
})
