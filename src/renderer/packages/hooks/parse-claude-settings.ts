import type { HookDefinition, HookEvent, HookOrigin } from '@shared/types'

/**
 * Tolerant parser for Claude Code settings.json `hooks` block.
 * Shape:
 * {
 *   hooks: {
 *     PreToolUse: [{ matcher?: string, hooks: [{ type: 'command', command: '...' }] }]
 *   }
 * }
 */
export function parseClaudeSettingsHooks(
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
  const idPrefix = options.idPrefix || `claude:${options.originPath}`

  for (const [eventName, groups] of Object.entries(hooksRoot as Record<string, unknown>)) {
    const event = mapClaudeEvent(eventName)
    if (!event) continue
    if (!Array.isArray(groups)) continue

    let groupIndex = 0
    for (const group of groups) {
      if (!group || typeof group !== 'object') continue
      const g = group as { matcher?: string; hooks?: unknown[]; command?: string; type?: string }
      const matcher = typeof g.matcher === 'string' ? g.matcher : undefined
      const nested = Array.isArray(g.hooks) ? g.hooks : g.command ? [g] : []

      let hookIndex = 0
      for (const h of nested) {
        if (!h || typeof h !== 'object') continue
        const item = h as { type?: string; command?: string; timeout?: number }
        if (item.type && item.type !== 'command') {
          // Skip prompt/agent types for v1 shell focus; could map prompt → inject later
          continue
        }
        const command = typeof item.command === 'string' ? item.command : undefined
        if (!command) continue

        out.push({
          id: `${idPrefix}:${event}:${groupIndex}:${hookIndex}`,
          name: `${eventName}${matcher ? ` (${matcher})` : ''}`,
          description: command.slice(0, 120),
          event,
          enabled: true,
          origin: options.origin,
          originPath: options.originPath,
          kind: 'command',
          matcher,
          command,
          timeoutMs: typeof item.timeout === 'number' ? item.timeout * 1000 : undefined,
        })
        hookIndex++
      }
      groupIndex++
    }
  }

  return out
}

function mapClaudeEvent(name: string): HookEvent | null {
  const map: Record<string, HookEvent> = {
    SessionStart: 'SessionStart',
    PreToolUse: 'PreToolUse',
    PostToolUse: 'PostToolUse',
    Stop: 'Stop',
    // Claude doesn't use PreTurn/PostTurn names; map UserPromptSubmit-ish later if needed
    UserPromptSubmit: 'PreTurn',
  }
  return map[name] || null
}
