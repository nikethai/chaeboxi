import {
  buildPublishedSource,
  type ImportedSource,
  type InspectedJsonEntry,
  inspectImportedArchiveBytes,
} from '@shared/imported-history'
import { type ImportedHistoryStoreApi, persistPublishedSource } from './store'

export type InspectedArchivePayload = {
  ok?: boolean
  jsonEntries?: InspectedJsonEntry[]
  skipped?: string[]
  message?: string
}

export async function publishInspectedArchiveResult(
  inspected: InspectedArchivePayload,
  originalFilename: string,
  store?: ImportedHistoryStoreApi
): Promise<{ source: ImportedSource; outcome: 'inserted' | 'idempotent' }> {
  if (!inspected.ok) {
    throw new Error(inspected.message || 'inspect failed')
  }
  if (!inspected.jsonEntries?.length) {
    throw new Error('no importable conversations.json in archive')
  }
  const source = buildPublishedSource({
    originalFilename,
    jsonEntries: inspected.jsonEntries,
    extraSkipped: inspected.skipped,
  })
  return await persistPublishedSource(source, store)
}

export async function importChatGptArchiveFromPath(
  path: string,
  inspectPath: (archivePath: string) => Promise<InspectedArchivePayload>,
  store?: ImportedHistoryStoreApi
) {
  const inspected = await inspectPath(path)
  const originalFilename = path.replace(/\\/g, '/').split('/').pop() || 'archive.zip'
  return publishInspectedArchiveResult(inspected, originalFilename, store)
}

export type ImportedArchivePicker = {
  pickImportedArchivePath(): Promise<string | null>
  inspectImportedArchive(path: string): Promise<InspectedArchivePayload | unknown>
}

/** Call picker methods on the object so class `this` (desktop ipc) stays bound. */
export async function importChatGptArchiveUsingPicker(
  picker: ImportedArchivePicker,
  store?: ImportedHistoryStoreApi
) {
  const path = await picker.pickImportedArchivePath()
  if (!path) {
    return null
  }
  return importChatGptArchiveFromPath(
    path,
    async (archivePath) => (await picker.inspectImportedArchive(archivePath)) as InspectedArchivePayload,
    store
  )
}

export async function importChatGptArchiveBytes(
  bytes: Uint8Array,
  originalFilename: string,
  store?: ImportedHistoryStoreApi
): Promise<{ source: ImportedSource; outcome: 'inserted' | 'idempotent'; inspectFailed?: string }> {
  const inspected = await inspectImportedArchiveBytes(bytes)
  return publishInspectedArchiveResult(inspected, originalFilename, store)
}
