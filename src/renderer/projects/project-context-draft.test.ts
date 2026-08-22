import { describe, expect, it } from 'vitest'
import { WORKSPACE_CONTEXT_MAX_BYTES, WORKSPACE_CONTEXT_MAX_ENTRIES } from '@shared/types/workspace'
import { canAttachContext, clearDraftOnUnbind, preflightRevision } from './project-context-draft'

const entry = (path: string, bytes = 10): Parameters<typeof canAttachContext>[1] => ({
  projectId: 'p',
  rootGeneration: 'g',
  relativePath: path,
  revision: 'r1',
  excerpt: 'x'.repeat(bytes),
  byteLength: bytes,
})

describe('one-send project context draft', () => {
  it('never attaches hard-denied secrets', () => {
    expect(canAttachContext([], entry('.env')).ok).toBe(false)
    const denied = canAttachContext([], entry('secrets/id_rsa'))
    expect(denied.ok ? '' : denied.reason).toBe('hard-denied')
  })

  it('blocks a 21st entry and oversize aggregate', () => {
    const full = Array.from({ length: WORKSPACE_CONTEXT_MAX_ENTRIES }, (_, i) => entry(`f${i}.txt`))
    const count = canAttachContext(full, entry('more.txt'))
    expect(count.ok ? '' : count.reason).toBe('count')
    const bytes = canAttachContext([], entry('big.txt', WORKSPACE_CONTEXT_MAX_BYTES + 1))
    expect(bytes.ok ? '' : bytes.reason).toBe('bytes')
  })

  it('blocks silent send on revision mismatch and clears on unbind', () => {
    const mismatch = preflightRevision(entry('a.txt'), 'r2')
    expect(mismatch.ok ? '' : mismatch.reason).toBe('revision-mismatch')
    expect(preflightRevision(entry('a.txt'), 'r1').ok).toBe(true)
    expect(clearDraftOnUnbind()).toEqual([])
  })
})

describe('commitProjectContextDraft send path', () => {
  it('blocks stale revision before send', async () => {
    const { commitProjectContextDraft } = await import('./project-context-draft')
    const result = await commitProjectContextDraft([entry('a.txt')], async () => ({
      revision: 'r2',
      content: 'new',
      encoding: 'utf-8',
    }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('revision-mismatch')
  })

  it('returns copied excerpts when revisions match', async () => {
    const { commitProjectContextDraft } = await import('./project-context-draft')
    const draft = entry('src/app.ts')
    const result = await commitProjectContextDraft([draft], async () => ({
      revision: 'r1',
      content: draft.excerpt,
      encoding: 'utf-8',
    }))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.blocks[0]).toContain('src/app.ts')
  })
})
