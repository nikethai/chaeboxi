import { describe, expect, it } from 'vitest'
import { resolveProjectContext } from '@/projects/project-context'
import { canAttachContext } from '@/projects/project-context-draft'
import { portableProjectHasNoRoot } from '@/projects/project-migration'

describe('project workspace contracts', () => {
  it('never treats a pasted root as authority when projectId is set', () => {
    const result = resolveProjectContext({
      session: { projectId: 'p1', workspaceRoot: '/secret' },
      descriptor: null,
    })
    expect(result.kind).toBe('unavailable')
  })

  it('keeps portable Project metadata free of roots', () => {
    expect(portableProjectHasNoRoot({ id: 'p', name: 'n', order: 0, capabilityId: 'x' })).toBe(false)
    expect(portableProjectHasNoRoot({ id: 'p', name: 'n', order: 0 })).toBe(true)
  })

  it('blocks secret attach in the one-send draft', () => {
    const decision = canAttachContext([], {
      projectId: 'p',
      rootGeneration: 'g',
      relativePath: '.env',
      revision: 'r',
      excerpt: 'SECRET=1',
      byteLength: 8,
    })
    expect(decision.ok).toBe(false)
  })
})
