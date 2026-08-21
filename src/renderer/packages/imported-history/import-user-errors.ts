export type ImportedArchiveErrorKind = 'notZip' | 'noConversations' | 'oversize' | 'unsafe' | 'failed'

export const IMPORTED_ARCHIVE_USER_ERRORS: Record<ImportedArchiveErrorKind, string> = {
  notZip: "This is not a ZIP. Use the file from OpenAI's email; do not unzip.",
  noConversations:
    'This ZIP is not a ChatGPT data export. Use Settings → Data controls → Export, not a single-chat share.',
  oversize: 'Archive is too large for this importer.',
  unsafe: 'This archive is not a safe ChatGPT export.',
  failed: 'Import failed',
}

function errorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return String(error ?? '')
}

export function classifyImportedArchiveError(error: unknown): ImportedArchiveErrorKind {
  const lower = errorText(error).toLowerCase()
  if (lower.includes('not_zip') || lower.includes('not a zip')) {
    return 'notZip'
  }
  if (lower.includes('no importable conversations.json') || lower.includes('conversations.json in archive')) {
    return 'noConversations'
  }
  if (
    lower.includes('oversize') ||
    lower.includes('too_many_entries') ||
    lower.includes('compressed archive exceeds limit') ||
    lower.includes('too many zip entries')
  ) {
    return 'oversize'
  }
  if (lower.includes('zip_slip') || lower.includes('nested_archive') || lower.includes('unsafe_name')) {
    return 'unsafe'
  }
  return 'failed'
}

export function describeImportedArchiveError(error: unknown): string {
  return IMPORTED_ARCHIVE_USER_ERRORS[classifyImportedArchiveError(error)]
}
