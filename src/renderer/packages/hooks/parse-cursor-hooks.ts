import type { HookDefinition, HookEvent, HookOrigin } from '@shared/types'

/**
 * Tolerant parser for Cursor `.cursor/hooks.json`:
 * {
 *   version: 1,
 *   hooks: {
 *     stop: [{ command: '...' }],
 *     ...
 *   }
 * }
 */
export function parseCursorHooksJson(
  rawJson: string,
  options: { origin: HookOrigin; originPath: string; idPrefix?: string }
): HookDefinition[] {
  let data: unknown
  try {
    data = JSON.parse(rawJson)
  } catch {
    return []
  }
  if (!data || typeof data !== 'object') return []
  const hooksRoot = (data as { hooks?: unknown }).hooks
  if (!hooksRoot || typeof hooksRoot !== 'object') return []

  const out: HookDefinition[] = []
  const idPrefix = options.idPrefix || `cursor:${options.originPath}`

  for (const [eventName, list] of Object.entries(hooksRoot as Record<string, unknown>)) {
    const event = mapCursorEvent(eventName)
    if (!event) continue
    if (!Array.isArray(list)) continue

    let i = 0
    for (const item of list) {
      if (!item || typeof item !== 'object') continue
      const h = item as { command?: string }
      const command = typeof h.command === 'string' ? h.command : undefined
      if (!command) continue

      out.push({
        id: `${idPrefix}:${event}:${i}`,
        name: `${eventName}`,
        description: command.slice(0, 120),
        event,
        enabled: true,
        origin: options.origin,
        originPath: options.originPath,
        kind: 'command',
        command,
      })
      i++
    }
  }

  return out
}

function mapCursorEvent(name: string): HookEvent | null {
  const lower = name.toLowerCase()
  const map: Record<string, HookEvent> = {
    stop: 'Stop',
    pretooluse: 'PreToolUse',
    posttooluse: 'PostToolUse',
    sessionstart: 'SessionStart',
    beforeSubmitPrompt: 'PreTurn',
    beforesubmitprompt: 'PreTurn',
  }
  return map[name] || map[lower] || null
}
