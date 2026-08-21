import { describe, expect, it } from 'vitest'
import { classifyZipEntry, isZipSlipName, MAX_UNCOMPRESSED_ENTRY_BYTES } from './archive-policy'

describe('archive entry policy', () => {
  it('flags zip-slip and absolute paths', () => {
    expect(isZipSlipName('../secrets.json')).toBe(true)
    expect(isZipSlipName('/etc/passwd')).toBe(true)
    expect(isZipSlipName('conversations.json')).toBe(false)
  })

  it('rejects oversize uncompressed entries', () => {
    expect(classifyZipEntry('conversations.json', MAX_UNCOMPRESSED_ENTRY_BYTES + 1, 10)).toBe('oversize')
  })
})
