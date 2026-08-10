import { getOS } from '@/packages/navigator'
import platform from '@/platform'

export type YtDlpDetectResult = {
  installed: boolean
  path?: string
  version?: string
  /** Package manager that can install yt-dlp on this OS */
  installer: 'brew' | 'winget' | 'pipx' | 'none'
  /** Whether that package manager binary was found */
  installerAvailable: boolean
  installerPath?: string
  error?: string
}

export type YtDlpInstallResult = {
  ok: boolean
  path?: string
  version?: string
  log: string
  error?: string
}

/** Common install locations (GUI apps often lack shell PATH). */
export function ytDlpCandidatePaths(os: ReturnType<typeof getOS> = getOS()): string[] {
  if (os === 'Mac') {
    return ['/opt/homebrew/bin/yt-dlp', '/usr/local/bin/yt-dlp', `${homeDir()}/.local/bin/yt-dlp`]
  }
  if (os === 'Windows') {
    return []
  }
  return ['/usr/bin/yt-dlp', '/usr/local/bin/yt-dlp', `${homeDir()}/.local/bin/yt-dlp`]
}

export function brewCandidatePaths(): string[] {
  return ['/opt/homebrew/bin/brew', '/usr/local/bin/brew']
}

/** PATH prefix so shell commands see Homebrew / local bins. */
export function pathPrefixForShell(os: ReturnType<typeof getOS> = getOS()): string {
  if (os === 'Windows') {
    return ''
  }
  if (os === 'Mac') {
    return 'export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$PATH"; '
  }
  return 'export PATH="/usr/local/bin:$HOME/.local/bin:$HOME/.local/pipx/bin:$PATH"; '
}

export function parseYtDlpVersion(stdout: string): string | undefined {
  const line = stdout.trim().split(/\r?\n/).find((l) => l.trim().length > 0)
  if (!line) return undefined
  // Examples: "2024.08.06", "yt-dlp 2024.08.06"
  const m = line.match(/(\d{4}\.\d{2}\.\d{2}(?:\.\d+)?)/) || line.match(/yt-dlp\s+(\S+)/i)
  return m?.[1] || line.trim().slice(0, 40)
}

function homeDir(): string {
  // Renderer has no guaranteed HOME; keep tilde-free for absolute checks via shell.
  // Shell expansion uses $HOME; candidate list uses a best-effort expand when available.
  try {
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    return env?.HOME || env?.USERPROFILE || '~'
  } catch {
    return '~'
  }
}

async function runShell(
  command: string,
  timeoutMs = 30_000
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  if (!platform.executeCommand) {
    throw new Error('Command execution is only available in the desktop app.')
  }
  return platform.executeCommand(command, undefined, timeoutMs)
}

async function probeBinary(absoluteOrCommand: string, useWhich = false): Promise<{ path: string; version?: string } | null> {
  const os = getOS()
  const prefix = pathPrefixForShell(os)
  const quoted = absoluteOrCommand.includes(' ') ? `"${absoluteOrCommand}"` : absoluteOrCommand

  let cmd: string
  if (os === 'Windows') {
    // Prefer explicit path; otherwise where.exe
    if (useWhich || !absoluteOrCommand.includes('\\') && !absoluteOrCommand.includes('/')) {
      cmd = `where yt-dlp 2>nul & yt-dlp --version`
    } else {
      cmd = `"${absoluteOrCommand}" --version`
    }
  } else if (useWhich) {
    cmd = `${prefix}command -v yt-dlp >/dev/null 2>&1 && yt-dlp --version && command -v yt-dlp`
  } else {
    cmd = `${prefix}test -x ${quoted} && ${quoted} --version && echo ${quoted}`
  }

  try {
    const result = await runShell(cmd, 15_000)
    if (result.exitCode !== 0) return null
    const lines = result.stdout
      .trim()
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    if (lines.length === 0) return null

    if (os === 'Windows' && (useWhich || !absoluteOrCommand.includes('\\'))) {
      // where prints path(s); version may be in stderr or second command
      const pathLine = lines.find((l) => /yt-dlp(\.exe)?$/i.test(l) || l.toLowerCase().includes('yt-dlp'))
      const version = parseYtDlpVersion(result.stdout + '\n' + result.stderr)
      if (pathLine) return { path: pathLine, version }
      // Fallback: version-only success
      if (version) return { path: 'yt-dlp', version }
      return null
    }

    if (useWhich) {
      // last line is path from command -v
      const path = lines[lines.length - 1]
      const version = parseYtDlpVersion(lines.slice(0, -1).join('\n') || lines[0])
      if (path) return { path, version }
      return null
    }

    const path = lines[lines.length - 1] || absoluteOrCommand
    const version = parseYtDlpVersion(lines.slice(0, -1).join('\n') || result.stdout)
    return { path, version }
  } catch {
    return null
  }
}

