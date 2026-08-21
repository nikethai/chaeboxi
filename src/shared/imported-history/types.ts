export const CHATGPT_IMPORTER_ID = 'chatgpt-conversations'
export const CHATGPT_FORMAT_VERSION = 'mapping-v1'
export const IMPORTED_ID_PREFIX = 'imported:'

export type ImportedSourceStatus = 'staging' | 'published' | 'deleting'

export type ImportedMessage = {
  id: string
  role: string
  text: string
  createdAt?: number
  skippedAttachmentCount: number
}

export type ImportedConversation = {
  id: string
  providerConversationId: string
  title: string
  createdAt?: number
  updatedAt?: number
  messages: ImportedMessage[]
}

export type ImportedSource = {
  id: string
  importerId: typeof CHATGPT_IMPORTER_ID
  formatVersion: string
  originalFilename: string
  checksum: string
  status: ImportedSourceStatus
  importedCount: number
  skippedCount: number
  failedCount: number
  conversations: ImportedConversation[]
  skipReasons: string[]
  failedReasons: string[]
  createdAt: number
}

export type NormalizeReport = {
  conversations: ImportedConversation[]
  importedCount: number
  skippedCount: number
  failedCount: number
  skipReasons: string[]
  failedReasons: string[]
}

export type ContinuationPendingExcerpt = {
  conversationTitle: string
  messageId: string
  role: string
  text: string
}

export type ContinuationLineage = {
  importedSourceId: string
  importedConversationId: string
  selectedMessageIds: string[]
  targetProvider?: string
  targetModelId?: string
  createdAt: number
  omittedCount: number
  omittedReasons: string[]
  sourceMissing?: boolean
  firstHandoffPending?: boolean
  pendingExcerpts?: ContinuationPendingExcerpt[]
}

export type ImportedHistorySnapshot = {
  sources: ImportedSource[]
}

export function isImportedRecordId(id: string): boolean {
  return id.startsWith(IMPORTED_ID_PREFIX)
}

export function importedConversationId(providerConversationId: string): string {
  return `${IMPORTED_ID_PREFIX}chatgpt:${providerConversationId}`
}
