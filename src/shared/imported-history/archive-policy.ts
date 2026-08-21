export const MAX_COMPRESSED_BYTES = 200 * 1024 * 1024
export const MAX_UNCOMPRESSED_ENTRY_BYTES = 32 * 1024 * 1024
export const MAX_ZIP_ENTRIES = 50_000
export const MAX_AMPLIFICATION = 20
export const NESTED_ARCHIVE_EXTENSIONS = ['.zip', '.tar', '.gz', '.tgz', '.7z', '.rar', '.bz2', '.xz']

export type ArchivePolicyError =
  | 'zip_slip'
  | 'oversize'
  | 'too_many_entries'
  | 'nested_archive'
  | 'unsafe_name'
  | 'not_zip'

const ALLOWED_JSON_NAMES = /^(conversations\.json|\d+\.json)$/i

export function isAllowlistedJsonName(name: string): boolean {
  const base = basename(name)
  return ALLOWED_JSON_NAMES.test(base)
}

export function basename(name: string): string {
  const normalized = name.replace(/\\/g, '/')
  const parts = normalized.split('/')
  return parts[parts.length - 1] || name
}

export function isZipSlipName(name: string): boolean {
  const replaced = name.replace(/\\/g, '/')
  if (replaced.startsWith('/') || /^[a-zA-Z]:/.test(name)) {
    return true
  }
  const parts = replaced.split('/')
  return parts.some((part) => part === '..')
}

export function isNestedArchiveName(name: string): boolean {
  const lower = basename(name).toLowerCase()
  return NESTED_ARCHIVE_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export function isUnsafeStoredName(name: string): boolean {
  if (!name || name.includes('\0')) {
    return true
  }
  return isZipSlipName(name)
}

export function classifyZipEntry(
  name: string,
  uncompressedSize: number,
  compressedSize: number
): ArchivePolicyError | 'json' | 'skip' {
  if (isUnsafeStoredName(name) || isZipSlipName(name)) {
    return 'zip_slip'
  }
  if (uncompressedSize > MAX_UNCOMPRESSED_ENTRY_BYTES) {
    return 'oversize'
  }
  if (compressedSize > 0 && uncompressedSize / compressedSize > MAX_AMPLIFICATION) {
    return 'oversize'
  }
  if (isNestedArchiveName(name)) {
    return 'nested_archive'
  }
  if (isAllowlistedJsonName(name)) {
    return 'json'
  }
  return 'skip'
}
