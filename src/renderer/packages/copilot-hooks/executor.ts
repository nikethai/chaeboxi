import platform from '@/platform'
import type { CopilotHook } from '@shared/types'

const HOOK_TIMEOUT_MS = 5000

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Hook timed out')), timeoutMs)),
  ])
}

async function executeInjectContextHook(hook: { type: 'inject-context'; content: string }): Promise<string> {
  return hook.content
}

async function executeInjectDatetimeHook(): Promise<string> {
  const now = new Date()
  return `Current date and time: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`
}

async function executeInjectSystemInfoHook(): Promise<string> {
  const platformInfo = await platform.getConfig().catch(() => null)
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
  const language = typeof navigator !== 'undefined' ? navigator.language : 'Unknown'

  return [
    `User Agent: ${userAgent}`,
    `Language: ${language}`,
    platformInfo ? `Platform ID: ${platformInfo.uuid}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

async function executeWebFetchHook(hook: { type: 'web-fetch'; url: string; extractAs: 'text' | 'json' }): Promise<string> {
  try {
    const response = await fetch(hook.url, {
      headers: {
        Accept: hook.extractAs === 'json' ? 'application/json' : 'text/plain',
      },
    })

    if (!response.ok) {
      return `Error: Failed to fetch URL (${response.status} ${response.statusText})`
    }

    if (hook.extractAs === 'json') {
      const json = await response.json()
      return JSON.stringify(json, null, 2)
    } else {
      return await response.text()
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return `Error: Failed to fetch URL - ${message}`
  }
}

async function executeValidateFormatHook(
  _hook: { type: 'validate-format'; format: 'markdown' | 'json' | 'code' },
  _output: string
): Promise<void> {
  // Validation is a post-turn hook that runs after generation
  // For now, we just acknowledge it - actual validation could be implemented
  // to log warnings or modify state if the output doesn't match the expected format
}

/**
 * Execute pre-turn hooks and return the combined context string to prepend to messages
 */
export async function executePreHooks(hooks: CopilotHook[]): Promise<string> {
  if (!hooks || hooks.length === 0) {
    return ''
  }

  const results: string[] = []

  for (const hook of hooks) {
    try {
      let result: string

      switch (hook.type) {
        case 'inject-context':
          result = await withTimeout(executeInjectContextHook(hook), HOOK_TIMEOUT_MS)
          break
        case 'inject-datetime':
          result = await withTimeout(executeInjectDatetimeHook(), HOOK_TIMEOUT_MS)
          break
        case 'inject-system-info':
          result = await withTimeout(executeInjectSystemInfoHook(), HOOK_TIMEOUT_MS)
          break
        case 'web-fetch':
          result = await withTimeout(executeWebFetchHook(hook), HOOK_TIMEOUT_MS)
          break
        case 'validate-format':
          // validate-format is a post-turn only hook, skip in pre-turn
          continue
        default:
          continue
      }

      if (result) {
        results.push(result)
      }
    } catch {
      // Fail silently on error - hook errors should not block generation
      console.warn('[copilot-hooks] Pre-hook failed silently')
    }
  }

  if (results.length === 0) {
    return ''
  }

  return `[Injected Context]\n${results.join('\n\n')}\n[/Injected Context]`
}

/**
 * Execute post-turn hooks after generation completes
 */
export async function executePostHooks(hooks: CopilotHook[], output: string): Promise<void> {
  if (!hooks || hooks.length === 0) {
    return
  }

  for (const hook of hooks) {
    try {
      switch (hook.type) {
        case 'validate-format':
          await withTimeout(executeValidateFormatHook(hook, output), HOOK_TIMEOUT_MS)
          break
        case 'inject-context':
        case 'inject-datetime':
        case 'inject-system-info':
        case 'web-fetch':
          // These are pre-turn only hooks, skip in post-turn
          break
        default:
          break
      }
    } catch {
      // Fail silently on error
      console.warn('[copilot-hooks] Post-hook failed silently')
    }
  }
}
