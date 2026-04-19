interface PathValidationResult {
  safe: boolean
  reason?: string
}

const SENSITIVE_PATHS_UNIX = [
  '/etc',
  '/usr',
  '/bin',
  '/sbin',
  '/boot',
  '/dev',
  '/proc',
  '/sys',
  '/var/log',
  '/root',
  '/Library/System',
  '/System',
]

const SENSITIVE_PATHS_WINDOWS = [
  'C:\\Windows',
  'C:\\Program Files',
  'C:\\Program Files (x86)',
  'C:\\ProgramData',
]

const SENSITIVE_PATH_PATTERNS = [
  /\/\.ssh\b/,
  /\/\.gnupg\b/,
  /\/\.aws\b/,
  /\/\.kube\b/,
  /\/\.docker\b/,
  /\/\.config\/gcloud\b/,
  /\/\.env\b/,
  /\.pem$/,
  /\.key$/,
  /id_rsa/,
  /id_ed25519/,
]

/**
 * Check whether a command references system-sensitive paths.
 * Scans both explicit path arguments and working directory.
 */
export function validatePaths(command: string, cwd?: string): PathValidationResult {
  const allPaths = [...SENSITIVE_PATHS_UNIX, ...SENSITIVE_PATHS_WINDOWS]

  // Check working directory
  if (cwd) {
    const normalizedCwd = normalizePath(cwd)
    for (const sensitive of allPaths) {
      if (normalizedCwd.startsWith(normalizePath(sensitive))) {
        return { safe: false, reason: `Working directory '${cwd}' is within sensitive path '${sensitive}'` }
      }
    }
  }

  // Check command for sensitive path references
  const tokens = tokenize(command)
  for (const token of tokens) {
    const normalizedToken = normalizePath(token)

    for (const sensitive of allPaths) {
      if (normalizedToken.startsWith(normalizePath(sensitive))) {
        return { safe: false, reason: `Command references sensitive path '${sensitive}'` }
      }
    }

    for (const pattern of SENSITIVE_PATH_PATTERNS) {
      if (pattern.test(token)) {
        return { safe: false, reason: `Command references sensitive path pattern: ${token}` }
      }
    }
  }

  return { safe: true }
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').toLowerCase()
}

function tokenize(command: string): string[] {
  // Simple tokenizer that extracts path-like tokens from a command string
  const tokens: string[] = []
  const regex = /(?:["']([^"']+)["']|(\S+))/g
  let match = regex.exec(command)
  while (match !== null) {
    tokens.push(match[1] || match[2])
    match = regex.exec(command)
  }
  return tokens
}
