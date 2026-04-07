export type CommandRiskLevel = 'safe' | 'moderate' | 'dangerous' | 'blocked'

interface ClassificationResult {
  level: CommandRiskLevel
  reason: string
}

const BLOCKED_COMMANDS = new Set([
  'mkfs',
  'dd',
  'fdisk',
  'parted',
  'shutdown',
  'reboot',
  'halt',
  'poweroff',
  'init',
  'telinit',
  'format',
  'diskpart',
])

const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\brm\s+(-\w*\s+)*-\w*[rf]\w*\b/, reason: 'Recursive force deletion' },
  { pattern: /\bsudo\b/, reason: 'Elevated privilege execution' },
  { pattern: /\bchmod\s+777\b/, reason: 'Overly permissive file permissions' },
  { pattern: /\bchown\b.*\//, reason: 'Ownership change on path' },
  { pattern: />\s*\/dev\//, reason: 'Write to device file' },
  { pattern: /\|.*\b(ba)?sh\b/, reason: 'Pipe to shell execution' },
  { pattern: /\b(curl|wget)\b.*\|\s*(ba)?sh/, reason: 'Remote script execution' },
  { pattern: /\beval\b/, reason: 'Dynamic code evaluation' },
  { pattern: /:(){ :|:& };:/, reason: 'Fork bomb detected' },
  { pattern: /\bkillall\b/, reason: 'Mass process termination' },
  { pattern: /\bpkill\s+-9\b/, reason: 'Force kill processes' },
  { pattern: /\bmkfs\b/, reason: 'Filesystem format operation' },
]

const MODERATE_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\brm\b/, reason: 'File deletion' },
  { pattern: /\bmv\b/, reason: 'File move/rename' },
  { pattern: /\bchmod\b/, reason: 'Permission change' },
  { pattern: /\bkill\b/, reason: 'Process termination' },
  { pattern: /\bnpm\s+install\b/, reason: 'Package installation' },
  { pattern: /\bpnpm\s+(add|install)\b/, reason: 'Package installation' },
  { pattern: /\byarn\s+add\b/, reason: 'Package installation' },
  { pattern: /\bpip\s+install\b/, reason: 'Package installation' },
  { pattern: /\bgit\s+push\b/, reason: 'Git push to remote' },
  { pattern: /\bgit\s+reset\s+--hard\b/, reason: 'Git hard reset' },
  { pattern: /\bdocker\b/, reason: 'Docker operation' },
  { pattern: /\bcurl\b/, reason: 'Network request' },
  { pattern: /\bwget\b/, reason: 'Network download' },
]

/**
 * Classify a shell command by its risk level.
 */
export function classifyCommand(command: string): ClassificationResult {
  const trimmed = command.trim()
  if (!trimmed) {
    return { level: 'safe', reason: 'Empty command' }
  }

  // Extract the base command (first word, ignoring env vars)
  const baseCommand = extractBaseCommand(trimmed)

  if (BLOCKED_COMMANDS.has(baseCommand)) {
    return { level: 'blocked', reason: `Command '${baseCommand}' is blocked for safety` }
  }

  for (const { pattern, reason } of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { level: 'dangerous', reason }
    }
  }

  for (const { pattern, reason } of MODERATE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { level: 'moderate', reason }
    }
  }

  return { level: 'safe', reason: 'No known risk patterns detected' }
}

function extractBaseCommand(command: string): string {
  // Strip leading env variable assignments (e.g., "FOO=bar command")
  let cleaned = command.replace(/^(\w+=\S*\s+)*/, '')
  // Strip leading path (e.g., /usr/bin/rm -> rm)
  cleaned = cleaned.split(/\s/)[0] || ''
  const parts = cleaned.split('/')
  return parts[parts.length - 1]
}
