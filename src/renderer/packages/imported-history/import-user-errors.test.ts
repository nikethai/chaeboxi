import { describe, expect, it } from 'vitest'
import { describeImportedArchiveError, IMPORTED_ARCHIVE_USER_ERRORS } from './import-user-errors'

describe('describeImportedArchiveError', () => {
  it('maps not_zip and not-a-zip messages', () => {
    expect(describeImportedArchiveError(new Error('not_zip'))).toBe(IMPORTED_ARCHIVE_USER_ERRORS.notZip)
    expect(describeImportedArchiveError('not a zip archive')).toBe(IMPORTED_ARCHIVE_USER_ERRORS.notZip)
  })

  it('maps missing conversations.json', () => {
    expect(describeImportedArchiveError(new Error('no importable conversations.json in archive'))).toBe(
      IMPORTED_ARCHIVE_USER_ERRORS.noConversations
    )
  })

  it('maps oversize and too many entries, including inspect messages', () => {
    expect(describeImportedArchiveError(new Error('oversize:conversations.json'))).toBe(
      IMPORTED_ARCHIVE_USER_ERRORS.oversize
    )
    expect(describeImportedArchiveError(new Error('too_many_entries'))).toBe(IMPORTED_ARCHIVE_USER_ERRORS.oversize)
    expect(describeImportedArchiveError(new Error('compressed archive exceeds limit'))).toBe(
      IMPORTED_ARCHIVE_USER_ERRORS.oversize
    )
    expect(describeImportedArchiveError(new Error('too many zip entries'))).toBe(IMPORTED_ARCHIVE_USER_ERRORS.oversize)
  })

  it('maps zip-slip and nested archives as unsafe', () => {
    expect(describeImportedArchiveError(new Error('zip_slip:../x.json'))).toBe(IMPORTED_ARCHIVE_USER_ERRORS.unsafe)
    expect(describeImportedArchiveError(new Error('nested_archive:inner.zip'))).toBe(
      IMPORTED_ARCHIVE_USER_ERRORS.unsafe
    )
  })

  it('hides unknown inspect messages', () => {
    expect(describeImportedArchiveError(new Error('inspect failed'))).toBe(IMPORTED_ARCHIVE_USER_ERRORS.failed)
    expect(describeImportedArchiveError(new Error('missing zip central directory'))).toBe(
      IMPORTED_ARCHIVE_USER_ERRORS.failed
    )
    expect(describeImportedArchiveError('')).toBe(IMPORTED_ARCHIVE_USER_ERRORS.failed)
  })
})
