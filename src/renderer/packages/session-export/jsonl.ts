import { z } from 'zod'
import {
  CompactionPointSchema,
  type CompactionPoint,
  type Message,
  MessageSchema,
  type Session,
  SessionSchema,
} from '@shared/types/session'

// Individual line schemas
const SessionMetaLineSchema = z.object({
  type: z.literal('session_meta'),
  data: SessionSchema.omit({ messages: true }).passthrough(),
})

const MessageLineSchema = z.object({
  type: z.literal('message'),
  data: MessageSchema,
})

const CompactionPointLineSchema = z.object({
  type: z.literal('compaction_point'),
  data: CompactionPointSchema,
})

const JsonlLineSchema = z.discriminatedUnion('type', [
  SessionMetaLineSchema,
  MessageLineSchema,
  CompactionPointLineSchema,
])

/**
 * Strip transient runtime fields from a message before export.
 * These fields (cancel, generating, status) are ephemeral UI state
 * that should not be persisted in an export.
 */
function cleanMessageForExport(message: Message): Omit<Message, 'cancel' | 'generating' | 'status'> {
  const { cancel: _cancel, generating: _generating, status: _status, ...rest } = message
  return rest
}

/**
 * Serialize a session and its messages into JSONL format.
 * Line 1: session metadata (everything except messages array)
 * Following lines: compaction points, then messages in order
 */
export function exportSessionToJSONL(session: Session, messages: Message[]): string {
  const lines: string[] = []

  // Session metadata (strip messages to avoid duplication)
  const { messages: _msgs, ...sessionMeta } = session
  lines.push(JSON.stringify({ type: 'session_meta', data: sessionMeta }))

  // Compaction points
  if (session.compactionPoints?.length) {
    for (const cp of session.compactionPoints) {
      lines.push(JSON.stringify({ type: 'compaction_point', data: cp }))
    }
  }

  // Thread compaction points
  if (session.threads?.length) {
    for (const thread of session.threads) {
      if (thread.compactionPoints?.length) {
        for (const cp of thread.compactionPoints) {
          lines.push(JSON.stringify({ type: 'compaction_point', data: cp }))
        }
      }
    }
  }

  // Messages
  for (const msg of messages) {
    lines.push(JSON.stringify({ type: 'message', data: cleanMessageForExport(msg) }))
  }

  return lines.join('\n')
}

export interface ImportResult {
  session: Partial<Session>
  messages: Message[]
  compactionPoints: CompactionPoint[]
  errors: string[]
}

/**
 * Deserialize a JSONL string into session data with Zod validation.
 * Each line is parsed and validated independently. Invalid lines are
 * collected as errors but do not prevent other lines from being imported.
 */
export function importSessionFromJSONL(jsonlContent: string): ImportResult {
  const lines = jsonlContent.split('\n').filter((line) => line.trim().length > 0)
  const result: ImportResult = {
    session: {},
    messages: [],
    compactionPoints: [],
    errors: [],
  }

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1
    let parsed: unknown
    try {
      parsed = JSON.parse(lines[i])
    } catch {
      result.errors.push(`Line ${lineNum}: invalid JSON`)
      continue
    }

    const validated = JsonlLineSchema.safeParse(parsed)
    if (!validated.success) {
      result.errors.push(`Line ${lineNum}: ${validated.error.issues.map((e) => e.message).join(', ')}`)
      continue
    }

    const line = validated.data
    switch (line.type) {
      case 'session_meta':
        result.session = { ...result.session, ...line.data }
        break
      case 'message':
        result.messages.push(line.data)
        break
      case 'compaction_point':
        result.compactionPoints.push(line.data)
        break
    }
  }

  if (!result.session.id && !result.session.name && result.messages.length === 0) {
    result.errors.push('No valid session data found in JSONL content')
  }

  return result
}

export const parseSessionFromJSONL = importSessionFromJSONL
