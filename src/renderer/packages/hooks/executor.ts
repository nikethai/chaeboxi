import type { HookDefinition, HookEvent, HookRunRecord } from '@shared/types'
import { getOS } from '@/packages/navigator'
import { ofetch } from 'ofetch'
import { runShellHook, toRunRecord, type ShellHookInput } from './shell-runner'

const DECL_TIMEOUT_MS = 5000
const MAX_INJECT = 8000

export type RunHooksOptions = {
  event: HookEvent
  hooks: HookDefinition[]
  shellEnabled: boolean
  toolName?: string
  toolInput?: unknown
  sessionId?: string
  workspaceRoot?: string | null
  /** Assistant output for PostTurn */
  output?: string
  onRun?: (record: HookRunRecord) => void
}

export type RunHooksResult = {
  injectText: string
  blocked: boolean
  blockReason?: string
  records: HookRunRecord[]
}

function matcherHits(matcher: string | undefined, toolName: string | undefined): boolean {
  if (!matcher) return true
  if (!toolName) return false
  try {
    return new RegExp(matcher, 'i').test(toolName)
  } catch {
    return matcher.toLowerCase() === toolName.toLowerCase()
  }
}

/**
 * Run enabled hooks for an event. Global always-on (caller filters enabled).
 * Returns inject text for PreTurn/SessionStart and block flag for PreToolUse.
 */
export async function runHooks(options: RunHooksOptions): Promise<RunHooksResult> {
  const applicable = options.hooks.filter((h) => {
    if (!h.enabled) return false
    if (h.event !== options.event) return false
    if (options.event === 'PreToolUse' || options.event === 'PostToolUse') {
      return matcherHits(h.matcher, options.toolName)
    }
    return true
  })

  const injectParts: string[] = []
  const records: HookRunRecord[] = []
  let blocked = false
  let blockReason: string | undefined

  for (const hook of applicable) {
    if (hook.kind === 'command') {
      if (!options.shellEnabled) {
        continue
      }
      const input: ShellHookInput = {
        event: options.event,
        toolName: options.toolName,
        toolInput: options.toolInput,
        sessionId: options.sessionId,
        workspaceRoot: options.workspaceRoot,
        output: options.output,
      }
      const result = await runShellHook(hook, input)
      const record = toRunRecord(hook, result, options.event)
      records.push(record)
      options.onRun?.(record)
      if (result.blocked) {
        blocked = true
        blockReason = result.stderr || result.stdout || 'Blocked by hook'
        break
      }
      if (result.injectText && (options.event === 'PreTurn' || options.event === 'SessionStart')) {
        injectParts.push(result.injectText.slice(0, MAX_INJECT))
      }
      continue
    }

    // declarative
    if (hook.payload) {
      const text = await runDeclarative(hook)
      if (text) injectParts.push(text.slice(0, MAX_INJECT))
      const record: HookRunRecord = {
        id: `${Date.now()}-${hook.id}`,
        hookId: hook.id,
        event: options.event,
        at: Date.now(),
        exitCode: 0,
        outputPreview: text?.slice(0, 200),
      }
      records.push(record)
      options.onRun?.(record)
    }
  }

  return {
    injectText: injectParts.filter(Boolean).join('\n\n'),
    blocked,
    blockReason,
    records,
  }
}

async function runDeclarative(hook: HookDefinition): Promise<string | undefined> {
  const p = hook.payload
  if (!p) return undefined
  switch (p.type) {
    case 'inject-context':
    case 'inject-stdout':
      return p.content
    case 'inject-datetime':
      return `Current datetime: ${new Date().toISOString()}`
    case 'inject-system-info':
      return `System info: OS=${getOS()}`
    case 'web-fetch':
      return await withTimeout(async () => {
        if (p.extractAs === 'json') {
          const data = await ofetch(p.url, { responseType: 'json' })
          return `[Fetched JSON from ${p.url}]\n${JSON.stringify(data, null, 2)}`
        }
        const content = await ofetch(`https://r.jina.ai/${p.url}`, {
          headers: { Accept: 'text/markdown' },
          responseType: 'text',
        })
        return `[Fetched from ${p.url}]\n${content}`
      })
    case 'validate-format':
      return undefined
    default:
      return undefined
  }
}

async function withTimeout<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await Promise.race([
      fn(),
      new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), DECL_TIMEOUT_MS)),
    ])
  } catch {
    return undefined
  }
}

/** Builtin safety: block reading common secret paths via PreToolUse */
export function getBuiltinHooks(): HookDefinition[] {
  return [
    {
      id: 'builtin:secrets-reminder',
      name: 'Secrets safety reminder',
      description: 'Injects a short security reminder each turn',
      event: 'PreTurn',
      enabled: false, // off by default — users opt in
      origin: 'builtin',
      kind: 'declarative',
      payload: {
        type: 'inject-context',
        content:
          'Security: Do not read or print secrets from .env, credentials, or private key files unless the user explicitly requests it.',
      },
    },
  ]
}
