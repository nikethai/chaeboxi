import type { ImportedConversation, ImportedHistorySnapshot, ImportedMessage, ImportedSource } from './types'

export type ImportedSearchHit = {
  sourceId: string
  sourceFilename: string
  conversationId: string
  conversationTitle: string
  message: ImportedMessage
}

function escapeSearch(input: string): string {
  return input.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')
}

export function searchImportedSnapshot(snapshot: ImportedHistorySnapshot, query: string): ImportedSearchHit[] {
  const trimmed = query.trim()
  if (!trimmed) {
    return []
  }
  const regexp = new RegExp(escapeSearch(trimmed), 'i')
  const hits: ImportedSearchHit[] = []
  for (const source of snapshot.sources) {
    if (source.status !== 'published') {
      continue
    }
    for (const conversation of source.conversations) {
      for (let i = conversation.messages.length - 1; i >= 0; i--) {
        const message = conversation.messages[i]
        if (regexp.test(message.text)) {
          hits.push({
            sourceId: source.id,
            sourceFilename: source.originalFilename,
            conversationId: conversation.id,
            conversationTitle: conversation.title,
            message,
          })
        }
      }
    }
  }
  return hits
}

export function conversationContainsQuery(conversation: ImportedConversation, query: string): boolean {
  const regexp = new RegExp(escapeSearch(query.trim()), 'i')
  return conversation.messages.some((message) => regexp.test(message.text))
}

export function listPublishedSources(snapshot: ImportedHistorySnapshot): ImportedSource[] {
  return snapshot.sources.filter((source) => source.status === 'published')
}
