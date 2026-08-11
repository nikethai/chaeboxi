/**
 * URL scheme + optional domain allowlist helpers for browser agent.
 */

export function assertBrowserUrl(
  url: string,
  allowlist: string[] = []
): { ok: true; url: string } | { ok: false; error: string; code: 'SECURITY_BLOCKED' } {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { ok: false, error: 'Invalid URL', code: 'SECURITY_BLOCKED' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'Only http(s) URLs are allowed', code: 'SECURITY_BLOCKED' }
  }
  if (allowlist.length > 0) {
    const host = parsed.hostname.toLowerCase()
    const allowed = allowlist.some((entry) => {
      const e = String(entry)
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .split('/')[0]
      return host === e || host.endsWith(`.${e}`)
    })
    if (!allowed) {
      return { ok: false, error: `Host not in allowlist: ${host}`, code: 'SECURITY_BLOCKED' }
    }
  }
  return { ok: true, url: parsed.toString() }
}

export function workspaceBrowserDownloadsDir(workspaceRoot: string | undefined | null): string | null {
  if (!workspaceRoot?.trim()) return null
  const root = workspaceRoot.trim().replace(/[/\\]+$/, '')
  // Prefer .chaeboxi-browser-downloads under workspace
  return `${root}/.chaeboxi-browser-downloads`
}
