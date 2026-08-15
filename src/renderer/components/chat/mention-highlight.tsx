import { type ReactNode } from 'react'
import { MENTION_TOKEN_RE, mentionClassName, mentionKind, type MentionKind } from './mention-tokens'

// Re-export pure helpers so existing `from './mention-highlight'` imports keep working.
export { MENTION_TOKEN_RE, mentionClassName, mentionKind, type MentionKind }

/**
 * Split text into plain + mention React nodes (static spans for composer metrics).
 * Prefer InlineMentionsText for interactive message chips.
 */
export function renderMentionNodes(
  text: string,
  options?: { variant?: 'msg' | 'composer'; keyPrefix?: string }
): ReactNode[] {
  if (!text) return []
  const variant = options?.variant ?? 'msg'
  const prefix = options?.keyPrefix ?? 'm'
  const nodes: ReactNode[] = []
  let last = 0
  let i = 0
  const re = new RegExp(MENTION_TOKEN_RE.source, MENTION_TOKEN_RE.flags)
  for (let match = re.exec(text); match !== null; match = re.exec(text)) {
    if (match.index > last) {
      nodes.push(<span key={`${prefix}-t-${i++}`}>{text.slice(last, match.index)}</span>)
    }
    nodes.push(
      <span key={`${prefix}-h-${i++}`} className={mentionClassName(match[0], variant)}>
        {match[0]}
      </span>
    )
    last = match.index + match[0].length
  }
  if (last < text.length) {
    nodes.push(<span key={`${prefix}-t-${i++}`}>{text.slice(last)}</span>)
  }
  return nodes
}
