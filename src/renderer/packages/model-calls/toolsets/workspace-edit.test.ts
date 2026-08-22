import { describe, expect, it, vi } from 'vitest'
import { createWorkspaceFileTools } from './file'

const createWorkspaceFile = vi.fn()
const editWorkspaceFile = vi.fn()
const deleteWorkspaceFile = vi.fn()

vi.mock('@/platform', () => ({
  default: {
    type: 'desktop',
    createWorkspaceFile: (...args: unknown[]) => createWorkspaceFile(...args),
    editWorkspaceFile: (...args: unknown[]) => editWorkspaceFile(...args),
    deleteWorkspaceFile: (...args: unknown[]) => deleteWorkspaceFile(...args),
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

  it('rejects absolute paths and does not call native write', async () => {
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
  })

  it('forwards create through the native capability API', async () => {
    createWorkspaceFile.mockResolvedValueOnce({ ok: true, revision: 'abc', relativePath: 'a.txt' })
    const tools = createWorkspaceFileTools({
      capabilityId: 'cap',
      projectId: 'p',
      rootGeneration: 'g',
      mutationEnabled: true,
    })
    const result = await (
      tools.create_file as unknown as { execute: (i: unknown) => Promise<{ success?: boolean; revision?: string }> }
    ).execute({
      path: 'a.txt',
      content: 'hello',
    })
    expect(createWorkspaceFile).toHaveBeenCalledWith('cap', 'a.txt', 'hello', 'create', undefined)
    expect(result.success).toBe(true)
    expect(result.revision).toBe('abc')
  })

  it('surfaces CONFLICT from native edit', async () => {
    editWorkspaceFile.mockResolvedValueOnce({ ok: false, code: 'CONFLICT' })
    const tools = createWorkspaceFileTools({
      capabilityId: 'cap',
      projectId: 'p',
      rootGeneration: 'g',
      mutationEnabled: true,
    })
    const result = await (
      tools.edit_file as unknown as { execute: (i: unknown) => Promise<{ success?: boolean; code?: string }> }
    ).execute({
      path: 'a.txt',
      old_string: 'a',
      new_string: 'b',
      expected_revision: 'old',
    })
    expect(result.success).toBe(false)
    expect(result.code).toBe('CONFLICT')
  })
})
