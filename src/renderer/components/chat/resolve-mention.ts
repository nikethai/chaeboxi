/**
 * Resolve @ $ # @mem: tokens to product labels + hover copy.
 */

import type { AgentDetail, SkillPackage } from '@shared/types'
import type { IntegrationAccount } from '@shared/types/integrations'
import type { MemoryEntry } from '@shared/types/memory'
import { matchAgentBySlug, slugifyAgentName } from '@/packages/agents'
import { matchCredentialBySlug, slugifyCredentialLabel } from '@/packages/integrations/hash-tokens'
import { mentionKind, type MentionKind } from './mention-tokens'

export type { MentionKind }

export type ResolvedMention = {
  kind: MentionKind
  /** Raw token including sigil, e.g. @product-manager */
  token: string
  /** Short chip label (no raw slug when resolved) */
  label: string
  /** Hover title */
  title: string
  /** Hover body */
  description: string
  emoji?: string
  /** Resolved entity id when known */
  id?: string
  resolved: boolean
}

export function humanizeSlug(slug: string): string {
  const cleaned = slug.replace(/-/g, ' ').trim()
  if (!cleaned) return slug
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

export function parseMentionToken(token: string): { kind: MentionKind; slug: string } {
  const kind = mentionKind(token)
  if (kind === 'mem') {
    return { kind, slug: token.slice(5) } // @mem:
  }
  if (kind === 'agent') return { kind, slug: token.slice(1) }
  if (kind === 'skill') return { kind, slug: token.slice(1) }
  if (kind === 'account') return { kind, slug: token.slice(1) }
  return { kind: 'plain', slug: token }
}

export type MentionCatalog = {
  agents: Array<Pick<AgentDetail, 'id' | 'name' | 'emojiAvatar' | 'prompt' | 'demoQuestion'>>
  skills: Array<Pick<SkillPackage, 'id' | 'name' | 'description'>>
  accounts: Array<
    Pick<IntegrationAccount, 'id' | 'label' | 'accountHint' | 'connectorId'> & {
      connectorName?: string
    }
  >
  memoryEntries: Array<Pick<MemoryEntry, 'id' | 'content' | 'tags'>>
}

function agentBlurb(agent: MentionCatalog['agents'][number]): string {
  if (agent.demoQuestion?.trim()) {
    return agent.demoQuestion.trim().replace(/\s+/g, ' ').slice(0, 140)
  }
  let p = (agent.prompt || '').trim().replace(/\s+/g, ' ')
  if (!p) return ''
  p = p
    .replace(/^you are [^,.\n]{1,80}[,.]?\s*/i, '')
    .replace(/^i want you to act as (an?|the)\s+[^,.\n]{1,80}[,.]?\s*/i, '')
  if (p.length <= 120) return p
  const cut = p.slice(0, 120)
  const sp = cut.lastIndexOf(' ')
  return `${sp > 60 ? cut.slice(0, sp) : cut}…`
}

export function resolveMentionToken(token: string, catalog: MentionCatalog): ResolvedMention {
  const { kind, slug } = parseMentionToken(token)
  const base: ResolvedMention = {
    kind,
    token,
    label: token,
    title: token,
    description: '',
    resolved: false,
  }

  if (kind === 'agent') {
    const matched = matchAgentBySlug(
      catalog.agents.map((a) => ({ id: a.id, name: a.name })),
      slug
    )
    const agent = matched ? catalog.agents.find((a) => a.id === matched.id) : undefined
    if (agent) {
      return {
        kind: 'agent',
        token,
        label: agent.name,
        title: agent.name,
        description: agentBlurb(agent) || 'Assistant',
        emoji: agent.emojiAvatar,
        id: agent.id,
        resolved: true,
      }
    }
    return {
      ...base,
      label: humanizeSlug(slug),
      title: humanizeSlug(slug),
      description: 'Assistant mention',
    }
  }

  if (kind === 'skill') {
    const skill =
      catalog.skills.find((s) => s.name.toLowerCase() === slug.toLowerCase()) ||
      catalog.skills.find((s) => s.name.toLowerCase().startsWith(slug.toLowerCase()))
    if (skill) {
      return {
        kind: 'skill',
        token,
        label: skill.name,
        title: skill.name,
        description: (skill.description || 'Skill').replace(/\s+/g, ' ').slice(0, 160),
        id: skill.id,
        resolved: true,
      }
    }
    return {
      ...base,
      label: humanizeSlug(slug),
      title: humanizeSlug(slug),
      description: 'Skill',
    }
  }

  if (kind === 'account') {
    const matched = matchCredentialBySlug(
      catalog.accounts.map((a) => ({
        id: a.id,
        label: a.label,
        accountHint: a.accountHint,
        connectorId: a.connectorId,
        connectorName: a.connectorName,
      })),
      slug
    )
    const account = matched ? catalog.accounts.find((a) => a.id === matched.id) : undefined
    if (account) {
      const hint = [account.connectorName || account.connectorId, account.accountHint]
        .filter(Boolean)
        .join(' · ')
      return {
        kind: 'account',
        token,
        label: account.label,
        title: account.label,
        description: hint || 'Connected account',
        id: account.id,
        resolved: true,
      }
    }
    return {
      ...base,
      label: humanizeSlug(slug),
      title: humanizeSlug(slug),
      description: 'Connected account',
    }
  }

  if (kind === 'mem') {
    const byTag = catalog.memoryEntries.find((e) =>
      e.tags.some((t) => slugifyCredentialLabel(t) === slugifyCredentialLabel(slug) || t.toLowerCase() === slug.toLowerCase())
    )
    // also match slugify of first tag
    const bySlug = byTag || catalog.memoryEntries.find((e) => {
      const t0 = e.tags[0]
      return t0 && slugifyCredentialLabel(t0) === slug
    })
    if (bySlug) {
      const tag = bySlug.tags[0] || humanizeSlug(slug)
      return {
        kind: 'mem',
        token,
        label: tag,
        title: tag,
        description: bySlug.content.replace(/\s+/g, ' ').slice(0, 180),
        id: bySlug.id,
        resolved: true,
      }
    }
    return {
      ...base,
      label: humanizeSlug(slug) || 'Memory',
      title: humanizeSlug(slug) || 'Memory',
      description: 'Memory note',
    }
  }

  return base
}

/** Whether this agent name slug matches (for tests). */
export function agentSlugMatches(name: string, slug: string): boolean {
  return slugifyAgentName(name) === slug.toLowerCase()
}
