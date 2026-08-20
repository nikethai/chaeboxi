/**
 * Split a streaming answer into a settled prefix (complete blocks) and an in-progress tail.
 * Only a blank line OUTSIDE a code fence / display-math block is a safe boundary — splitting
 * inside one would break that block's render. Memoizing the settled prefix is what keeps long
 * answers streaming smoothly: we re-parse only the tail on each token flush, not the whole doc.
 */
export function splitStreamingMarkdown(text: string): { settled: string; tail: string } {
  let inFence = false
  let inMath = false
  let inBracketMath = false
  let lastBoundary = -1
  const lines = text.split('\n')
  let pos = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!inMath && !inBracketMath && trimmed.startsWith('```')) {
      inFence = !inFence
    }
    if (!inFence && !inBracketMath) {
      const dd = trimmed.match(/\$\$/g)
      if (dd && dd.length % 2 === 1) {
        inMath = !inMath
      }
    }
    if (!inFence && !inMath) {
      const opens = trimmed.includes('\\[')
      const closes = trimmed.includes('\\]')
      if (opens && !closes) {
        inBracketMath = true
      } else if (closes && !opens) {
        inBracketMath = false
      }
    }
    if (!inFence && !inMath && !inBracketMath && trimmed === '' && i < lines.length - 1) {
      lastBoundary = pos + line.length + 1
    }
    pos += line.length + 1
  }
  if (lastBoundary <= 0) {
    return { settled: '', tail: text }
  }
  return { settled: text.slice(0, lastBoundary), tail: text.slice(lastBoundary) }
}

export type FrozenMarkdownSplit = { settled: string; tail: string; source: string }

/**
 * Keep the last live settled/tail split after generating ends.
 * Collapsing to a single ReactMarkdown tree on settle remounted every block (answer flash).
 */
export function nextFrozenMarkdownSplit(
  text: string,
  generating: boolean | undefined,
  prev: FrozenMarkdownSplit | null
): FrozenMarkdownSplit | null {
  if (generating) {
    const split = splitStreamingMarkdown(text)
    if (!split.settled) return null
    return { settled: split.settled, tail: split.tail, source: text }
  }
  if (prev && prev.source === text) return prev
  return null
}
