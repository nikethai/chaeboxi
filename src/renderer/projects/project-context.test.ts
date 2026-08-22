import { describe, expect, it } from 'vitest'
import type { WorkspaceDescriptor } from '@shared/types/workspace'
import { dualWriteProjectIds, getEffectiveProjectId, resolveProjectContext, tombstoneLegacyRoot } from './project-context'

const ready = (projectId: string): WorkspaceDescriptor => ({
  projectId,
  capabilityId: 'cap-1',
  rootGeneration: 'gen-1',
  displayPath: '/tmp/proj',
  status: 'ready',
})

describe('resolveProjectContext truth table', () => {
  it('uses a valid native binding when projectId is set', () => {
    const result = resolveProjectContext({
      session: { projectId: 'p1', workspaceRoot: '/legacy/stale' },
      descriptor: ready('p1'),
    })
    expect(result.kind).toBe('ready')
    if (result.kind === 'ready') {
      expect(result.descriptor.capabilityId).toBe('cap-1')
    }
  })

  it('never falls back to session workspaceRoot when projectId is set', () => {
    const result = resolveProjectContext({
      session: { projectId: 'p1', workspaceRoot: '/legacy/stale' },
      descriptor: null,
    })
    expect(result.kind).toBe('unavailable')
    if (result.kind === 'unavailable') {
      expect(result.status).toBe('chat-only')
    }
  })

  it('surfaces relink/permission as unavailable, not ready', () => {
    const result = resolveProjectContext({
      session: { projectId: 'p1' },
      descriptor: { ...ready('p1'), capabilityId: '', status: 'relink-required' },
    })
    expect(result.kind).toBe('unavailable')
    if (result.kind === 'unavailable') {
      expect(result.status).toBe('relink-required')
    }
  })

  it('marks loaded legacy roots as reconnect-required without a capability', () => {
    const result = resolveProjectContext({
      session: { workspaceRoot: '/Users/me/old-project' },
    })
    expect(result).toEqual({
      kind: 'legacy-reconnect-required',
      legacyRootHint: '/Users/me/old-project',
    })
  })

  it('is chat-only with no project or root', () => {
    const result = resolveProjectContext({ session: {} })
    expect(result.kind).toBe('chat-only')
  })
})

describe('project id dual-read/write', () => {
  it('prefers projectId then folderId', () => {
    expect(getEffectiveProjectId({ projectId: 'a', folderId: 'b' })).toBe('a')
    expect(getEffectiveProjectId({ folderId: 'b' })).toBe('b')
  })

  it('dual-writes both ids', () => {
    expect(dualWriteProjectIds({ folderId: 'p1' })).toEqual({ folderId: 'p1', projectId: 'p1' })
  })

  it('tombstones legacy roots', () => {
    expect(tombstoneLegacyRoot({ workspaceRoot: '/x', projectId: 'p' }).workspaceRoot).toBeUndefined()
  })
})
