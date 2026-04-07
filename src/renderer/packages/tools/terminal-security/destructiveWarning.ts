interface DestructiveCheckResult {
  isDestructive: boolean
  warnings: string[]
}

const DESTRUCTIVE_PATTERNS: Array<{ pattern: RegExp; warning: string }> = [
  { pattern: /\brm\s/, warning: 'File deletion detected' },
  { pattern: /\brmdir\b/, warning: 'Directory removal detected' },
  { pattern: />\s*\S+/, warning: 'File overwrite via redirect detected' },
  { pattern: /\btruncate\b/, warning: 'File truncation detected' },
  { pattern: /\bdrop\s+(table|database)\b/i, warning: 'Database drop operation detected' },
  { pattern: /\bdelete\s+from\b/i, warning: 'Database delete operation detected' },
  { pattern: /\bgit\s+reset\b/, warning: 'Git reset detected' },
  { pattern: /\bgit\s+clean\b/, warning: 'Git clean detected' },
  { pattern: /\bgit\s+checkout\s+--\s/, warning: 'Git file discard detected' },
  { pattern: /\bgit\s+push\s+.*--force\b/, warning: 'Git force push detected' },
  { pattern: /\bshred\b/, warning: 'Secure file deletion detected' },
  { pattern: /\bwipe\b/, warning: 'Disk wipe detected' },
  { pattern: /\bformat\b/, warning: 'Format operation detected' },
]

/**
 * Check whether a command contains destructive patterns
 * and return warnings for each detected pattern.
 */
export function checkDestructive(command: string): DestructiveCheckResult {
  const warnings: string[] = []

  for (const { pattern, warning } of DESTRUCTIVE_PATTERNS) {
    if (pattern.test(command)) {
      warnings.push(warning)
    }
  }

  return {
    isDestructive: warnings.length > 0,
    warnings,
  }
}
