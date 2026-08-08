import type { CommandOrigin, CommandPackage } from '@shared/types'
import { resolveAgentRootPathList } from '@/packages/agent-scan'
import platform from '@/platform'
import { parseCommandMd } from './parse-command-md'

/** Reuse skills:scan IPC shape (folder of files with content). */
export interface ScannedCommandFile {
  origin: CommandOrigin | string
  rootDir: string
  folderName: string
  skillPath: string
  content: string
}

export interface CommandScanResult {
  roots: Array<{ origin: string; path: string; exists: boolean }>
  skills: ScannedCommandFile[]
}

export type DiscoverAgentCommandsOptions = {
  workspaceRoot?: string | null
  extraRoots?: string[]
}

/**
 * Project + user-global command roots (Claude / Cursor style `.md` trees).
 * Order: project first, then user-global.
 */
export const AGENT_COMMAND_ROOTS: Array<{ origin: CommandOrigin; path: string }> = [
  { origin: 'project', path: './.claude/commands' },
  { origin: 'project', path: './.cursor/commands' },
  { origin: 'project', path: './.agents/commands' },
  { origin: 'project', path: './.codex/commands' },
  { origin: 'project', path: './.grok/commands' },
  { origin: 'project', path: './commands' },
  { origin: 'claude', path: '~/.claude/commands' },
  { origin: 'cursor', path: '~/.cursor/commands' },
  { origin: 'agents', path: '~/.agents/commands' },
  { origin: 'codex', path: '~/.codex/commands' },
  { origin: 'grok', path: '~/.grok/commands' },
]

function isDesktopScanAvailable(): boolean {
  return platform.type === 'desktop' && typeof window !== 'undefined' && typeof window.desktopAPI?.invoke === 'function'
}

/**
 * Scan command directories. Reuses Tauri `skills:scan` (reads each subfolder SKILL.md OR
 * we need file-level scan). Claude commands are often flat `name.md` files, not folders.
 *
 * For v1: try skills:scan first (folder/SKILL.md). Also accept flat .md via commands:scan if present;
 * fallback maps folderName from file basename when content is the whole md file.
 */
export async function scanAgentCommandFiles(
  options: DiscoverAgentCommandsOptions = {}
): Promise<CommandScanResult> {
  if (!isDesktopScanAvailable()) {
    return { roots: [], skills: [] }
  }

  const roots = [
    ...resolveAgentRootPathList(AGENT_COMMAND_ROOTS, { workspaceRoot: options.workspaceRoot }),
    ...(options.extraRoots || []).filter(Boolean),
  ]

  try {
    // Prefer dedicated commands:scan if available; else skills:scan (folder-based)
    let result: CommandScanResult | null = null
    try {
      result = (await window.desktopAPI.invoke('commands:scan', roots)) as CommandScanResult
    } catch {
      result = (await window.desktopAPI.invoke('skills:scan', roots)) as CommandScanResult
    }
    return {
      roots: result?.roots || [],
      skills: Array.isArray(result?.skills) ? result.skills : [],
    }
  } catch (error) {
    console.warn('[commands] scan failed:', error)
    return { roots: [], skills: [] }
  }
}

export function parseScannedCommands(scanned: ScannedCommandFile[]): CommandPackage[] {
  const byName = new Map<string, CommandPackage>()

  for (const hit of scanned) {
    try {
      const origin = (hit.origin as CommandOrigin) || 'unknown'
      const base = hit.folderName.replace(/\.md$/i, '')
      const cmd = parseCommandMd(hit.content, {
        id: `agent:${origin}:${base}`,
        source: 'agent',
        enabled: true,
        loose: true,
        fileBaseName: base,
        origin,
        originPath: hit.skillPath,
      })
      if (!byName.has(cmd.name)) {
        byName.set(cmd.name, cmd)
      }
    } catch (error) {
      console.debug('[commands] skip', hit.skillPath, error)
    }
  }

  return [...byName.values()]
}

export async function discoverAgentCommands(options: DiscoverAgentCommandsOptions = {}): Promise<{
  commands: CommandPackage[]
  roots: CommandScanResult['roots']
  scannedCount: number
}> {
  const scan = await scanAgentCommandFiles(options)
  const commands = parseScannedCommands(scan.skills)
  return {
    commands,
    roots: scan.roots,
    scannedCount: scan.skills.length,
  }
}
