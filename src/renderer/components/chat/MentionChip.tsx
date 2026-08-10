/**
 * Slack-style mention chip for chat messages.
 * Shows a human label; hover reveals entity details.
 */

import { HoverCard, Text } from '@mantine/core'
import { IconBrain, IconHash, IconSparkles, IconUser } from '@tabler/icons-react'
import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useMyCopilots, useRemoteCopilots } from '@/hooks/useCopilots'
import { getConnector } from '@shared/integrations'
import { useIntegrationsStore } from '@/stores/integrationsStore'
import { useMemoryStore } from '@/stores/memoryStore'
import { useSkills } from '@/stores/skillsStore'
import { mentionClassName } from './mention-tokens'
import { resolveMentionToken, type MentionCatalog, type ResolvedMention } from './resolve-mention'

function kindLabel(kind: ResolvedMention['kind'], t: (k: string) => string): string {
  switch (kind) {
    case 'agent':
      return t('Assistant')
    case 'skill':
      return t('Skill')
    case 'account':
      return t('Account')
    case 'mem':
      return t('Memory')
    default:
      return t('Mention')
  }
}

function KindIcon({ kind }: { kind: ResolvedMention['kind'] }) {
  const props = { size: 14, stroke: 1.7, 'aria-hidden': true as const }
  switch (kind) {
    case 'agent':
      return <IconUser {...props} />
    case 'skill':
      return <IconSparkles {...props} />
    case 'account':
      return <IconHash {...props} />
    case 'mem':
      return <IconBrain {...props} />
    default:
      return null
  }
}

function chipPrefix(kind: ResolvedMention['kind']): string {
  switch (kind) {
    case 'agent':
      return '@'
    case 'skill':
      return ''
    case 'account':
      return '#'
    case 'mem':
      return ''
    default:
      return ''
  }
}

function MentionChip({ token }: { token: string }) {
  const { t } = useTranslation()
  const { copilots: myAgents } = useMyCopilots()
  const { copilots: remoteAgents } = useRemoteCopilots()
  const { skills } = useSkills()
  const accounts = useIntegrationsStore((s) => s.catalog.accounts)
  const memoryEntries = useMemoryStore((s) => s.globalBank.entries)

  const catalog: MentionCatalog = useMemo(() => {
    const agentMap = new Map<string, MentionCatalog['agents'][number]>()
    for (const a of myAgents) agentMap.set(a.id, a)
    for (const a of remoteAgents || []) {
      if (!agentMap.has(a.id)) agentMap.set(a.id, a)
    }
    return {
      agents: Array.from(agentMap.values()),
      skills: skills.map((s) => ({ id: s.id, name: s.name, description: s.description })),
      accounts: accounts.map((a) => ({
        id: a.id,
        label: a.label,
        accountHint: a.accountHint,
        connectorId: a.connectorId,
        connectorName: getConnector(a.connectorId)?.name,
      })),
      memoryEntries: memoryEntries
        .filter((e) => e.enabled && !e.archived)
        .map((e) => ({ id: e.id, content: e.content, tags: e.tags })),
    }
  }, [accounts, memoryEntries, myAgents, remoteAgents, skills])

  const resolved = useMemo(() => resolveMentionToken(token, catalog), [token, catalog])

  const display = useMemo(() => {
    const prefix = chipPrefix(resolved.kind)
    if (resolved.kind === 'agent') {
      const emoji = resolved.emoji ? `${resolved.emoji} ` : ''
      return `${prefix}${emoji}${resolved.label}`
    }
    if (resolved.kind === 'skill') {
      return resolved.label
    }
    if (resolved.kind === 'account') {
      return `${prefix}${resolved.label}`
    }
    if (resolved.kind === 'mem') {
      return resolved.label
    }
    return token
  }, [resolved, token])

  return (
    <HoverCard
      width={280}
      shadow="md"
      openDelay={280}
      closeDelay={80}
      position="top"
      withArrow
      withinPortal
    >
      <HoverCard.Target>
        <button
          type="button"
          className={`${mentionClassName(token, 'msg')} msg-mention-btn`}
          data-resolved={resolved.resolved || undefined}
          data-kind={resolved.kind}
        >
          {display}
        </button>
      </HoverCard.Target>
      <HoverCard.Dropdown className="mention-hover-card" p="sm">
        <div className="mention-hover-head">
          <span className={`mention-hover-icon mention-hover-icon-${resolved.kind}`} aria-hidden>
            {resolved.emoji ? (
              <span className="mention-hover-emoji">{resolved.emoji}</span>
            ) : (
              <KindIcon kind={resolved.kind} />
            )}
          </span>
          <div className="mention-hover-meta min-w-0">
            <Text size="xs" c="dimmed" className="mention-hover-kind">
              {kindLabel(resolved.kind, t)}
            </Text>
            <Text size="sm" fw={600} className="mention-hover-title" lineClamp={1}>
              {resolved.title}
            </Text>
          </div>
        </div>
        {resolved.description ? (
          <Text size="xs" c="dimmed" mt={8} className="mention-hover-desc" lineClamp={4}>
            {resolved.description}
          </Text>
        ) : null}
        {!resolved.resolved ? (
          <Text size="xs" c="dimmed" mt={6} fs="italic">
            {t('Not found in this workspace')}
          </Text>
        ) : null}
      </HoverCard.Dropdown>
    </HoverCard>
  )
}

export default memo(MentionChip)
