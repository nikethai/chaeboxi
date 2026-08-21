import { mergeNormalizeReports, normalizeChatGptJson } from './chatgpt-normalize'
import { CHATGPT_FORMAT_VERSION, CHATGPT_IMPORTER_ID, type ImportedHistorySnapshot, type ImportedSource } from './types'
import type { InspectedJsonEntry } from './zip-bytes'

export function checksumText(text: string): string {
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function buildPublishedSource(input: {
  originalFilename: string
  jsonEntries: InspectedJsonEntry[]
  extraSkipped?: string[]
}): ImportedSource {
  const reports = input.jsonEntries.map((entry) => normalizeChatGptJson(entry.text, entry.name))
  const merged = mergeNormalizeReports(reports)
  const checksum = checksumText(input.jsonEntries.map((e) => `${e.name}:${e.text}`).join('\n'))
  return {
    id: `imported-source:${checksum}`,
    importerId: CHATGPT_IMPORTER_ID,
    formatVersion: CHATGPT_FORMAT_VERSION,
    originalFilename: input.originalFilename.replace(/\\/g, '/').split('/').pop() || 'archive.zip',
    checksum,
    status: 'published',
    importedCount: merged.importedCount,
    skippedCount: merged.skippedCount + (input.extraSkipped?.length || 0),
    failedCount: merged.failedCount,
    conversations: merged.conversations,
    skipReasons: [...(input.extraSkipped || []), ...merged.skipReasons],
    failedReasons: merged.failedReasons,
    createdAt: Date.now(),
  }
}

export type PublishResult = {
  snapshot: ImportedHistorySnapshot
  source: ImportedSource
  outcome: 'inserted' | 'idempotent'
}

export function publishImportedSource(snapshot: ImportedHistorySnapshot, source: ImportedSource): PublishResult {
  const existing = snapshot.sources.find((item) => item.checksum === source.checksum && item.status === 'published')
  if (existing) {
    return { snapshot, source: existing, outcome: 'idempotent' }
  }
  const withoutSameId = snapshot.sources.filter((item) => item.id !== source.id)
  return {
    snapshot: { sources: [...withoutSameId, { ...source, status: 'published' }] },
    source: { ...source, status: 'published' },
    outcome: 'inserted',
  }
}

export function deleteImportedSource(snapshot: ImportedHistorySnapshot, sourceId: string): ImportedHistorySnapshot {
  return { sources: snapshot.sources.filter((item) => item.id !== sourceId) }
}

export function getImportedConversation(snapshot: ImportedHistorySnapshot, sourceId: string, conversationId: string) {
  const source = snapshot.sources.find((item) => item.id === sourceId && item.status === 'published')
  if (!source) {
    return null
  }
  const conversation = source.conversations.find((item) => item.id === conversationId)
  if (!conversation) {
    return null
  }
  return { source, conversation }
}
