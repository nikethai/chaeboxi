import { ToolRiskTier } from '@shared/types/mcp'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getToolApprovalMock = vi.hoisted(() => vi.fn())
const addAuditEntryMock = vi.hoisted(() => vi.fn())
const addApprovalMock = vi.hoisted(() => vi.fn())
const removeApprovalMock = vi.hoisted(() => vi.fn())
const showModalMock = vi.hoisted(() => vi.fn())

vi.mock('@/stores/toolApprovalStore', () => ({
  getToolApproval: getToolApprovalMock,
  toolApprovalStore: {
    getState: () => ({
      addAuditEntry: addAuditEntryMock,
      addApproval: addApprovalMock,
      removeApproval: removeApprovalMock,
    }),
  },
}))

vi.mock('@ebay/nice-modal-react', () => ({
  default: {
    show: showModalMock,
  },
}))

vi.mock('../tools/risk-engine', () => ({
  getToolRiskTier: (name: string) => {
    if (name === 'delete_file' || name === 'edit_file' || name === 'create_file') return ToolRiskTier.HIGH
    if (name === 'web_search') return ToolRiskTier.LOW
    return ToolRiskTier.MEDIUM
  },
}))

vi.mock('i18next', () => ({
  t: (s: string) => s,
}))

import { wrapToolsWithApproval, workspaceApprovalFingerprint } from './wrap-tools-approval'

describe('wrapToolsWithApproval shipped wrapper', () => {
  beforeEach(() => {
    getToolApprovalMock.mockReset()
    addAuditEntryMock.mockReset()
    addApprovalMock.mockReset()
    removeApprovalMock.mockReset()
    showModalMock.mockReset()
  })

  it('never session-auto-approves delete_file even with a session HIGH approval', async () => {
    getToolApprovalMock.mockReturnValue({
      toolName: 'delete_file',
      riskTier: ToolRiskTier.HIGH,
      scope: 'session',
      timestamp: 1,
      argsFingerprint: workspaceApprovalFingerprint('delete_file', { path: 'a.txt' }),
    })
    const execute = vi.fn(async () => ({ ok: true }))
    const wrapped = wrapToolsWithApproval('sess-1', {
      delete_file: { description: 'delete a file', execute },
    } as never)
    showModalMock.mockResolvedValue('deny')
    const result = await (wrapped.delete_file as { execute: (a: unknown, c: unknown) => Promise<{ denied?: boolean }> }).execute(
      { path: 'a.txt', expected_revision: 'r' },
      {}
    )
    expect(execute).not.toHaveBeenCalled()
    expect(result.denied).toBe(true)
    expect(showModalMock).toHaveBeenCalled()
  })

  it('stores argsFingerprint and requires a new approval when args change', async () => {
    getToolApprovalMock.mockReturnValue(undefined)
    const execute = vi.fn(async () => ({ ok: true }))
    const wrapped = wrapToolsWithApproval('sess-1', {
      edit_file: { description: 'edit a file', execute },
    } as never)
    showModalMock.mockResolvedValue('once')
    const args = { path: 'a.txt', old_string: 'a', new_string: 'b', expected_revision: 'r1' }
    await (wrapped.edit_file as { execute: (a: unknown, c: unknown) => Promise<unknown> }).execute(args, {})
    expect(addApprovalMock).toHaveBeenCalledWith(
      'sess-1',
      expect.objectContaining({
        toolName: 'edit_file',
        argsFingerprint: workspaceApprovalFingerprint('edit_file', args),
      })
    )
    expect(execute).toHaveBeenCalled()

    addApprovalMock.mockClear()
    execute.mockClear()
    showModalMock.mockClear()
    const previous = workspaceApprovalFingerprint('edit_file', args)
    getToolApprovalMock.mockReturnValue({
      toolName: 'edit_file',
      riskTier: ToolRiskTier.HIGH,
      scope: 'session',
      timestamp: 1,
      argsFingerprint: previous,
    })
    showModalMock.mockResolvedValue('once')
    const changed = { ...args, new_string: 'c' }
    await (wrapped.edit_file as { execute: (a: unknown, c: unknown) => Promise<unknown> }).execute(changed, {})
    expect(showModalMock).toHaveBeenCalled()
    expect(addApprovalMock).toHaveBeenCalledWith(
      'sess-1',
      expect.objectContaining({
        argsFingerprint: workspaceApprovalFingerprint('edit_file', changed),
      })
    )
  })

  it('auto-approves LOW tools without a modal', async () => {
    getToolApprovalMock.mockReturnValue(undefined)
    const execute = vi.fn(async () => ({ hits: [] }))
    const wrapped = wrapToolsWithApproval('sess-1', {
      web_search: { description: 'search the web', execute },
    } as never)
    await (wrapped.web_search as { execute: (a: unknown, c: unknown) => Promise<unknown> }).execute({ q: 'x' }, {})
    expect(showModalMock).not.toHaveBeenCalled()
    expect(execute).toHaveBeenCalled()
  })
})
