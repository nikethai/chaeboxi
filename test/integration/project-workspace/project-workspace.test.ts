import { describe, expect, it } from 'vitest'
import { unwrapWorkspaceBroker } from '@/platform/workspace-broker'
import { resolveProjectContext } from '@/projects/project-context'
import { canAttachContext } from '@/projects/project-context-draft'
import { portableProjectHasNoRoot } from '@/projects/project-migration'
import TestPlatform from '@/platform/test_platform'
import { createWorkspaceFileTools, getStagedChangeSetId } from '@/packages/model-calls/toolsets/file'

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

  it('fail-closed platforms reject bind, stage, apply, and export', async () => {
    const test = new TestPlatform()
    await expect(test.pickAndBindProject('p1')).rejects.toThrow(/UNSUPPORTED_PLATFORM/)
    await expect(test.beginWorkspaceChangeSet()).rejects.toThrow(/UNSUPPORTED_PLATFORM/)
    await expect(test.applyWorkspaceChangeSet()).rejects.toThrow(/UNSUPPORTED_PLATFORM/)
    await expect(test.prepareWorkspaceExport()).rejects.toThrow(/UNSUPPORTED_PLATFORM/)
  })

  it('apply envelope without a one-use ticket is rejected on the shipped unwrap path', () => {
    expect(() =>
      unwrapWorkspaceBroker({ ok: false, error: { code: 'APPLY_TICKET_INVALID', message: 'invalid' } })
    ).toThrow(/APPLY_TICKET_INVALID/)
  })
})

describe('project workspace stage-only tools', () => {
  it('does not register write tools without a capability', () => {
    const tools = createWorkspaceFileTools('no-context')
    expect(Object.keys(tools)).toHaveLength(0)
  })

  it('Change Review reads the live staged change-set id, not an empty string', async () => {
    const { readFileSync } = await import('node:fs')
    const panel = readFileSync(new URL('../../../src/renderer/components/project/ProjectContextPanel.tsx', import.meta.url), 'utf8')
    expect(panel).toMatch(/getStagedChangeSetId/)
    expect(panel).toMatch(/changeSetId=\{changeSetId\}/)
    expect(panel).not.toMatch(/changeSetId=""/)
    expect(getStagedChangeSetId('missing-session')).toBeUndefined()
  })
})
