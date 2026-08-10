/**
 * $ skill token helpers for composer text.
 * Skill names are kebab-case; currency like $100 is ignored.
 */

/** Matches $skill-name tokens (not $100) */
export const SKILL_DOLLAR_TOKEN_RE = /\$([a-z][a-z0-9]*(?:-[a-z0-9]+)*)/gi

export function extractSkillNamesFromText(text: string): string[] {
  const names: string[] = []
  const seen = new Set<string>()
  for (const match of text.matchAll(SKILL_DOLLAR_TOKEN_RE)) {
    const name = match[1].toLowerCase()
    if (!seen.has(name)) {
      seen.add(name)
      names.push(name)
    }
  }
  return names
}

/** Remove $skill-name tokens; collapse leftover double spaces. */
export function stripSkillDollarTokens(text: string): string {
  return text
    .replace(SKILL_DOLLAR_TOKEN_RE, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim()
}

/**
 * Replace active $partial with completed $name, keeping the token in the draft.
 * Adds a trailing space when the caret is at end so the user can keep typing.
 */
export function replaceActiveSkillDollarWithToken(text: string, skillName: string, caret?: number): string {
  const token = skillName.toLowerCase().replace(/[^a-z0-9-]/g, '')
  if (!token || /^[0-9]/.test(token)) return text
  const pos = caret ?? text.length
  const before = text.slice(0, pos)
  const after = text.slice(pos)
  const replaced = before.replace(/(?:^|[\s([{])\$[a-z0-9-]*$/i, (m) => {
    const boundary = m.length > 0 && /[\s([{]/.test(m[0]) ? m[0] : ''
    return `${boundary}$${token}`
  })
  const needsSpace = after.length === 0 || !/^\s/.test(after)
  return replaced + (needsSpace ? ' ' : '') + after
}

/**
 * Detect active $ partial at end of text or around caret for picker.
 * Returns query without leading $ (may be empty string if just "$").
 */
export function getActiveSkillDollarQuery(text: string, caret?: number): string | null {
  const pos = caret ?? text.length
  const before = text.slice(0, pos)
  // Token at caret: optional partial name after $
  const match = before.match(/(?:^|[\s([{])\$([a-z0-9-]*)$/i)
  if (!match) return null
  const partial = match[1]
  // Reject pure currency: $ followed by digit-only was already excluded by [a-z0-9-]*
  // but "$12" won't match because pattern requires start after boundary with $ then letters-or-empty
  // "$1" — digit only partial: treat as non-skill if partial is only digits
  if (partial && /^[0-9]+$/.test(partial)) return null
  return partial.toLowerCase()
}

export function fuzzyScoreSkill(value: string, query: string): number {
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
