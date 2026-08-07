import type { SkillOrigin, SkillPackage } from '@shared/types'
import platform from '@/platform'
import { parseSkillMd } from './parse-skill-md'

/** Raw scan hit from Tauri `skills:scan` */
export interface ScannedSkillFile {
  origin: SkillOrigin | string
  rootDir: string
  folderName: string
  skillPath: string
  content: string
}

export interface SkillScanResult {
  roots: Array<{ origin: string; path: string; exists: boolean }>
  skills: ScannedSkillFile[]
}

/**
 * User-global + project-relative skill roots shared with Claude / Codex / Cursor / etc.
 * Order matters for first-wins when same skill name appears in multiple trees.
 */
export const AGENT_SKILL_ROOTS: Array<{ origin: SkillOrigin; path: string }> = [
  // Project-local (cwd) — highest priority among filesystem sources
  { origin: 'project', path: './.claude/skills' },
  { origin: 'project', path: './.codex/skills' },
  { origin: 'project', path: './.agents/skills' },
  { origin: 'project', path: './.cursor/skills' },
  { origin: 'project', path: './.grok/skills' },
  { origin: 'project', path: './skills' },
  // User-global
  { origin: 'claude', path: '~/.claude/skills' },
  { origin: 'codex', path: '~/.codex/skills' },
  { origin: 'agents', path: '~/.agents/skills' },
  { origin: 'cursor', path: '~/.cursor/skills' },
  { origin: 'grok', path: '~/.grok/skills' },
  { origin: 'gemini', path: '~/.gemini/skills' },
  { origin: 'opencode', path: '~/.config/opencode/skills' },
]

function isDesktopSkillsScanAvailable(): boolean {
  return platform.type === 'desktop' && typeof window !== 'undefined' && typeof window.desktopAPI?.invoke === 'function'
}

/**
 * Scan standard agent skill directories on the local machine (desktop only).
 * Web/mobile: returns empty.
 */
export async function scanAgentSkillFiles(extraRoots: string[] = []): Promise<SkillScanResult> {
  if (!isDesktopSkillsScanAvailable()) {
    return { roots: [], skills: [] }
  }

  const roots = [
    ...AGENT_SKILL_ROOTS.map((r) => r.path),
    ...extraRoots.filter(Boolean),
  ]

  try {
    const result = (await window.desktopAPI.invoke('skills:scan', roots)) as SkillScanResult
    return {
      roots: result?.roots || [],
      skills: Array.isArray(result?.skills) ? result.skills : [],
    }
  } catch (error) {
    console.warn('[skills] scan failed:', error)
    return { roots: [], skills: [] }
  }
}

/**
 * Parse scanned files into SkillPackage list.
 * Same skill name from multiple roots: first in scan order wins (project before global).
 */
export function parseScannedSkills(scanned: ScannedSkillFile[]): SkillPackage[] {
  const byName = new Map<string, SkillPackage>()

  for (const hit of scanned) {
    try {
      const origin = (hit.origin as SkillOrigin) || 'unknown'
      const skill = parseSkillMd(hit.content, {
        id: `agent:${origin}:${hit.folderName}`,
        source: 'agent',
        enabled: true,
        loose: true,
        folderName: hit.folderName,
        origin,
        originPath: hit.skillPath,
      })
      if (!byName.has(skill.name)) {
        byName.set(skill.name, skill)
      }
    } catch (error) {
      // Skip invalid / incomplete SKILL.md (common in mixed ecosystems)
      console.debug('[skills] skip', hit.skillPath, error)
    }
  }

  return [...byName.values()]
}

export async function discoverAgentSkills(extraRoots: string[] = []): Promise<{
  skills: SkillPackage[]
  roots: SkillScanResult['roots']
  scannedCount: number
}> {
  const scan = await scanAgentSkillFiles(extraRoots)
  const skills = parseScannedSkills(scan.skills)
  return {
    skills,
    roots: scan.roots,
    scannedCount: scan.skills.length,
  }
}
