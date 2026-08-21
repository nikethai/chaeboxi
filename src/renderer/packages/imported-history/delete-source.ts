import type { ContinuationLineage } from '@shared/imported-history'
import type { Session } from '@shared/types'
import { type ImportedHistoryStoreApi, persistDeleteImportedSource } from './store'

export function applySourceMissingToLineage(
  lineage: ContinuationLineage | undefined,
  sourceId: string
): ContinuationLineage | undefined {
  if (!lineage || lineage.importedSourceId !== sourceId) {
    return lineage
  }
  return { ...lineage, sourceMissing: true, firstHandoffPending: false, pendingExcerpts: undefined }
}

export function applySourceMissingToSession(session: Session, sourceId: string): Session {
  const next = applySourceMissingToLineage(session.continuationLineage, sourceId)
  if (next === session.continuationLineage) {
    return session
  }
  return { ...session, continuationLineage: next }
}

export async function deleteImportedSourceAndReconcile(
  sourceId: string,
  options?: {
    store?: ImportedHistoryStoreApi
    listNativeSessions?: () => Promise<Session[]>
    persistNativeSession?: (session: Session) => Promise<void>
  }
) {
  const snapshot = await persistDeleteImportedSource(sourceId, options?.store)
  const natives = (await options?.listNativeSessions?.()) || []
  for (const session of natives) {
    const updated = applySourceMissingToSession(session, sourceId)
    if (updated !== session) {
      await options?.persistNativeSession?.(updated)
    }
  }
  return snapshot
}
