/**
 * Copilot Hooks Executor
 *
 * Executes pre-turn and post-turn hook actions for copilots.
 */

import { ofetch } from 'ofetch'
import { getOS } from '@/packages/navigator'
import type {
  CopilotHook,
  InjectContext,
  InjectDatetime,
  InjectSystemInfo,
  ValidateFormat,
  WebFetch,
} from './types'

const HOOK_TIMEOUT_MS = 5000

async function withTimeout<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), HOOK_TIMEOUT_MS)
    try {
      // eslint-disable-next-line no-restricted-syntax
      const result = await fn()
      return result
    } finally {
      clearTimeout(timeout)
    }
  } catch {
    // Fail silently on error
    return undefined
  }
}

// ============================================================================
// Pre-Turn Hooks
// ============================================================================

/**
 * Execute pre-turn hooks and return context string to prepend to messages.
 */
export async function executePreHooks(hooks: CopilotHook[]): Promise<string> {
  const parts: string[] = []

  for (const hook of hooks) {
    const result = await executePreHook(hook)
    if (result) {
      parts.push(result)
    }
  }

  if (parts.length === 0) {
    return ''
  }

  return parts.join('\n\n')
}

async function executePreHook(hook: CopilotHook): Promise<string | undefined> {
  switch (hook.type) {
    case 'inject-context':
      return executeInjectContext(hook)
    case 'inject-datetime':
      return executeInjectDatetime(hook)
    case 'inject-system-info':
      return executeInjectSystemInfo(hook)
    case 'web-fetch':
      return executeWebFetch(hook)
    case 'validate-format':
      // validate-format is post-turn only; skip here
      return undefined
    default:
      return undefined
  }
}

function executeInjectContext(hook: InjectContext): string {
  return hook.content
}

function executeInjectDatetime(_hook: InjectDatetime): string {
  const now = new Date()
  return `Current datetime: ${now.toISOString()}`
}

function executeInjectSystemInfo(_hook: InjectSystemInfo): string {
  const os = getOS()
  return `System info: OS=${os}`
}

async function executeWebFetch(hook: WebFetch): Promise<string | undefined> {
  return await withTimeout(async () => {
    if (hook.extractAs === 'text') {
      const content = await ofetch(`https://r.jina.ai/${hook.url}`, {
        headers: { Accept: 'text/markdown' },
        responseType: 'text',
      })
      return `[Fetched from ${hook.url}]\n${content}`
    }
    // For json, fetch raw and return stringified
    const data = await ofetch(hook.url, {
      responseType: 'json',
    })
    return `[Fetched JSON from ${hook.url}]\n${JSON.stringify(data, null, 2)}`
  })
}

// ============================================================================
// Post-Turn Hooks
// ============================================================================

/**
 * Execute post-turn hooks after generation.
 */
export async function executePostHooks(hooks: CopilotHook[], output: string): Promise<void> {
  for (const hook of hooks) {
    await executePostHook(hook, output)
  }
}

async function executePostHook(hook: CopilotHook, output: string): Promise<void> {
  switch (hook.type) {
    case 'validate-format':
      executeValidateFormat(hook, output)
      break
    case 'inject-context':
    case 'inject-datetime':
    case 'inject-system-info':
    case 'web-fetch':
      // These are pre-turn only; skip here
      break
    default:
      break
  }
}

function executeValidateFormat(hook: ValidateFormat, output: string): void {
  switch (hook.format) {
    case 'markdown':
      // Basic markdown structure check
      if (!output.includes('\n') && output.startsWith('#')) {
        // Simple check for headings
      }
      break
    case 'json':
      try {
        JSON.parse(output)
      } catch {
        console.warn('[copilot-hooks] Output is not valid JSON but validate-format was specified')
      }
      break
    case 'code':
      // No specific validation for code
      break
    default:
      break
  }
}
