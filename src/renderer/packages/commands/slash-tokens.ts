/**
 * / command token helpers for composer text.
 * Only word-boundary slashes; ignores URLs like https:// and // comments.
 */

import { fuzzyScoreSkill } from '@/packages/skills'

/** Matches /command-name tokens at word boundaries (not // or ://) */
export const COMMAND_SLASH_TOKEN_RE = /(?:^|[\s([{])\/([a-z][a-z0-9]*(?:-[a-z0-9]+)*)/gi

export function extractCommandNamesFromText(text: string): string[] {
  const names: string[] = []
  const seen = new Set<string>()
  for (const match of text.matchAll(COMMAND_SLASH_TOKEN_RE)) {
    const name = match[1].toLowerCase()
    if (!seen.has(name)) {
      seen.add(name)
      names.push(name)
    }
  }
  return names
}

/** Remove /command-name tokens; keep surrounding text clean. */
export function stripCommandSlashTokens(text: string): string {
  return text
    .replace(/(?:^|[\s([{])\/([a-z][a-z0-9]*(?:-[a-z0-9]+)*)/gi, (full, _name, offset, source) => {
      // Keep the boundary char if present
      const boundary = full[0] === '/' ? '' : full[0]
      return boundary
    })
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim()
}

/**
 * Active / partial at end of input for CommandPicker.
 * Only when message starts with `/` on a single line (composer convention).
 * Returns query without leading / (may be empty if just "/").
 */
export function getActiveCommandSlashQuery(text: string, caret?: number): string | null {
  if (text.includes('\n')) return null
  const pos = caret ?? text.length
  const before = text.slice(0, pos)
  // Entire input is a slash command draft: /partial
  const match = before.match(/^\/([a-z0-9-]*)$/i)
  if (!match) return null
  return match[1].toLowerCase()
}

export function fuzzyScoreCommand(value: string, query: string): number {
  return fuzzyScoreSkill(value, query)
}
