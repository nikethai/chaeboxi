import { describe, expect, it } from 'vitest'
import {
  agentAvatarAccent,
  openClawAgentAvatarId,
  proceduralAgentAvatar,
  resolveAgentAvatar,
  resolveOpenClawAgentAvatar,
} from './agent-avatar'

describe('proceduralAgentAvatar', () => {
  it('is deterministic for the same id', () => {
    const a = proceduralAgentAvatar('builtin:deep-researcher', { role: 'research' })
    const b = proceduralAgentAvatar('builtin:deep-researcher', { role: 'research' })
    expect(a.src).toBe(b.src)
    expect(a.accent).toBe(b.accent)
  })

  it('differs across agent ids', () => {
    const a = proceduralAgentAvatar('builtin:deep-researcher')
    const b = proceduralAgentAvatar('builtin:code-assistant')
    expect(a.src).not.toBe(b.src)
  })

  it('changes when seed changes', () => {
    const a = proceduralAgentAvatar('agent-1', { seed: 'seed-a' })
    const b = proceduralAgentAvatar('agent-1', { seed: 'seed-b' })
    expect(a.src).not.toBe(b.src)
  })

  it('returns svg data uri', () => {
    const { src } = proceduralAgentAvatar('x')
    expect(src.startsWith('data:image/svg+xml')).toBe(true)
  })
})

describe('resolveAgentAvatar', () => {
  it('prefers avatarKey over picUrl and procedural', () => {
    const r = resolveAgentAvatar({
      id: 'a1',
      avatarKey: 'picture:agent-a1',
      picUrl: 'https://example.com/x.png',
    })
    expect(r).toEqual({ kind: 'blob', storageKey: 'picture:agent-a1' })
  })

  it('prefers picUrl over procedural', () => {
    const r = resolveAgentAvatar({
      id: 'a1',
      picUrl: 'https://example.com/x.png',
    })
    expect(r).toEqual({ kind: 'url', url: 'https://example.com/x.png' })
  })

  it('falls back to procedural and never letters', () => {
    const r = resolveAgentAvatar({ id: 'custom:1', role: 'code' })
    expect(r?.kind).toBe('procedural')
    if (r?.kind === 'procedural') {
      expect(r.src.startsWith('data:image/svg+xml')).toBe(true)
    }
  })

  it('returns null without id', () => {
    expect(resolveAgentAvatar(null)).toBeNull()
    expect(resolveAgentAvatar({ id: '' })).toBeNull()
  })
})

describe('openClaw avatars', () => {
  it('namespaces ids', () => {
    expect(openClawAgentAvatarId('main')).toBe('openclaw:main')
    expect(openClawAgentAvatarId('openclaw:main')).toBe('openclaw:main')
  })

  it('resolves procedural openclaw avatars', () => {
    const r = resolveOpenClawAgentAvatar('pi-agent')
    expect(r.kind).toBe('procedural')
  })
})

describe('agentAvatarAccent', () => {
  it('matches procedural accent', () => {
    const { accent } = proceduralAgentAvatar('z')
    expect(agentAvatarAccent('z')).toBe(accent)
  })
})
