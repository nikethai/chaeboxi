/**
 * @ agent mention helpers for composer text.
 * Chips are source of truth; raw @partial is stripped after select like $skills.
 */

/** Active @ partial at end of text / caret — returns query without @ (may be empty). */
export function getActiveAgentAtQuery(text: string, caret?: number): string | null {
  const pos = caret ?? text.length
  const before = text.slice(0, pos)
  // @name or bare @; require boundary so email-ish middle isn't triggered too aggressively
  const match = before.match(/(?:^|[\s([{])@([^\s@]*)$/)
  if (!match) return null
  return match[1].toLowerCase()
}

/** Strip trailing incomplete @query being typed (picker active). */
export function stripActiveAgentAtToken(text: string, caret?: number): string {
  const pos = caret ?? text.length
  const before = text.slice(0, pos)
  const after = text.slice(pos)
  const cleaned = before.replace(/(?:^|[\s([{])@[^\s@]*$/, (m) => {
    // keep the boundary char if present
    if (m.length > 0 && /[\s([{]/.test(m[0])) return m[0]
    return ''
  })
  return (cleaned + after)
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim()
}

export function fuzzyScoreAgent(value: string, query: string): number {
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
