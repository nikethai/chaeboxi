import { describe, expect, it } from 'vitest'
import {
  extractCommandNamesFromText,
  getActiveCommandSlashQuery,
  stripCommandSlashTokens,
} from './slash-tokens'

describe('slash tokens', () => {
  it('extracts /command names at boundaries', () => {
    expect(extractCommandNamesFromText('please /review and /fix-issue')).toEqual(['review', 'fix-issue'])
  })

  it('does not treat https URLs as commands', () => {
    expect(extractCommandNamesFromText('see https://example.com/path')).toEqual([])
  })

  it('getActiveCommandSlashQuery only for single-line slash drafts', () => {
    expect(getActiveCommandSlashQuery('/')).toBe('')
    expect(getActiveCommandSlashQuery('/rev')).toBe('rev')
    expect(getActiveCommandSlashQuery('hello /rev')).toBe(null)
    expect(getActiveCommandSlashQuery('/rev\nmore')).toBe(null)
  })

  it('strips slash tokens', () => {
    expect(stripCommandSlashTokens('/review the PR')).toMatch(/the PR/i)
  })
})
