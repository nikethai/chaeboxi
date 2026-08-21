import {
  deleteImportedSource,
  getImportedConversation,
  type ImportedHistorySnapshot,
  type ImportedSource,
  publishImportedSource,
} from '@shared/imported-history'
import storage, { StorageKey } from '@/storage'

export const IMPORTED_HISTORY_STORAGE_KEY = StorageKey.ImportedHistory

export type ImportedHistoryStoreApi = {
  getItem: <T>(key: string, defaultValue: T) => Promise<T>
  setItemNow: (key: string, value: unknown) => Promise<void>
}

const defaultStore: ImportedHistoryStoreApi = {
  getItem: (key, defaultValue) => storage.getItem(key, defaultValue),
  setItemNow: (key, value) => storage.setItemNow(key, value),
}

export async function loadImportedHistory(
  store: ImportedHistoryStoreApi = defaultStore
): Promise<ImportedHistorySnapshot> {
  const snapshot = await store.getItem<ImportedHistorySnapshot>(IMPORTED_HISTORY_STORAGE_KEY, { sources: [] })
  if (!snapshot || !Array.isArray(snapshot.sources)) {
    return { sources: [] }
  }
  return snapshot
}

export async function saveImportedHistory(
  snapshot: ImportedHistorySnapshot,
  store: ImportedHistoryStoreApi = defaultStore
): Promise<void> {
  await store.setItemNow(IMPORTED_HISTORY_STORAGE_KEY, snapshot)
}

export async function persistPublishedSource(source: ImportedSource, store: ImportedHistoryStoreApi = defaultStore) {
  const snapshot = await loadImportedHistory(store)
  const result = publishImportedSource(snapshot, source)
  await saveImportedHistory(result.snapshot, store)
  return result
}

export async function persistDeleteImportedSource(sourceId: string, store: ImportedHistoryStoreApi = defaultStore) {
  const snapshot = await loadImportedHistory(store)
  const next = deleteImportedSource(snapshot, sourceId)
  await saveImportedHistory(next, store)
  return next
}

export async function loadImportedConversation(
  sourceId: string,
  conversationId: string,
  store: ImportedHistoryStoreApi = defaultStore
) {
  const snapshot = await loadImportedHistory(store)
  return getImportedConversation(snapshot, sourceId, conversationId)
}
