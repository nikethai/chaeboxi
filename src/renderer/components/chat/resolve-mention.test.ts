import { describe, expect, it } from 'vitest'
import { humanizeSlug, resolveMentionToken, type MentionCatalog } from './resolve-mention'

const catalog: MentionCatalog = {
  agents: [
    {
      id: 'a1',
      name: 'Product Manager',
      emojiAvatar: '📋',
      demoQuestion: 'Help ship the roadmap',
      prompt: '',
    },
  ],
  skills: [{ id: 's1', name: 'code-review', description: 'Review pull requests carefully' }],
  accounts: [{ id: 'c1', label: 'Work Jira', connectorId: 'jira', connectorName: 'Jira' }],
  memoryEntries: [{ id: 'm1', content: 'Q3 goals locked', tags: ['q3-notes'] }],
}

describe('resolveMentionToken', () => {
  it('humanizes slugs', () => {
    expect(humanizeSlug('product-manager')).toBe('Product manager')
  })

  it('resolves agents with display name', () => {
    const r = resolveMentionToken('@product-manager', catalog)
    expect(r.resolved).toBe(true)
    expect(r.label).toBe('Product Manager')
    expect(r.emoji).toBe('📋')
    expect(r.description).toMatch(/roadmap/i)
  })

  it('resolves skills', () => {
    const r = resolveMentionToken('$code-review', catalog)
    expect(r.resolved).toBe(true)
    expect(r.label).toBe('code-review')
    expect(r.description).toMatch(/pull requests/i)
  })

  it('resolves accounts', () => {
    const r = resolveMentionToken('#work-jira', catalog)
    expect(r.resolved).toBe(true)
    expect(r.label).toBe('Work Jira')
  })

  it('resolves memory tags', () => {
    const r = resolveMentionToken('@mem:q3-notes', catalog)
    expect(r.resolved).toBe(true)
    expect(r.label).toBe('q3-notes')
    expect(r.description).toMatch(/Q3 goals/i)
  })
})
