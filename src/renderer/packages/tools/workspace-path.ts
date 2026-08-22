/**
 * UX-only lexical helper. Not a security boundary.
 * Native handle-relative capability APIs authorize filesystem access.
 */

export type WorkspacePathResult = { ok: true; absolutePath: string } | { ok: false; error: string }

function normalizeSlashes(input: string): string {
  return input.replace(/\\/g, '/')
}

function hasNullByte(input: string): boolean {
  return input.includes('\0')
}

function isAbsolutePath(input: string): boolean {
  const n = normalizeSlashes(input)
  return n.startsWith('/') || /^[a-zA-Z]:\//.test(n) || n.startsWith('//')
}

type ParsedPath = {
  /** '' for POSIX absolute, 'C:' for Windows drive, '' for relative */
  prefix: string
  absolute: boolean
  segments: string[]
}

function parsePath(input: string): ParsedPath {
  const n = normalizeSlashes(input.trim())
  if (!n) {
    return { prefix: '', absolute: false, segments: [] }
  }

  if (n.startsWith('//')) {
    // UNC paths — treat as absolute with //host/share prefix collapse into segments after //
    const rest = n.slice(2)
    return {
      prefix: '//',
      absolute: true,
      segments: rest.split('/').filter((s) => s.length > 0 && s !== '.'),
    }
  }

  const drive = n.match(/^([a-zA-Z]:)(\/|$)/)
  if (drive) {
    const after = n.slice(drive[1].length).replace(/^\//, '')
    return {
      prefix: drive[1].toUpperCase(),
      absolute: true,
      segments: after.split('/').filter((s) => s.length > 0 && s !== '.'),
    }
  }

  if (n.startsWith('/')) {
    return {
      prefix: '',
      absolute: true,
      segments: n
        .slice(1)
        .split('/')
        .filter((s) => s.length > 0 && s !== '.'),
    }
  }

  return {
    prefix: '',
    absolute: false,
    segments: n.split('/').filter((s) => s.length > 0 && s !== '.'),
  }
}

function collapseSegments(segments: string[]): string[] | null {
  const out: string[] = []
  for (const seg of segments) {
    if (seg === '..') {
      if (out.length === 0) return null
      out.pop()
      continue
    }
    out.push(seg)
  }
  return out
}

function joinParsed(parsed: ParsedPath): string {
  const body = parsed.segments.join('/')
  if (parsed.prefix === '//') {
    return body ? `//${body}` : '//'
  }
  if (parsed.prefix) {
    // Windows drive
    return body ? `${parsed.prefix}/${body}` : `${parsed.prefix}/`
  }
  if (parsed.absolute) {
    return body ? `/${body}` : '/'
  }
  return body
}

function stripTrailingSlash(p: string): string {
  if (p === '/' || /^[a-zA-Z]:\/$/.test(p) || p === '//') return p
  return p.replace(/\/+$/, '')
}

/**
 * Resolve `userPath` against `workspaceRoot` and reject escapes outside the root.
 * Relative paths join under the root. Absolute paths must still live under the root.
 */
export function resolveWorkspacePath(workspaceRoot: string, userPath: string): WorkspacePathResult {
  if (hasNullByte(workspaceRoot) || hasNullByte(userPath)) {
    return { ok: false, error: 'Invalid path: null bytes are not allowed.' }
  }

  const rootRaw = workspaceRoot.trim()
  const pathRaw = userPath.trim()
  if (!rootRaw) {
    return { ok: false, error: 'Workspace root is not set.' }
  }
  if (!pathRaw) {
    return { ok: false, error: 'Path is empty.' }
  }

  const rootParsed = parsePath(rootRaw)
  if (!rootParsed.absolute) {
    return { ok: false, error: 'Workspace root must be an absolute path.' }
  }
  const rootCollapsed = collapseSegments(rootParsed.segments)
  if (!rootCollapsed) {
    return { ok: false, error: 'Invalid workspace root path.' }
  }
  const rootNormalized = stripTrailingSlash(joinParsed({ ...rootParsed, segments: rootCollapsed }))

  const userParsed = parsePath(pathRaw)
  let candidateParsed: ParsedPath

  if (userParsed.absolute) {
    const collapsed = collapseSegments(userParsed.segments)
    if (!collapsed) {
      return { ok: false, error: 'Invalid absolute path.' }
    }
    candidateParsed = { ...userParsed, segments: collapsed }
  } else {
    const combined = collapseSegments([...rootCollapsed, ...userParsed.segments])
    if (!combined) {
      return { ok: false, error: 'Path escapes the workspace root.' }
    }
    candidateParsed = { ...rootParsed, absolute: true, segments: combined }
  }

  const absolutePath = stripTrailingSlash(joinParsed(candidateParsed))

  // Same volume / prefix required
  if (candidateParsed.prefix !== rootParsed.prefix) {
    return { ok: false, error: `Path is outside the workspace root (${rootNormalized}).` }
  }

  const rootCmp = rootNormalized.toLowerCase()
  const pathCmp = absolutePath.toLowerCase()
  const underRoot = pathCmp === rootCmp || pathCmp.startsWith(`${rootCmp}/`)
  if (!underRoot) {
    return { ok: false, error: `Path is outside the workspace root (${rootNormalized}).` }
  }

  return { ok: true, absolutePath }
}

/** Ensure a cwd stays inside the workspace; defaults to workspace root when omitted. */
export function resolveWorkspaceCwd(workspaceRoot: string, cwd?: string): WorkspacePathResult {
  if (!cwd?.trim()) {
    return resolveWorkspacePath(workspaceRoot, '.')
  }
  return resolveWorkspacePath(workspaceRoot, cwd)
}

export function isWorkspaceRootConfigured(workspaceRoot: string | undefined | null): boolean {
  return Boolean(workspaceRoot?.trim())
}
