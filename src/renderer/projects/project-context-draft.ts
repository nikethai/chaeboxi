import {
  WORKSPACE_CONTEXT_MAX_BYTES,
  WORKSPACE_CONTEXT_MAX_ENTRIES,
  type WorkspaceContextDraftEntry,
} from '@shared/types/workspace'

export type DraftDecision = { ok: true; entries: WorkspaceContextDraftEntry[] } | { ok: false; reason: 'count' | 'bytes' | 'hard-denied' | 'revision-mismatch' }

const HARD_DENY = /(^|\/)\.env(\.|$)|(^|\/)\.git(\/|$)|id_rsa|id_ed25519|\.pem$|\.key$/i

export function canAttachContext(
  current: WorkspaceContextDraftEntry[],
  next: WorkspaceContextDraftEntry
): DraftDecision {
  if (HARD_DENY.test(next.relativePath)) {
    return { ok: false, reason: 'hard-denied' }
  }
  if (current.length >= WORKSPACE_CONTEXT_MAX_ENTRIES) {
    return { ok: false, reason: 'count' }
  }
  const total = current.reduce((sum, e) => sum + e.byteLength, 0) + next.byteLength
  if (total > WORKSPACE_CONTEXT_MAX_BYTES) {
    return { ok: false, reason: 'bytes' }
  }
  return { ok: true, entries: [...current, next] }
}

export function preflightRevision(
  draft: WorkspaceContextDraftEntry,
  currentRevision: string
): DraftDecision {
  if (draft.revision !== currentRevision) {
    return { ok: false, reason: 'revision-mismatch' }
  }
  return { ok: true, entries: [draft] }
}

export function clearDraftOnUnbind(): WorkspaceContextDraftEntry[] {
  return []
}

export type CommitContextResult =
  | { ok: true; blocks: string[]; entries: WorkspaceContextDraftEntry[] }
  | { ok: false; reason: 'revision-mismatch' | 'hard-denied' | 'unavailable'; relativePath?: string }

/**
 * Send-path preflight: reread each draft entry and refuse stale or denied files.
 */
export async function commitProjectContextDraft(
  drafts: WorkspaceContextDraftEntry[],
  readFile: (relativePath: string) => Promise<{ revision: string; content: string; encoding: string }>
): Promise<CommitContextResult> {
  const blocks: string[] = []
  for (const draft of drafts) {
    const denied = canAttachContext([], draft)
    if (!denied.ok && denied.reason === 'hard-denied') {
      return { ok: false, reason: 'hard-denied', relativePath: draft.relativePath }
    }
    let current: { revision: string; content: string; encoding: string }
    try {
      current = await readFile(draft.relativePath)
    } catch {
      return { ok: false, reason: 'unavailable', relativePath: draft.relativePath }
    }
    const pre = preflightRevision(draft, current.revision)
    if (!pre.ok) {
      return { ok: false, reason: 'revision-mismatch', relativePath: draft.relativePath }
    }
    const body = draft.excerpt || current.content
    blocks.push(`### ${draft.relativePath}\n\n${body}`)
  }
  return { ok: true, blocks, entries: drafts }
}
