import type { HookDefinition, HookEvent, HookRunRecord } from '@shared/types'
import platform from '@/platform'

const DEFAULT_TIMEOUT_MS = 10_000
const MAX_TIMEOUT_MS = 30_000
const MAX_STDOUT_CHARS = 8_000

export type ShellHookInput = {
  event: HookEvent
  toolName?: string
  toolInput?: unknown
  sessionId?: string
  workspaceRoot?: string | null
  output?: string
}

export type ShellHookResult = {
  exitCode: number
  stdout: string
  stderr: string
  blocked: boolean
  injectText?: string
}

function isDesktop(): boolean {
  return platform.type === 'desktop' && typeof window !== 'undefined' && typeof window.desktopAPI?.invoke === 'function'
}

/**
 * Run a shell hook via Tauri. Master switch must be checked by caller.
 * Exit code 2 on PreToolUse = block.
 */
export async function runShellHook(
  hook: HookDefinition,
  input: ShellHookInput
): Promise<ShellHookResult> {
  if (!hook.command || !isDesktop()) {
    return { exitCode: 0, stdout: '', stderr: 'shell unavailable', blocked: false }
  }

  const timeoutMs = Math.min(hook.timeoutMs || DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS)
  const payload = {
    event: input.event,
    toolName: input.toolName,
    toolInput: input.toolInput,
    sessionId: input.sessionId,
    workspaceRoot: input.workspaceRoot || null,
  }

  void timeoutMs
  void payload
  return {
    exitCode: 1,
    stdout: '',
    stderr: 'Project shell hooks are disabled. Generic renderer shell is unavailable.',
    blocked: false,
  }
}

export function toRunRecord(
  hook: HookDefinition,
  result: ShellHookResult,
  event: HookEvent
): HookRunRecord {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    hookId: hook.id,
    event,
    at: Date.now(),
    exitCode: result.exitCode,
    blocked: result.blocked,
    outputPreview: (result.stdout || result.stderr || '').slice(0, 200),
    error: result.exitCode !== 0 && !result.blocked ? result.stderr : undefined,
  }
}
