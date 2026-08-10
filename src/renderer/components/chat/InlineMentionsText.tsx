import { memo, type ReactNode } from 'react'
import MentionChip from './MentionChip'
import { renderMentionNodes as renderStaticMentionNodes } from './mention-highlight'
import { MENTION_TOKEN_RE, mentionClassName, mentionKind } from './mention-tokens'

export { mentionClassName, mentionKind, MENTION_TOKEN_RE, renderStaticMentionNodes as renderMentionNodes }

/**
 * Message body mentions — interactive chips with hover info.
 * Composer uses static `renderMentionNodes` (must match textarea glyph metrics).
 */
function InlineMentionsText({ text }: { text: string }) {
  if (!text) return null

  const nodes: ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  let i = 0
  const re = new RegExp(MENTION_TOKEN_RE.source, MENTION_TOKEN_RE.flags)
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(<span key={`t-${i++}`}>{text.slice(last, match.index)}</span>)
    }
    nodes.push(<MentionChip key={`h-${i++}`} token={match[0]} />)
    last = match.index + match[0].length
  }
  if (last < text.length) {
    nodes.push(<span key={`t-${i++}`}>{text.slice(last)}</span>)
  }
  return <>{nodes}</>
}

export default memo(InlineMentionsText)
