import {
  CHATGPT_FORMAT_VERSION,
  CHATGPT_IMPORTER_ID,
  type ImportedConversation,
  type ImportedMessage,
  importedConversationId,
  type NormalizeReport,
} from './types'

type MappingNode = {
  id?: string
  parent?: string | null
  children?: string[]
  message?: {
    id?: string
    author?: { role?: string }
    create_time?: number
    content?: {
      content_type?: string
      parts?: unknown[]
    }
    metadata?: { attachments?: unknown[] }
  } | null
}

type ChatGptConversation = {
  id?: string
  title?: string
  create_time?: number
  update_time?: number
  current_node?: string
  mapping?: Record<string, MappingNode>
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function walkCurrentPath(mapping: Record<string, MappingNode>, currentNode: string | undefined): string[] {
  const ids: string[] = []
  let nodeId: string | undefined = currentNode
  const seen = new Set<string>()
  while (nodeId && mapping[nodeId] && !seen.has(nodeId)) {
    seen.add(nodeId)
    ids.push(nodeId)
    const parent = mapping[nodeId].parent
    nodeId = parent === null || parent === undefined ? undefined : String(parent)
  }
  return ids.reverse()
}

function partsToText(parts: unknown[] | undefined): { text: string; skippedAttachments: number } {
  if (!Array.isArray(parts) || parts.length === 0) {
    return { text: '', skippedAttachments: 0 }
  }
  const texts: string[] = []
  let skippedAttachments = 0
  for (const part of parts) {
    if (typeof part === 'string') {
      texts.push(part)
    } else {
      skippedAttachments += 1
    }
  }
  return { text: texts.join('\n'), skippedAttachments }
}

function normalizeOneConversation(raw: ChatGptConversation, skipReasons: string[]): ImportedConversation | null {
  const providerConversationId = raw.id ? String(raw.id) : ''
  if (!providerConversationId || !raw.mapping) {
    return null
  }
  const path = walkCurrentPath(raw.mapping, raw.current_node)
  const messages: ImportedMessage[] = []
  for (const nodeId of path) {
    const node = raw.mapping[nodeId]
    const message = node?.message
    if (!message) {
      continue
    }
    const role = message.author?.role || 'unknown'
    const contentType = message.content?.content_type
    const attachmentMeta = Array.isArray(message.metadata?.attachments) ? message.metadata.attachments.length : 0
    if (contentType && contentType !== 'text' && contentType !== 'multimodal_text') {
      skipReasons.push(`skipped_content_type:${contentType}:${message.id || nodeId}`)
    }
    const { text, skippedAttachments } = partsToText(message.content?.parts)
    const skipped = skippedAttachments + attachmentMeta
    if (skipped > 0) {
      skipReasons.push(`skipped_attachment:${message.id || nodeId}`)
    }
    if (!text.trim() && skipped === 0) {
      continue
    }
    messages.push({
      id: String(message.id || nodeId),
      role,
      text,
      createdAt: typeof message.create_time === 'number' ? message.create_time : undefined,
      skippedAttachmentCount: skipped,
    })
  }
  return {
    id: importedConversationId(providerConversationId),
    providerConversationId,
    title: raw.title?.trim() || 'Untitled',
    createdAt: raw.create_time,
    updatedAt: raw.update_time,
    messages,
  }
}

export function normalizeChatGptJson(jsonText: string, filename = 'conversations.json'): NormalizeReport {
  const skipReasons: string[] = []
  const failedReasons: string[] = []
  let importedCount = 0
  let skippedCount = 0
  let failedCount = 0
  const conversations: ImportedConversation[] = []

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    failedCount += 1
    failedReasons.push(`json_parse:${filename}`)
    return { conversations, importedCount, skippedCount, failedCount, skipReasons, failedReasons }
  }

  const rawConversations: ChatGptConversation[] = []
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      const rec = asRecord(item)
      rawConversations.push((rec || {}) as ChatGptConversation)
    }
  } else {
    const rec = asRecord(parsed)
    if (rec?.mapping) {
      rawConversations.push(rec as ChatGptConversation)
    } else if (Array.isArray(rec?.conversations)) {
      for (const item of rec.conversations) {
        rawConversations.push((asRecord(item) || {}) as ChatGptConversation)
      }
    } else {
      failedCount += 1
      failedReasons.push(`unrecognized_shape:${filename}`)
      return { conversations, importedCount, skippedCount, failedCount, skipReasons, failedReasons }
    }
  }

  for (const raw of rawConversations) {
    const beforeSkip = skipReasons.length
    const conv = normalizeOneConversation(raw, skipReasons)
    if (!conv) {
      failedCount += 1
      failedReasons.push(`conversation_invalid:${raw.id || filename}`)
      continue
    }
    importedCount += conv.messages.filter((m) => m.role === 'user' || m.role === 'assistant').length
    skippedCount += skipReasons.length - beforeSkip
    skippedCount += conv.messages.reduce((sum, m) => sum + (m.role === 'system' || m.role === 'tool' ? 1 : 0), 0)
    for (const message of conv.messages) {
      if (message.role === 'system' || message.role === 'tool') {
        skipReasons.push(`skipped_role:${message.role}:${message.id}`)
      }
    }
    conversations.push(conv)
  }

  return { conversations, importedCount, skippedCount, failedCount, skipReasons, failedReasons }
}

export function mergeNormalizeReports(reports: NormalizeReport[]): NormalizeReport {
  const merged: NormalizeReport = {
    conversations: [],
    importedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    skipReasons: [],
    failedReasons: [],
  }
  for (const report of reports) {
    merged.conversations.push(...report.conversations)
    merged.importedCount += report.importedCount
    merged.skippedCount += report.skippedCount
    merged.failedCount += report.failedCount
    merged.skipReasons.push(...report.skipReasons)
    merged.failedReasons.push(...report.failedReasons)
  }
  return merged
}

export { CHATGPT_FORMAT_VERSION, CHATGPT_IMPORTER_ID }
