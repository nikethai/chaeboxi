/**
 * Speaker chrome for agent-attributed assistant messages: avatar + name (+ role badge).
 */

import { Flex, Loader, Text } from '@mantine/core'
import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { AgentAvatar } from '@/components/agents/AgentAvatar'
import { resolveAgentMeta } from '@/packages/agents'

export interface AgentSpeakerHeaderProps {
  agentId?: string
  name?: string
  generating?: boolean
  roomRole?: 'turn' | 'synthesis' | 'plan' | 'do' | 'review' | 'deliver'
  roomRound?: number
  className?: string
  /** Visual grouping: first turn in a discussion run */
  discussionGroupStart?: boolean
}

function roleBadgeLabel(
  roomRole: AgentSpeakerHeaderProps['roomRole'],
  t: (k: string) => string
): string | null {
  switch (roomRole) {
    case 'synthesis':
      return t('Team answer')
    case 'plan':
      return t('Plan')
    case 'do':
      return t('Working')
    case 'review':
      return t('Review')
    case 'deliver':
      return t('Deliverable')
    default:
      return null
  }
}

function AgentSpeakerHeader({
  agentId,
  name,
  generating,
  roomRole,
  roomRound,
  className,
  discussionGroupStart,
}: AgentSpeakerHeaderProps) {
  const { t } = useTranslation()
  const meta = useMemo(() => resolveAgentMeta(agentId), [agentId])

  const displayName = pickDisplayName(meta, name, t('Agent'))
  const accent = meta?.accent || 'var(--chatbox-brand-primary, #5b63d4)'
  const badge = roleBadgeLabel(roomRole, t)
  const isPrimary =
    roomRole === 'synthesis' || roomRole === 'do' || roomRole === 'deliver'
  const isCompactTurn = roomRole === 'turn' || roomRole === 'plan' || roomRole === 'review'
  const avatarSize = isCompactTurn ? 20 : 22

  return (
    <div className={className}>
      {discussionGroupStart ? (
        <Text size="xs" c="chatbox-tertiary" mb={6} className="uppercase tracking-wide">
          {t('Team discussion')}
          {roomRound ? ` · ${t('Round')} ${roomRound}` : ''}
        </Text>
      ) : null}
      <Flex align="center" gap={8} mb={isCompactTurn ? 4 : 6}>
        <div
          className="shrink-0 rounded-full"
          style={{
            boxShadow: `0 0 0 ${isPrimary ? 2 : 1.5}px ${accent}`,
            lineHeight: 0,
            opacity: isCompactTurn && !generating ? 0.92 : 1,
          }}
          title={displayName}
        >
          <AgentAvatar size={avatarSize} agentId={agentId} resolved={meta?.avatar} />
        </div>
        <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
          <Text
            size={isCompactTurn ? 'xs' : 'sm'}
            fw={600}
            c="chatbox-primary"
            className="truncate max-w-[240px]"
            title={displayName}
          >
            {displayName}
          </Text>
          {roomRole === 'turn' && roomRound ? (
            <Text size="xs" c="chatbox-tertiary">
              R{roomRound}
            </Text>
          ) : null}
          {badge ? (
            <Text
              size="xs"
              fw={600}
              className="px-1.5 py-0.5 rounded"
              style={{
                background: isPrimary
                  ? 'var(--chatbox-background-brand-secondary, rgba(34,139,230,0.12))'
                  : 'var(--chatbox-background-secondary, #16161a)',
                color: isPrimary
                  ? 'var(--chatbox-brand-primary, #228be6)'
                  : 'var(--chatbox-tint-secondary, #a8a8ae)',
              }}
            >
              {badge}
            </Text>
          ) : null}
          {generating ? <Loader size={12} classNames={{ root: "after:content-[''] after:border-[2px]" }} /> : null}
        </div>
      </Flex>
    </div>
  )
}

function pickDisplayName(
  meta: ReturnType<typeof resolveAgentMeta>,
  persistedName: string | undefined,
  fallback: string
): string {
  if (meta && !meta.isFallback && meta.name) {
    return meta.name
  }
  if (persistedName?.trim()) {
    return persistedName.trim()
  }
  if (meta?.name) return meta.name
  return fallback
}

export default memo(AgentSpeakerHeader)
