/**
 * Pure mention token helpers — no React / JSX.
 * Safe to import from non-UI modules (e.g. composer-chip-dom) without pulling
 * react/jsx-dev-runtime (avoids jsxDEV TDZ under circular init graphs).
 *
 * Token shapes: @agent, $skill, #account, @mem:label
 */

export const MENTION_TOKEN_RE = /(@mem:[a-z0-9-]+|@[a-z][a-z0-9-]*|\$[a-z][a-z0-9-]*|#[a-z][a-z0-9-]*)/gi

export type MentionKind = 'agent' | 'skill' | 'account' | 'mem' | 'plain'

export function mentionKind(token: string): MentionKind {
  if (token.toLowerCase().startsWith('@mem:')) return 'mem'
  if (token.startsWith('@')) return 'agent'
  if (token.startsWith('$')) return 'skill'
  if (token.startsWith('#')) return 'account'
  return 'plain'
}

export function mentionClassName(token: string, variant: 'msg' | 'composer' = 'msg'): string {
  const kind = mentionKind(token)
  if (kind === 'plain') return variant === 'composer' ? 'composer-mention' : 'msg-mention'
  return variant === 'composer'
    ? `composer-mention composer-mention-${kind}`
    : `msg-mention msg-mention-${kind}`
}
