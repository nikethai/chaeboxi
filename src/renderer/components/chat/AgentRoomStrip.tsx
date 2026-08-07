import { ActionIcon, Flex, Text, Tooltip } from '@mantine/core'
import type { AgentDetail } from '@shared/types'
import { IconX } from '@tabler/icons-react'
import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useMyCopilots, useRemoteCopilots } from '@/hooks/useCopilots'

export interface AgentRoomStripProps {
  agentIds: string[]
  onRemove?(agentId: string): void
  className?: string
}

function AgentRoomStrip({ agentIds, onRemove, className }: AgentRoomStripProps) {
  const { t } = useTranslation()
  const { copilots: myAgents } = useMyCopilots()
  const { copilots: remoteAgents } = useRemoteCopilots()

  const members = useMemo(() => {
    const byId = new Map<string, AgentDetail>()
    for (const a of [...myAgents, ...(remoteAgents || [])]) {
      byId.set(a.id, a)
    }
    return agentIds.map((id) => byId.get(id)).filter((a): a is AgentDetail => Boolean(a))
  }, [agentIds, myAgents, remoteAgents])

  if (members.length === 0) return null

  return (
    <Flex className={className} align="center" gap={6} wrap="wrap" px={4} py={4}>
      <Text size="xs" c="chatbox-tertiary" className="shrink-0">
        {t('In this chat')}:
      </Text>
      {members.map((agent) => (
        <Flex
          key={agent.id}
          align="center"
          gap={4}
          className="rounded-full px-2 py-0.5"
          style={{
            background: 'var(--chatbox-background-secondary)',
            border: '1px solid var(--chatbox-border-primary)',
          }}
        >
          <Text size="xs">{agent.emojiAvatar || '🤖'}</Text>
          <Text size="xs" fw={500} className="max-w-[120px] truncate">
            {agent.name}
          </Text>
          {onRemove ? (
            <Tooltip label={t('Remove from room')}>
              <ActionIcon
                size="xs"
                variant="subtle"
                color="gray"
                onClick={() => onRemove(agent.id)}
                aria-label={t('Remove from room')}
              >
                <IconX size={12} />
              </ActionIcon>
            </Tooltip>
          ) : null}
        </Flex>
      ))}
      <Text size="xs" c="chatbox-tertiary">
        · {t('You')}
      </Text>
    </Flex>
  )
}

export default memo(AgentRoomStrip)
