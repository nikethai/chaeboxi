import { describe, expect, it } from 'vitest'
import { persistedSensitiveToolErrorResult } from './abstract-ai-sdk'

const SENTINEL = 'SECRET_SENTINEL_BYTES_9f3a'

describe('persistedSensitiveToolErrorResult', () => {
  it('omits source/content from persisted tool error input', () => {
    const persisted = persistedSensitiveToolErrorResult(
      'create_file',
      { message: 'failed' },
      { path: 'a.txt', content: SENTINEL }
    )
    expect(JSON.stringify(persisted)).not.toContain(SENTINEL)
    expect((persisted.input as { redacted?: boolean }).redacted).toBe(true)
    expect((persisted.input as { path?: string }).path).toBe('a.txt')
  })

  it('leaves non-sensitive tool input intact', () => {
    const persisted = persistedSensitiveToolErrorResult('web_search', { message: 'failed' }, { q: 'hello' })
    expect(persisted.input).toEqual({ q: 'hello' })
  })
})
