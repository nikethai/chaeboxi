/**
 * # connected-account token helpers for composer text.
 * Trigger is `#` (not `@` agents or `$` skills).
 * Tokens are kebab-case slugs matching label/hint/connector (never secrets).
 */

export const CREDENTIAL_HASH_TOKEN_RE = /#([a-z][a-z0-9]*(?:-[a-z0-9]+)*)/gi

/** Max accounts tagged per turn (mirrors product cap). */
export const CREDENTIAL_CHIP_MAX = 8

export function slugifyCredentialLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

export function extractCredentialSlugsFromText(text: string): string[] {
  const names: string[] = []
  const seen = new Set<string>()
  for (const match of text.matchAll(CREDENTIAL_HASH_TOKEN_RE)) {
    const name = match[1].toLowerCase()
    if (!seen.has(name)) {
      seen.add(name)
      names.push(name)
    }
  }
  return names
}

/** Remove #slug tokens; collapse leftover double spaces. */
export function stripCredentialHashTokens(text: string): string {
  return text
    .replace(CREDENTIAL_HASH_TOKEN_RE, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim()
}

/**
 * Replace active #partial with completed #slug, keeping the token in the draft.
 * Adds a trailing space when the caret is at end so the user can keep typing.
 */
export function replaceActiveCredentialHashWithToken(text: string, slug: string, caret?: number): string {
  const token = slugifyCredentialLabel(slug)
  if (!token || /^[0-9]/.test(token)) return text
  const pos = caret ?? text.length
  const before = text.slice(0, pos)
  const after = text.slice(pos)
  const replaced = before.replace(/(?:^|[\s([{])#[a-z0-9-]*$/i, (m) => {
    const boundary = m.length > 0 && /[\s([{]/.test(m[0]) ? m[0] : ''
    return `${boundary}#${token}`
  })
  const needsSpace = after.length === 0 || !/^\s/.test(after)
  return replaced + (needsSpace ? ' ' : '') + after
}

/**
 * Detect active # partial at end of text or around caret for picker.
 * Returns query without leading # (may be empty if just "#").
 */
export function getActiveCredentialHashQuery(text: string, caret?: number): string | null {
  const pos = caret ?? text.length
  const before = text.slice(0, pos)
  const match = before.match(/(?:^|[\s([{])#([a-z0-9-]*)$/i)
  if (!match) return null
  const partial = match[1]
  if (partial && /^[0-9]+$/.test(partial)) return null
  return partial.toLowerCase()
}

export function fuzzyScoreCredential(value: string, query: string): number {
  if (!query) return 1
  const source = value.toLowerCase()
  const target = query.toLowerCase()
  if (source.includes(target)) return target.length + 100
  let score = 0
  let ti = 0
  for (let si = 0; si < source.length && ti < target.length; si++) {
    if (source[si] === target[ti]) {
      score += 1
      ti += 1
    }
  }
  return ti === target.length ? score : 0
}

export type CredentialMatchable = {
  id: string
  label: string
  accountHint?: string
  connectorId: string
  connectorName?: string
}

/** Resolve slug → account by label slug, hint slug, connector id, or id prefix. */
export function matchCredentialBySlug(accounts: CredentialMatchable[], slug: string): CredentialMatchable | undefined {
  const q = slug.toLowerCase()
  const exact = accounts.find((a) => {
    const labelSlug = slugifyCredentialLabel(a.label)
    const hintSlug = a.accountHint ? slugifyCredentialLabel(a.accountHint) : ''
    return (
      labelSlug === q ||
      hintSlug === q ||
      a.connectorId === q ||
      (a.connectorName && slugifyCredentialLabel(a.connectorName) === q) ||
      a.id.toLowerCase().startsWith(q)
    )
  })
  if (exact) return exact
  // Prefix match on label slug
  return accounts.find((a) => slugifyCredentialLabel(a.label).startsWith(q))
}
