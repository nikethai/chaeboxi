/**
 * Speaker chrome for agent-attributed assistant messages: avatar + name (+ Final badge).
 */

import { Avatar, Flex, Loader, Text } from '@mantine/core'
import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { agentAccentColor, resolveAgentMeta } from '@/packages/agents'

export interface AgentSpeakerHeaderProps {
  agentId?: string
  name?: string
  generating?: boolean
  roomRole?: 'turn' | 'synthesis'
  className?: string
}

function AgentSpeakerHeader({ agentId, name, generating, roomRole, className }: AgentSpeakerHeaderProps) {
  const { t } = useTranslation()
  // Live resolve so remote catalog agents show real name/emoji (not humanized ids)
  const meta = useMemo(() => resolveAgentMeta(agentId), [agentId])

  const displayName = pickDisplayName(meta, name, t('Agent'))
  const emoji = meta?.emojiAvatar
  const picUrl = meta?.picUrl
  const accent = agentId ? agentAccentColor(agentId) : 'var(--chatbox-brand-primary, #228be6)'
  const isFinal = roomRole === 'synthesis'

  return (
    <Flex className={className} align="center" gap={8} mb={6}>
      <div
        className="shrink-0 rounded-full"
        style={{
          boxShadow: `0 0 0 2px ${accent}`,
          lineHeight: 0,
        }}
        title={displayName}
      >
        <Avatar src={emoji ? undefined : picUrl} size={22} radius="xl" color="chatbox-brand">
          {emoji || displayName.slice(0, 1).toUpperCase()}
        </Avatar>
      </div>
      <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
        <Text size="sm" fw={600} c="chatbox-primary" className="truncate max-w-[240px]" title={displayName}>
          {displayName}
        </Text>
        {isFinal ? (
          <Text
            size="xs"
            fw={600}
            className="px-1.5 py-0.5 rounded"
            style={{
              background: 'var(--chatbox-background-brand-secondary, rgba(34,139,230,0.12))',
              color: 'var(--chatbox-brand-primary, #228be6)',
            }}
          >
            {t('Final answer')}
          </Text>
        ) : null}
        {generating ? <Loader size={12} classNames={{ root: "after:content-[''] after:border-[2px]" }} /> : null}
      </div>
    </Flex>
  )
}

function pickDisplayName(
  meta: ReturnType<typeof resolveAgentMeta>,
  persistedName: string | undefined,
  fallback: string
): string {
  // Catalog hit (built-in / local / remote) always wins — fixes old messages with humanized ids
  if (meta && !meta.isFallback && meta.name) {
    return meta.name
  }
  // Persisted name from when the turn was created (if we had it)
  if (persistedName?.trim()) {
    return persistedName.trim()
  }
  if (meta?.name) return meta.name
  return fallback
}

export default memo(AgentSpeakerHeader)
