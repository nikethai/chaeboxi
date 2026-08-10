import { ToolRiskTier } from '@shared/types/mcp'

/**
 * Semantic risk classification for tool invocations.
 *
 * Instead of relying on a single regex against the tool name + description,
 * this engine evaluates three independent signals and returns the highest
 * tier detected:
 *
 *   1. **Command intent** — what the tool *does* (execute, delete, read …)
 *   2. **Path sensitivity** — whether targeted paths touch system-critical locations
 *   3. **Argument patterns** — dangerous flags, glob expansions, credential references
 */

// ---------------------------------------------------------------------------
// 1. Command-intent vocabularies (ordered most → least dangerous)
// ---------------------------------------------------------------------------

const CRITICAL_INTENT_PATTERNS = [
  // System-level / irreversible operations
  /(?:^|[\s_-])(sudo|su|chmod|chown|mkfs|format|fdisk|mount|umount)(?:$|[\s_-])/,
  // Credential / secret access
  /(?:^|[\s_-])(secret|credential|password|token|api[_-]?key|private[_-]?key)(?:$|[\s_-])/,
  // Environment mutation
  /(?:^|[\s_-])(set[_-]?env|putenv|export[_-]?env|env[_-]?var)(?:$|[\s_-])/,
  // Process / service lifecycle
  /(?:^|[\s_-])(kill|pkill|shutdown|reboot|restart[_-]?service|systemctl|launchctl)(?:$|[\s_-])/,
]

const HIGH_INTENT_PATTERNS = [
  // Generic execution / shell
  /(?:^|[\s_-])(exec|execute|command|shell|terminal|bash|sh|zsh|powershell|cmd)(?:$|[\s_-])/,
  // Scripting runtimes invoked as tools
  /(?:^|[\s_-])(run[_-]?script|python|node|ruby|perl)(?:$|[\s_-])/,
  // Destructive file operations
  /(?:^|[\s_-])(delete|remove|rmdir|unlink|truncate|overwrite)(?:$|[\s_-])/,
  // Mutation verbs
  /(?:^|[\s_-])(write|save|create|update|edit|modify|patch|put|post)(?:$|[\s_-])/,
  // Package / dependency management
  /(?:^|[\s_-])(install|uninstall|npm|pip|brew|apt|yum)(?:$|[\s_-])/,
]

const MEDIUM_INTENT_PATTERNS = [
  // Network access
  /(?:^|[\s_-])(fetch|http|request|download|upload|curl|wget|browse|open[_-]?url)(?:$|[\s_-])/,
  // File-system traversal (read-only but sensitive)
  /(?:^|[\s_-])(file|filesystem|directory|folder|read[_-]?file|readdir|stat|glob)(?:$|[\s_-])/,
  // Database operations
  /(?:^|[\s_-])(database|sql|query[_-]?db|mongo|redis|insert|drop[_-]?table)(?:$|[\s_-])/,
]

const LOW_INTENT_PATTERNS = [
  /(?:^|[\s_-])(search|query|find|lookup|list|get|inspect|read|describe|show|view|count|check|status|info|help|version)(?:$|[\s_-])/,
]

// ---------------------------------------------------------------------------
// 2. Path-sensitivity patterns
// ---------------------------------------------------------------------------

const CRITICAL_PATH_PATTERNS = [
  // Unix system paths
  /\/etc\/(passwd|shadow|sudoers|ssh)/,
  // SSH keys
  /\.ssh\/(id_|authorized_keys|known_hosts)/,
  // Root-level system dirs (exact)
  /^\/(boot|dev|proc|sys)\//,
]

const HIGH_PATH_PATTERNS = [
  // Home-directory dotfiles with secrets
  /\.(env|env\.local|env\.prod|npmrc|netrc|aws\/credentials|gitconfig)/,
  // Generic config dirs
  /\/etc\//,
  // OS keychain / credential stores
  /(keychain|credential[_-]?store|gnome-keyring|kwallet)/,
]

const MEDIUM_PATH_PATTERNS = [
  // Temporary dirs (may still leak data)
  /\/(tmp|temp|var\/log)\//,
  // Node modules — large blast radius
  /node_modules/,
]

// ---------------------------------------------------------------------------
// 3. Argument patterns (inspected when args are provided)
// ---------------------------------------------------------------------------

const CRITICAL_ARG_PATTERNS = [
  // Force / recursive destructive flags
  // NOTE: we avoid \b before - because JSON.stringify produces strings like
  // '{"command":"rm -rf /"}' where the hyphen is preceded by a word char.
  /-rf/,
  /--force/,
  /--no-preserve-root/,
  // Pipe to shell (json: {"command":"curl ... | bash"})
  /\|\s*(sh|bash|zsh|eval)/,
  // Inline eval
  /\beval\s*\(/,
]

const HIGH_ARG_PATTERNS = [
  // Recursive flag on its own
  /\b-[rR]\b/,
  // Wildcard glob that could be dangerous
  /[*?]\s/,
  // Redirect / append to file
  />{1,2}\s*\//,
  // Sudo-prefixed arg strings
  /\bsudo\b/,
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function testPatterns(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text))
}