async function detectInstaller(): Promise<{
  installer: YtDlpDetectResult['installer']
  available: boolean
  path?: string
}> {
  const os = getOS()
  if (os === 'Mac') {
    for (const brew of brewCandidatePaths()) {
      try {
        const r = await runShell(`test -x ${brew} && ${brew} --version`, 10_000)
        if (r.exitCode === 0) {
          return { installer: 'brew', available: true, path: brew }
        }
      } catch {
        // continue
      }
    }
    // PATH fallback
    try {
      const r = await runShell(`${pathPrefixForShell('Mac')}command -v brew`, 10_000)
      if (r.exitCode === 0 && r.stdout.trim()) {
        return { installer: 'brew', available: true, path: r.stdout.trim().split(/\r?\n/)[0] }
      }
    } catch {
      // ignore
    }
    return { installer: 'brew', available: false }
  }
  if (os === 'Windows') {
    try {
      const r = await runShell('where winget', 10_000)
      if (r.exitCode === 0 && r.stdout.trim()) {
        return { installer: 'winget', available: true, path: r.stdout.trim().split(/\r?\n/)[0] }
      }
    } catch {
      // ignore
    }
    return { installer: 'winget', available: false }
  }
  // Linux: prefer pipx (user-level, no root)
  try {
    const r = await runShell(`${pathPrefixForShell('Linux')}command -v pipx`, 10_000)
    if (r.exitCode === 0 && r.stdout.trim()) {
      return { installer: 'pipx', available: true, path: r.stdout.trim().split(/\r?\n/)[0] }
    }
  } catch {
    // ignore
  }
  return { installer: 'pipx', available: false }
}

/**
 * Detect whether yt-dlp is installed and which installer can provision it.
 */
export async function detectYtDlp(options?: { customPath?: string }): Promise<YtDlpDetectResult> {
  if (platform.type !== 'desktop' || !platform.executeCommand) {
    return {
      installed: false,
      installer: 'none',
      installerAvailable: false,
      error: 'yt-dlp detection is only available in the desktop app.',
    }
  }

  const custom = options?.customPath?.trim()
  if (custom) {
    const hit = await probeBinary(custom, false)
    if (hit) {
      const installer = await detectInstaller()
      return {
        installed: true,
        path: hit.path,
        version: hit.version,
        installer: installer.installer,
        installerAvailable: installer.available,
        installerPath: installer.path,
      }
    }
  }

  for (const candidate of ytDlpCandidatePaths()) {
    if (candidate.includes('~')) continue
    const hit = await probeBinary(candidate, false)
    if (hit) {
      const installer = await detectInstaller()
      return {
        installed: true,
        path: hit.path,
        version: hit.version,
        installer: installer.installer,
        installerAvailable: installer.available,
        installerPath: installer.path,
      }
    }
  }

  // PATH / which
  const fromPath = await probeBinary('yt-dlp', true)
  const installer = await detectInstaller()
  if (fromPath) {
    return {
      installed: true,
      path: fromPath.path,
      version: fromPath.version,
      installer: installer.installer,
      installerAvailable: installer.available,
      installerPath: installer.path,
    }
  }

  return {
    installed: false,
    installer: installer.installer,
    installerAvailable: installer.available,
    installerPath: installer.path,
  }
}

/**
 * Install yt-dlp via the OS package manager (brew / winget / pipx).
 * Long-running; call with UI progress. Re-detects after install.
 */
