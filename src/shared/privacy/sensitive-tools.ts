/** Tools whose inputs/results must never persist as raw source, stdin, diffs, or file content. */

export const SENSITIVE_TOOL_NAMES = new Set([
  'create_file',
  'edit_file',
  'delete_file',
  'apply_workspace_changes',
  'run_local_code',
  'prepare_local_execution',
])

export function isSensitiveToolName(toolName: string | undefined | null): boolean {
  if (!toolName) return false
  return SENSITIVE_TOOL_NAMES.has(toolName)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

function byteLengthOf(value: unknown): number | undefined {
  if (typeof value === 'string') return value.length
  return undefined
}

/** Metadata-only view. Never includes source, stdin, diffs, or file bodies. */
export function redactSensitiveToolPayload(toolName: string, payload: unknown): unknown {
  if (!isSensitiveToolName(toolName)) {
    return payload
  }
  const rec = asRecord(payload)
  if (!rec) {
    return { redacted: true }
  }
  const path = typeof rec.path === 'string' ? rec.path : typeof rec.relativePath === 'string' ? rec.relativePath : undefined
  return {
    redacted: true,
    path,
    mode: typeof rec.mode === 'string' ? rec.mode : undefined,
    kind: typeof rec.kind === 'string' ? rec.kind : undefined,
    expectedRevision: typeof rec.expected_revision === 'string' ? rec.expected_revision : rec.expectedRevision,
    contentBytes: byteLengthOf(rec.content) ?? byteLengthOf(rec.new_string) ?? byteLengthOf(rec.newString) ?? byteLengthOf(rec.source) ?? byteLengthOf(rec.stdin),
  }
}

export function fingerprintSensitiveToolArgs(toolName: string, args: unknown): string {
  const rec = asRecord(args) || {}
  const path = typeof rec.path === 'string' ? rec.path : typeof rec.relativePath === 'string' ? rec.relativePath : ''
  const mode = typeof rec.mode === 'string' ? rec.mode : ''
  const expected =
    typeof rec.expected_revision === 'string'
      ? rec.expected_revision
      : typeof rec.expectedRevision === 'string'
        ? rec.expectedRevision
        : ''
  const content = typeof rec.content === 'string' ? rec.content : ''
  const oldString = typeof rec.old_string === 'string' ? rec.old_string : typeof rec.oldString === 'string' ? rec.oldString : ''
  const newString = typeof rec.new_string === 'string' ? rec.new_string : typeof rec.newString === 'string' ? rec.newString : ''
  const source = typeof rec.source === 'string' ? rec.source : ''
  const stdin = typeof rec.stdin === 'string' ? rec.stdin : ''
  const raw = `${toolName}|${path}|${mode}|${expected}|${fnv1a(content)}|${fnv1a(oldString)}|${fnv1a(newString)}|${fnv1a(source)}|${fnv1a(stdin)}`
  return fnv1a(raw)
}

function fnv1a(input: string): string {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16)
}
