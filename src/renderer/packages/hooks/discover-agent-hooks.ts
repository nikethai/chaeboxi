import type { HookDefinition, HookOrigin } from '@shared/types'
import { resolveAgentRootPathList } from '@/packages/agent-scan'
import platform from '@/platform'
import { parseClaudeSettingsHooks } from './parse-claude-settings'
import { parseCursorHooksJson } from './parse-cursor-hooks'

export type DiscoverAgentHooksOptions = {
  workspaceRoot?: string | null
}

/** Config files to read (not directories of scripts) */
export const AGENT_HOOK_CONFIGS: Array<{ origin: HookOrigin; path: string; kind: 'claude' | 'cursor' }> = [
  { origin: 'project', path: './.claude/settings.json', kind: 'claude' },
  { origin: 'project', path: './.cursor/hooks.json', kind: 'cursor' },
  { origin: 'claude', path: '~/.claude/settings.json', kind: 'claude' },
  { origin: 'cursor', path: '~/.cursor/hooks.json', kind: 'cursor' },
]

function isDesktop(): boolean {
  return platform.type === 'desktop' && typeof window !== 'undefined' && typeof window.desktopAPI?.invoke === 'function'
}

/**
 * Read and parse hook config files from agent setups.
 * Uses Tauri `hooks:read-configs` when available; falls back to empty on web.
 */
export async function discoverAgentHooks(options: DiscoverAgentHooksOptions = {}): Promise<{
  hooks: HookDefinition[]
  roots: Array<{ path: string; origin: string; exists: boolean }>
}> {
  if (!isDesktop()) {
    return { hooks: [], roots: [] }
  }

  const paths = resolveAgentRootPathList(
    AGENT_HOOK_CONFIGS.map((c) => ({ origin: c.origin, path: c.path })),
    { workspaceRoot: options.workspaceRoot }
  )

  try {
    const result = (await window.desktopAPI.invoke('hooks:read-configs', paths)) as {
      files?: Array<{ path: string; content: string; exists: boolean }>
    }
    const files = result?.files || []
    const roots: Array<{ path: string; origin: string; exists: boolean }> = []
    const hooks: HookDefinition[] = []
    const seenIds = new Set<string>()

    for (let i = 0; i < AGENT_HOOK_CONFIGS.length; i++) {
      const spec = AGENT_HOOK_CONFIGS[i]
      const resolved = paths[i]
      const file = files.find((f) => f.path === resolved) || files[i]
      const exists = Boolean(file?.exists && file.content)
      roots.push({ path: resolved, origin: spec.origin, exists })
      if (!exists || !file?.content) continue

      const origin: HookOrigin = spec.origin === 'project' ? 'project' : spec.origin
      const parsed =
        spec.kind === 'claude'
          ? parseClaudeSettingsHooks(file.content, {
              origin,
              originPath: resolved,
              idPrefix: `agent:${spec.origin}:${i}`,
            })
          : parseCursorHooksJson(file.content, {
              origin,
              originPath: resolved,
              idPrefix: `agent:${spec.origin}:${i}`,
            })

      for (const h of parsed) {
        if (seenIds.has(h.id)) continue
        seenIds.add(h.id)
        hooks.push(h)
      }
    }

    return { hooks, roots }
  } catch (error) {
    console.warn('[hooks] discover failed', error)
    return { hooks: [], roots: [] }
  }
}