function flattenArgs(args: unknown): string {
  if (args == null) return ''
  if (typeof args === 'string') return args
  try {
    return JSON.stringify(args)
  } catch {
    return String(args)
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type RiskClassification = {
  tier: ToolRiskTier
  signals: RiskSignal[]
}

export type RiskSignal = {
  source: 'intent' | 'path' | 'args'
  tier: ToolRiskTier
  matched: string
}

/**
 * Classify the risk tier of a tool invocation by analysing its name,
 * description, and (optionally) the concrete arguments it will receive.
 *
 * Returns the **highest** tier detected across all three signal sources
 * plus a list of the individual signals that contributed.
 */
/**
 * Built-in read-only tools that only call public HTTP APIs / local storage.
 * Force LOW so they don't trip MEDIUM network-intent patterns (fetch/url).
 */
const BUILTIN_LOW_RISK_TOOLS = new Set([
  'web_search',
  'parse_link',
  'read_video_url',
  'read_video',
  'query_knowledge_base',
  'get_files_meta',
  'list_files',
  'list_tasks',
  'memory_lookup',
  'memory_recall',
  'memory_list',
  'memory_reflect',
])

export function classifyToolRisk(toolName: string, description?: string, args?: unknown): RiskClassification {
  const baseName = toolName.split(/[:/]|__/).at(-1) || toolName
  if (BUILTIN_LOW_RISK_TOOLS.has(baseName) || BUILTIN_LOW_RISK_TOOLS.has(toolName)) {
    return {
      tier: ToolRiskTier.LOW,
      signals: [{ source: 'intent', tier: ToolRiskTier.LOW, matched: baseName }],
    }
  }

  const signals: RiskSignal[] = []

  const intentText = `${toolName} ${description ?? ''}`.toLowerCase()
  classifyIntent(intentText, signals)

  const argsText = flattenArgs(args).toLowerCase()
  if (argsText) {
    classifyPaths(argsText, signals)
    classifyArgs(argsText, signals)
  }

  // Also check paths that might appear in the description
  classifyPaths(intentText, signals)

  const tier =
    signals.length > 0
      ? signals.reduce<ToolRiskTier>((max, s) => (tierRank(s.tier) > tierRank(max) ? s.tier : max), ToolRiskTier.LOW)
      : ToolRiskTier.MEDIUM // unknown tools default to MEDIUM

  return { tier, signals }
}

/**
 * Drop-in replacement for the legacy `getToolRiskTier()` function.
 * Returns just the tier enum value.
 */
export function getToolRiskTier(toolName: string, description?: string, args?: unknown): ToolRiskTier {
  return classifyToolRisk(toolName, description, args).tier
}

// ---------------------------------------------------------------------------
// Internal classifiers
// ---------------------------------------------------------------------------

function classifyIntent(text: string, signals: RiskSignal[]): void {
  if (testPatterns(text, CRITICAL_INTENT_PATTERNS)) {
    signals.push({
      source: 'intent',
      tier: ToolRiskTier.CRITICAL,
      matched: extractMatch(text, CRITICAL_INTENT_PATTERNS),
    })
  }
  if (testPatterns(text, HIGH_INTENT_PATTERNS)) {
    signals.push({ source: 'intent', tier: ToolRiskTier.HIGH, matched: extractMatch(text, HIGH_INTENT_PATTERNS) })
  }
  if (testPatterns(text, MEDIUM_INTENT_PATTERNS)) {
    signals.push({ source: 'intent', tier: ToolRiskTier.MEDIUM, matched: extractMatch(text, MEDIUM_INTENT_PATTERNS) })
  }
  if (testPatterns(text, LOW_INTENT_PATTERNS)) {
    signals.push({ source: 'intent', tier: ToolRiskTier.LOW, matched: extractMatch(text, LOW_INTENT_PATTERNS) })
  }
}

function classifyPaths(text: string, signals: RiskSignal[]): void {
  if (testPatterns(text, CRITICAL_PATH_PATTERNS)) {
    signals.push({ source: 'path', tier: ToolRiskTier.CRITICAL, matched: extractMatch(text, CRITICAL_PATH_PATTERNS) })
  }
  if (testPatterns(text, HIGH_PATH_PATTERNS)) {
    signals.push({ source: 'path', tier: ToolRiskTier.HIGH, matched: extractMatch(text, HIGH_PATH_PATTERNS) })
  }
  if (testPatterns(text, MEDIUM_PATH_PATTERNS)) {
    signals.push({ source: 'path', tier: ToolRiskTier.MEDIUM, matched: extractMatch(text, MEDIUM_PATH_PATTERNS) })
  }
}

function classifyArgs(text: string, signals: RiskSignal[]): void {
  if (testPatterns(text, CRITICAL_ARG_PATTERNS)) {
    signals.push({ source: 'args', tier: ToolRiskTier.CRITICAL, matched: extractMatch(text, CRITICAL_ARG_PATTERNS) })
  }
  if (testPatterns(text, HIGH_ARG_PATTERNS)) {
    signals.push({ source: 'args', tier: ToolRiskTier.HIGH, matched: extractMatch(text, HIGH_ARG_PATTERNS) })
  }
}

function extractMatch(text: string, patterns: RegExp[]): string {
  for (const p of patterns) {
    const m = p.exec(text)
    if (m) return m[0]
  }
  return ''
}

function tierRank(tier: ToolRiskTier): number {
  switch (tier) {
    case ToolRiskTier.LOW:
      return 0
    case ToolRiskTier.MEDIUM:
      return 1
    case ToolRiskTier.HIGH:
      return 2
    case ToolRiskTier.CRITICAL:
      return 3
  }
}
