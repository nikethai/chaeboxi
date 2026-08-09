/**
 * Strip common secret patterns before persisting memory content.
 * Returns empty string if content is empty after redaction.
 */
const SECRET_PATTERNS: RegExp[] = [
  /sk-[a-zA-Z0-9]{20,}/g,
  /sk-ant-[a-zA-Z0-9\-_]{20,}/g,
  /sk-or-[a-zA-Z0-9\-_]{20,}/g,
  /ghp_[a-zA-Z0-9]{20,}/g,
  /github_pat_[a-zA-Z0-9_]{20,}/g,
  /xox[baprs]-[a-zA-Z0-9-]{10,}/g,
  /AIza[0-9A-Za-z\-_]{20,}/g,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  /Bearer\s+[a-zA-Z0-9\-._~+/]+=*/gi,
  /(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"]?[^\s'"]{16,}['"]?/gi,
  /\b[0-9a-f]{64}\b/gi,
]

const REDACTED = '[REDACTED]'

export function redactSecrets(text: string): string {
  if (!text) return ''
  let out = text
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, REDACTED)
  }
  return out.trim()
}

export function isEmptyAfterRedaction(text: string): boolean {
  const redacted = redactSecrets(text)
  if (!redacted) return true
  // Only redaction placeholders left
  const stripped = redacted.replaceAll(REDACTED, '').replace(/\s+/g, '')
  return stripped.length === 0
}
