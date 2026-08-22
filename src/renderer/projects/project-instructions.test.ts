import { beforeEach, describe, expect, it, vi } from 'vitest'

const readWorkspaceFile = vi.fn()
const listWorkspaceChildren = vi.fn()

vi.mock('@/platform', () => ({
  default: {
    readWorkspaceFile: (...args: unknown[]) => readWorkspaceFile(...args),
    listWorkspaceChildren: (...args: unknown[]) => listWorkspaceChildren(...args),
  },
}))

import { formatInstructionContext, loadTrustedProjectInstructions } from './project-instructions'

describe('loadTrustedProjectInstructions', () => {
  beforeEach(() => {
    readWorkspaceFile.mockReset()
    listWorkspaceChildren.mockReset()
  })

  it('returns nothing until instructions trust is allowed', async () => {
    const none = await loadTrustedProjectInstructions({ capabilityId: 'cap', instructionsTrust: 'unset' })
    expect(none).toEqual([])
    expect(readWorkspaceFile).not.toHaveBeenCalled()
  })

  it('reads AGENTS.md and CLAUDE.md only after trust', async () => {
    readWorkspaceFile.mockImplementation(async (_cap: string, path: string) => {
      if (path === 'AGENTS.md') return { content: 'Be careful', encoding: 'utf-8', revision: 'r', truncated: false, relativePath: path, size: 10 }
      throw new Error('missing')
    })
    listWorkspaceChildren.mockRejectedValue(new Error('none'))
    const found = await loadTrustedProjectInstructions({ capabilityId: 'cap', instructionsTrust: 'allowed' })
    expect(found).toEqual([{ relativePath: 'AGENTS.md', content: 'Be careful' }])
    expect(formatInstructionContext(found)).toContain('AGENTS.md')
    expect(formatInstructionContext(found)).toContain('cannot enable skills')
  })
})