export async function installYtDlp(options?: {
  onPhase?: (phase: string) => void
}): Promise<YtDlpInstallResult> {
  if (platform.type !== 'desktop' || !platform.executeCommand) {
    return {
      ok: false,
      log: '',
      error: 'Install is only available in the desktop app.',
    }
  }

  const onPhase = options?.onPhase
  onPhase?.('Checking current install…')

  const existing = await detectYtDlp()
  if (existing.installed && existing.path) {
    return {
      ok: true,
      path: existing.path,
      version: existing.version,
      log: `Already installed${existing.version ? ` (${existing.version})` : ''} at ${existing.path}`,
    }
  }

  if (!existing.installerAvailable || existing.installer === 'none') {
    const os = getOS()
    if (os === 'Mac') {
      return {
        ok: false,
        log: '',
        error:
          'Homebrew was not found. Install Homebrew first (https://brew.sh), then try again — or install yt-dlp manually.',
      }
    }
    if (os === 'Windows') {
      return {
        ok: false,
        log: '',
        error: 'winget was not found. Install App Installer from Microsoft Store, or install yt-dlp manually.',
      }
    }
    return {
      ok: false,
      log: '',
      error: 'pipx was not found. Install pipx, then run: pipx install yt-dlp — or follow the full install guide.',
    }
  }

  const installerPath = existing.installerPath
  let command: string
  let phaseLabel: string

  if (existing.installer === 'brew') {
    const brew = installerPath || 'brew'
    phaseLabel = 'Installing yt-dlp with Homebrew (this can take a few minutes)…'
    // Non-interactive; long timeout. PATH prefix not needed when using absolute brew.
    command = `${brew} install yt-dlp`
  } else if (existing.installer === 'winget') {
    phaseLabel = 'Installing yt-dlp with winget…'
    command =
      'winget install -e --id yt-dlp.yt-dlp --accept-package-agreements --accept-source-agreements --disable-interactivity'
  } else {
    phaseLabel = 'Installing yt-dlp with pipx…'
    const pipx = installerPath || 'pipx'
    command = `${pathPrefixForShell('Linux')}${pipx} install yt-dlp`
  }

  onPhase?.(phaseLabel)

  let log = ''
  try {
    // Homebrew can easily exceed 2–5 minutes on first install.
    const result = await runShell(command, 600_000)
    log = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()

    // winget exit 0 = success; some versions return non-zero if already installed
    const alreadyMsg = /already installed|already up-to-date|No available upgrade/i.test(log)
    if (result.exitCode !== 0 && !alreadyMsg) {
      return {
        ok: false,
        log,
        error: summarizeInstallError(log, result.exitCode),
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      log: message,
      error: message.includes('timed out')
        ? 'Install timed out. Open a terminal and run the install command manually, then click Check again.'
        : message,
    }
  }

  onPhase?.('Verifying installation…')
  const verified = await detectYtDlp()
  if (verified.installed && verified.path) {
    return {
      ok: true,
      path: verified.path,
      version: verified.version,
      log: log || `Installed successfully at ${verified.path}`,
    }
  }

  return {
    ok: false,
    log,
    error:
      'Install finished but yt-dlp was not found on PATH. Set the binary path below, or open a new terminal session and try Check again.',
  }
}

function summarizeInstallError(log: string, exitCode: number): string {
  const lower = log.toLowerCase()
  if (lower.includes('permission') || lower.includes('sudo')) {
    return 'Install needs higher permissions. Run the package manager install in your terminal, then click Check.'
  }
  if (lower.includes('not found') && lower.includes('brew')) {
    return 'Homebrew was not found. Install it from https://brew.sh first.'
  }
  if (lower.includes('network') || lower.includes('timeout') || lower.includes('could not resolve')) {
    return 'Network error while installing. Check your connection and try again.'
  }
  const lastLines = log
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-3)
    .join(' ')
  return lastLines || `Install failed (exit ${exitCode}). See details below or use the full install guide.`
}

export function installerLabel(installer: YtDlpDetectResult['installer']): string {
  switch (installer) {
    case 'brew':
      return 'Homebrew'
    case 'winget':
      return 'winget'
    case 'pipx':
      return 'pipx'
    default:
      return 'package manager'
  }
}
