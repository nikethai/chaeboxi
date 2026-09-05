import { describe, expect, it, vi } from 'vitest'
import { createWorkspaceFileTools, getStagedChangeSetId } from './file'

const createWorkspaceFile = vi.fn()
const editWorkspaceFile = vi.fn()
const deleteWorkspaceFile = vi.fn()
const beginWorkspaceChangeSet = vi.fn()
const appendWorkspaceChange = vi.fn()

vi.mock('@/platform', () => ({
  default: {
    type: 'desktop',
    createWorkspaceFile: (...args: unknown[]) => createWorkspaceFile(...args),
    editWorkspaceFile: (...args: unknown[]) => editWorkspaceFile(...args),
    deleteWorkspaceFile: (...args: unknown[]) => deleteWorkspaceFile(...args),
    beginWorkspaceChangeSet: (...args: unknown[]) => beginWorkspaceChangeSet(...args),
    appendWorkspaceChange: (...args: unknown[]) => appendWorkspaceChange(...args),
  },
}))

describe('workspace mutation tools', () => {
  it('does not register tools without mutationEnabled capability', () => {
    const tools = createWorkspaceFileTools({
      capabilityId: 'cap',
      projectId: 'p',
      rootGeneration: 'g',
      mutationEnabled: false,
    })
    expect(Object.keys(tools)).toHaveLength(0)
  })

  it('rejects absolute paths and does not call native write or staging', async () => {
    const tools = createWorkspaceFileTools({
      capabilityId: 'cap',
      projectId: 'p',
      rootGeneration: 'g',
      mutationEnabled: true,
    })
    const result = await (
      tools.create_file as unknown as { execute: (i: unknown) => Promise<{ code?: string }> }
    ).execute({
      path: '/etc/passwd',
      content: 'x',
    })
    expect(result.code).toBe('OUTSIDE_ROOT')
    expect(createWorkspaceFile).not.toHaveBeenCalled()
    expect(appendWorkspaceChange).not.toHaveBeenCalled()
  })

  it('stages create and never calls native Project-file write', async () => {
    beginWorkspaceChangeSet.mockResolvedValueOnce({ changeSetId: 'cs-1' })
    appendWorkspaceChange.mockResolvedValueOnce({ operationId: 'op-1', staged: true })
    const tools = createWorkspaceFileTools({
      capabilityId: 'cap',
      projectId: 'p',
      rootGeneration: 'g',
      mutationEnabled: true,
      sessionId: 'sess-stage',
    })
    const result = await (
      tools.create_file as unknown as {
        execute: (i: unknown) => Promise<{ success?: boolean; staged?: boolean; changeSetId?: string }>
      }
    ).execute({
      path: 'a.txt',
      content: 'hello',
    })
    expect(createWorkspaceFile).not.toHaveBeenCalled()
    expect(beginWorkspaceChangeSet).toHaveBeenCalledWith('cap', 'sess-stage', '')
    expect(appendWorkspaceChange).toHaveBeenCalledWith(
      'cs-1',
      expect.objectContaining({ kind: 'create', relativePath: 'a.txt' })
    )
    expect(result.success).toBe(true)
    expect(result.staged).toBe(true)
    expect(result.changeSetId).toBe('cs-1')
    expect(getStagedChangeSetId('sess-stage')).toBe('cs-1')
  })

  it('stages edit conflict metadata without native write', async () => {
    beginWorkspaceChangeSet.mockResolvedValueOnce({ changeSetId: 'cs-2' })
    appendWorkspaceChange.mockResolvedValueOnce({ operationId: 'op-2', staged: true })
    const tools = createWorkspaceFileTools({
      capabilityId: 'cap',
      projectId: 'p',
      rootGeneration: 'g',
      mutationEnabled: true,
      sessionId: 'sess-edit',
    })
    const result = await (
      tools.edit_file as unknown as { execute: (i: unknown) => Promise<{ success?: boolean; staged?: boolean }> }
    ).execute({
      path: 'a.txt',
      old_string: 'a',
      new_string: 'b',
      expected_revision: 'old',
    })
    expect(editWorkspaceFile).not.toHaveBeenCalled()
    expect(result.success).toBe(true)
    expect(result.staged).toBe(true)
  })

  it('stages overwrite as full content without native write', async () => {
    beginWorkspaceChangeSet.mockResolvedValueOnce({ changeSetId: 'cs-3' })
    appendWorkspaceChange.mockResolvedValueOnce({ operationId: 'op-3', staged: true })
    const tools = createWorkspaceFileTools({
      capabilityId: 'cap',
      projectId: 'p',
      rootGeneration: 'g',
      mutationEnabled: true,
      sessionId: 'sess-overwrite',
    })
    await (
      tools.create_file as unknown as { execute: (i: unknown) => Promise<unknown> }
    ).execute({
      path: 'a.txt',
      content: 'omega',
      mode: 'overwrite',
      expected_revision: 'old',
    })
    expect(createWorkspaceFile).not.toHaveBeenCalled()
    expect(appendWorkspaceChange).toHaveBeenCalledWith(
      'cs-3',
      expect.objectContaining({ kind: 'edit', relativePath: 'a.txt', content: 'omega' })
    )
    expect(getStagedChangeSetId('sess-overwrite')).toBe('cs-3')
  })
})
