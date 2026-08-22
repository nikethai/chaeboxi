/**
 * Hybrid agent-folder scan roots: user-global always + project under workspaceRoot or CWD.
 * Relative project paths (./…) become absolute when workspaceRoot is set so Tauri scan
 * does not depend on process CWD (desktop apps often launch from /).
 */

export type AgentRootSpec = {
  /** Logical origin label (project, claude, cursor, …) */
  origin: string
  /** Path template: `~/…` (user-global) or `./…` (project-relative) */
  path: string
}

export type ResolvedAgentRoot = {
  origin: string
  /** Path passed to desktop scan (absolute for project when workspace set; else as-is) */
  path: string
  /** True when path was joined to workspaceRoot */
  workspaceBound: boolean
}

/**
 * Join workspace base with a project-relative root (`./.claude/skills` → `/repo/.claude/skills`).
 */
export function joinWorkspaceRoot(workspaceRoot: string, relativePath: string): string {
  const base = workspaceRoot.replace(/[/\\]+$/, '')
  const rel = relativePath.replace(/^\.\//, '').replace(/\\/g, '/')
  // Prefer forward slashes; Tauri/Rust accept them on Windows too for most APIs
  if (!base) return relativePath
  if (/^[A-Za-z]:/.test(base) || base.startsWith('/')) {
    const sep = base.includes('\\') && !base.includes('/') ? '\\' : '/'
    const joined = `${base}${sep}${rel.split('/').join(sep)}`
    return joined
  }
  return `${base}/${rel}`
}

export function isProjectRelativePath(path: string): boolean {
  return path.startsWith('./') || path.startsWith('.\\')
}

export function isUserGlobalPath(path: string): boolean {
  return path.startsWith('~/') || path.startsWith('~\\')
}

/**
 * Resolve root specs for desktop scan.
 * - `~/…` left for Rust `expand_user_path`
 * - `./…` → absolute under workspaceRoot when provided; else left relative (CWD fallback in Rust)
 * - absolute paths passed through
 */
export function resolveAgentRootPaths(
  specs: AgentRootSpec[],
  options?: { workspaceRoot?: string | null }
): ResolvedAgentRoot[] {
  const workspaceRoot = options?.workspaceRoot?.trim() || ''

  return specs.map((spec) => {
    const raw = spec.path.trim()
    if (!raw) {
      return { origin: spec.origin, path: raw, workspaceBound: false }
    }

    if (isUserGlobalPath(raw) || raw.startsWith('/') || /^[A-Za-z]:[\\/]/.test(raw)) {
      return { origin: spec.origin, path: raw, workspaceBound: false }
    }

    if (isProjectRelativePath(raw) && workspaceRoot) {
      // Do not emit an absolute project path for Tauri scan. Project files
      // are read through native workspace capabilities, never skills:scan.
      return {
        origin: spec.origin,
        path: raw,
        workspaceBound: true,
      }
    }

    return { origin: spec.origin, path: raw, workspaceBound: false }
  })
}

/** Paths sent to Tauri scan: user-global `~/…` only. Project-relative paths are omitted. */
export function globalScanPaths(specs: AgentRootSpec[]): string[] {
  return specs.map((s) => s.path.trim()).filter((path) => isUserGlobalPath(path))
}

/** Paths only (for Tauri invoke). */
export function resolveAgentRootPathList(
  specs: AgentRootSpec[],
  _options?: { workspaceRoot?: string | null }
): string[] {
  return globalScanPaths(specs)
}
