import { describe, expect, it } from 'vitest'
import {
  fingerprintSensitiveToolArgs,
  isSensitiveToolName,
  redactSensitiveToolPayload,
} from './sensitive-tools'

const SENTINEL = 'SECRET_SENTINEL_BYTES_9f3a'

describe('sensitive tool payload redaction', () => {
  it('classifies workspace mutation and local run tools', () => {
    expect(isSensitiveToolName('create_file')).toBe(true)
    expect(isSensitiveToolName('edit_file')).toBe(true)
    expect(isSensitiveToolName('delete_file')).toBe(true)
    expect(isSensitiveToolName('run_local_code')).toBe(true)
    expect(isSensitiveToolName('apply_workspace_changes')).toBe(true)
    expect(isSensitiveToolName('web_search')).toBe(false)
  })

  it('strips source/stdin/diff/content from persisted payloads', () => {
    const redacted = redactSensitiveToolPayload('edit_file', {
      path: 'a.txt',
      old_string: SENTINEL,
      new_string: SENTINEL,
      expected_revision: 'abc',
    }) as Record<string, unknown>
    expect(JSON.stringify(redacted)).not.toContain(SENTINEL)
    expect(redacted.redacted).toBe(true)
    expect(redacted.path).toBe('a.txt')
    expect(redacted.contentBytes).toBe(SENTINEL.length)
  })

  it('fingerprints without embedding sentinel text', () => {
    const fp = fingerprintSensitiveToolArgs('create_file', { path: 'a.txt', content: SENTINEL })
    expect(fp).not.toContain(SENTINEL)
    expect(fp).not.toContain('a.txt')
    const fp2 = fingerprintSensitiveToolArgs('create_file', { path: 'a.txt', content: `${SENTINEL}x` })
    expect(fp).not.toBe(fp2)
  })
})
